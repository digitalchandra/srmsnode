const mongoose = require("mongoose");
const Sale = require("../models/Sale");
const Customer = require("../models/Customer");
const SaleItem = require("../models/SaleItem");
const Product = require("../models/Product");
const InventoryBatch = require("../models/InventoryBatch");
const SaleItemBatch = require("../models/SaleItemBatch");
const StockMovement = require("../models/StockMovement");

// Create Sale
const createSale = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const createdBy = req.user.userId;

    const {
      customerId,
      saleNumber,
      saleDate,
      discountAmount,
      taxAmount,
      note,
    } = req.body;

    if (!saleNumber || !saleNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: "Sale number is required",
      });
    }

    // Check duplicate sale number within tenant
    const existingSale = await Sale.findOne({
      tenantId,
      saleNumber: saleNumber.trim(),
    });

    if (existingSale) {
      return res.status(409).json({
        success: false,
        message: "Sale number already exists",
      });
    }

    // Customer is optional for walk-in sales
    if (customerId !== undefined && customerId !== null) {
      if (!mongoose.Types.ObjectId.isValid(customerId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid customer ID",
        });
      }

      const customer = await Customer.findOne({
        _id: customerId,
        tenantId,
        status: "ACTIVE",
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Active customer not found",
        });
      }
    }

    const discount = Number(discountAmount || 0);
    const tax = Number(taxAmount || 0);

    if (discount < 0 || tax < 0) {
      return res.status(400).json({
        success: false,
        message: "Discount and tax cannot be negative",
      });
    }

    const sale = await Sale.create({
      tenantId,
      customerId: customerId || null,
      saleNumber: saleNumber.trim(),
      saleDate: saleDate || new Date(),
      status: "DRAFT",
      subtotal: 0,
      discountAmount: discount,
      taxAmount: tax,
      totalAmount: tax - discount >= 0 ? tax - discount : 0,
      paidAmount: 0,
      paymentStatus: "UNPAID",
      note: note || "",
      createdBy,
    });

    return res.status(201).json({
      success: true,
      message: "Sale created successfully",
      data: sale,
    });
  } catch (error) {
    console.error("Create sale error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create sale",
    });
  }
};

//get sale 

const getSale = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale ID",
      });
    }

    const sale = await Sale.findOne({
      _id: id,
      tenantId,
    })
      .populate("customerId", "name phone email")
      .populate("createdBy", "name email role");

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    const items = await SaleItem.find({
      tenantId,
      saleId: sale._id,
    }).populate("productId", "name sku barcode pricing");

    return res.status(200).json({
      success: true,
      data: {
        sale,
        items,
      },
    });
  } catch (error) {
    console.error("Get sale error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get sale",
    });
  }
};


const completeSale = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const tenantId = req.user.tenantId;
    const performedBy = req.user.userId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale ID",
      });
    }

    let completedSale;

    await session.withTransaction(async () => {
      const sale = await Sale.findOne({
        _id: id,
        tenantId,
      }).session(session);

      if (!sale) {
        const error = new Error("Sale not found");
        error.statusCode = 404;
        throw error;
      }

      if (sale.status !== "DRAFT") {
        const error = new Error(
          "Only draft sales can be completed"
        );
        error.statusCode = 400;
        throw error;
      }

      const items = await SaleItem.find({
        tenantId,
        saleId: sale._id,
      }).session(session);

      if (items.length === 0) {
        const error = new Error(
          "Cannot complete a sale without items"
        );
        error.statusCode = 400;
        throw error;
      }

      // Validate final sale amount before changing inventory.
      const expectedSubtotal = items.reduce(
        (sum, item) => sum + item.lineTotal,
        0
      );

      const expectedTotal =
        expectedSubtotal +
        sale.taxAmount -
        sale.discountAmount;

      if (
        expectedTotal < 0 ||
        Math.abs(expectedSubtotal - sale.subtotal) > 0.001 ||
        Math.abs(expectedTotal - sale.totalAmount) > 0.001
      ) {
        const error = new Error(
          "Sale totals are inconsistent. Review the sale before completing it."
        );
        error.statusCode = 400;
        throw error;
      }

      for (const item of items) {
        const product = await Product.findOne({
          _id: item.productId,
          tenantId,
          status: "ACTIVE",
        }).session(session);

        if (!product) {
          const error = new Error(
            `Active product not found for item ${item._id}`
          );
          error.statusCode = 400;
          throw error;
        }

        if (!product.inventory?.trackStock) {
          const error = new Error(
            `Stock tracking is disabled for ${product.name}. This sale cannot use the inventory FEFO workflow yet.`
          );
          error.statusCode = 400;
          throw error;
        }

        let remaining = item.quantity;

        // FEFO: earliest non-expired batch first.
        // Sort by expiryDate, then creation date for deterministic order.
        const batches = await InventoryBatch.find({
          tenantId,
          productId: product._id,
          status: "ACTIVE",
          quantity: { $gt: 0 },
          expiryDate: { $gte: new Date() },
        })
          .sort({ expiryDate: 1, createdAt: 1, _id: 1 })
          .session(session);

        for (const batch of batches) {
          if (remaining <= 0) break;

          const take = Math.min(batch.quantity, remaining);
          const previousBatchStock = batch.quantity;
          const newBatchStock = previousBatchStock - take;

          // Conditional update prevents taking more than the
          // currently available batch quantity.
          const updatedBatch = await InventoryBatch.findOneAndUpdate(
            {
              _id: batch._id,
              tenantId,
              status: "ACTIVE",
              quantity: { $gte: take },
            },
            {
              $inc: { quantity: -take },
              ...(newBatchStock === 0
                ? { $set: { status: "DEPLETED" } }
                : {}),
            },
            {
              new: true,
              session,
            }
          );

          if (!updatedBatch) {
            const error = new Error(
              "Inventory changed during sale. Please retry."
            );
            error.statusCode = 409;
            throw error;
          }

          await SaleItemBatch.create(
            [
              {
                tenantId,
                saleId: sale._id,
                saleItemId: item._id,
                productId: product._id,
                batchId: batch._id,
                quantity: take,
                unitCost: batch.costPrice,
                unitSellingPrice: item.unitPrice,
              },
            ],
            { session }
          );

          await StockMovement.create(
            [
              {
                tenantId,
                productId: product._id,
                batchId: batch._id,
                movementType: "STOCK_OUT",
                quantity: take,
                previousStock: previousBatchStock,
                newStock: newBatchStock,
                referenceType: "SALE",
                referenceId: sale._id,
                note: `Sale ${sale.saleNumber}`,
                performedBy,
              },
            ],
            { session }
          );

          remaining -= take;
        }

        if (remaining > 0) {
          const error = new Error(
            `Insufficient unexpired stock for ${product.name}. Missing quantity: ${remaining}`
          );
          error.statusCode = 400;
          throw error;
        }

        // Update aggregate product stock only after all required
        // batches for this product item have been allocated.
        const stockUpdate = await Product.updateOne(
          {
            _id: product._id,
            tenantId,
            "inventory.currentStock": { $gte: item.quantity },
          },
          {
            $inc: {
              "inventory.currentStock": -item.quantity,
            },
          },
          { session }
        );

        if (stockUpdate.modifiedCount !== 1) {
          const error = new Error(
            `Product stock is inconsistent for ${product.name}`
          );
          error.statusCode = 409;
          throw error;
        }
      }

      sale.status = "COMPLETED";
      await sale.save({ session });

      completedSale = sale;
    });

    return res.status(200).json({
      success: true,
      message: "Sale completed and stock deducted successfully",
      data: completedSale,
    });
  } catch (error) {
    console.error("Complete sale error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to complete sale",
    });
  } finally {
    await session.endSession();
  }
};


module.exports = {
  createSale,
  completeSale,
  getSale,
};