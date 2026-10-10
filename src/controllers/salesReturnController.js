
const mongoose = require("mongoose");
const SalesReturn = require("../models/SalesReturn");
const SalesReturnItem = require("../models/SalesReturnItem");
const Sale = require("../models/Sale");
const SaleItem = require("../models/SaleItem");
const InventoryBatch = require("../models/InventoryBatch");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const SaleItemBatch = require("../models/SaleItemBatch");

const createSalesReturn = async (req, res) => {
  try {
    const { saleId } = req.params;
    const { reason, note = "", items } = req.body;

    if (!mongoose.isValidObjectId(saleId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale ID",
      });
    }

    if (
      !reason ||
      ![
        "CUSTOMER_REQUEST",
        "DAMAGED",
        "WRONG_ITEM",
        "EXPIRED",
        "OTHER",
      ].includes(reason)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid return reason",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one return item is required",
      });
    }

    const tenantId = req.user.tenantId;
    const processedBy = req.user.userId;

    const sale = await Sale.findOne({
      _id: saleId,
      tenantId,
      status: "COMPLETED",
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Completed sale not found",
      });
    }

    const saleItems = await SaleItem.find({
      tenantId,
      saleId,
    });

    const saleItemMap = new Map(
      saleItems.map((item) => [item._id.toString(), item])
    );

    const seenItems = new Set();
    const preparedItems = [];
    let totalRefundCents = 0;

    for (const item of items) {
      const { saleItemId, quantity, condition, restock = false } = item;

      if (!mongoose.isValidObjectId(saleItemId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid sale item ID",
        });
      }

      if (seenItems.has(saleItemId)) {
        return res.status(400).json({
          success: false,
          message: "Duplicate sale item IDs are not allowed",
        });
      }
      seenItems.add(saleItemId);

      const qty = Number(quantity);

      if (!Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({
          success: false,
          message: "Return quantity must be greater than zero",
        });
      }

      if (!["GOOD", "DAMAGED", "EXPIRED"].includes(condition)) {
        return res.status(400).json({
          success: false,
          message: "Invalid returned item condition",
        });
      }

      if (typeof restock !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "restock must be true or false",
        });
      }

      if (restock && condition !== "GOOD") {
        return res.status(400).json({
          success: false,
          message: "Only items in GOOD condition can be restocked",
        });
      }

      const saleItem = saleItemMap.get(saleItemId);

      if (!saleItem) {
        return res.status(400).json({
          success: false,
          message: "Sale item does not belong to this sale",
        });
      }

      // Do not allow the same quantity to be returned more than once.
      // This checks existing returns before saving; transaction-based
      // concurrency protection will be added in the processing workflow.
      const existingReturns = await SalesReturn.find({
        tenantId,
        saleId,
        status: "COMPLETED",
      }).select("_id");

      const completedReturnIds = existingReturns.map((r) => r._id);

      const alreadyReturnedItems = completedReturnIds.length
        ? await SalesReturnItem.find({
            tenantId,
            salesReturnId: { $in: completedReturnIds },
            saleItemId,
          })
        : [];

      const alreadyReturned = alreadyReturnedItems.reduce(
        (sum, r) => sum + Number(r.quantity),
        0
      );

      const remainingQty =
        Math.round((Number(saleItem.quantity) - alreadyReturned) * 1000) /
        1000;

      if (qty > remainingQty) {
        return res.status(400).json({
          success: false,
          message: `Return quantity exceeds remaining quantity (${remainingQty})`,
        });
      }

      const unitPriceCents = Math.round(Number(saleItem.unitPrice) * 100);
      const lineTotalCents = Math.round(Number(saleItem.lineTotal) * 100);
      const saleQtyMilli = Math.round(Number(saleItem.quantity) * 1000);

      if (
        !Number.isSafeInteger(unitPriceCents) ||
        !Number.isSafeInteger(lineTotalCents) ||
        saleQtyMilli <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Sale item pricing is invalid",
        });
      }

      // Refund price is based on the actual discounted line total.
      const refundCents = Math.round(
        (lineTotalCents * Math.round(qty * 1000)) / saleQtyMilli
      );

      if (refundCents < 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid refund amount",
        });
      }

      totalRefundCents += refundCents;

      preparedItems.push({
        tenantId,
        saleItemId,
        productId: saleItem.productId,
        quantity: qty,
        unitRefundPrice: refundCents / 100 / qty,
        totalRefundAmount: refundCents / 100,
        condition,
        restock,
        note: item.note || "",
      });
    }

    const returnNumber =
      `RET-${Date.now()}-${new mongoose.Types.ObjectId().toString().slice(-6)}`;

    const salesReturn = await SalesReturn.create({
      tenantId,
      saleId,
      returnNumber,
      customerId: sale.customerId || null,
      reason,
      note,
      totalRefundAmount: totalRefundCents / 100,
      refundStatus: "PENDING",
      status: "DRAFT",
      processedBy,
    });

    const returnItems = await SalesReturnItem.insertMany(
      preparedItems.map((item) => ({
        ...item,
        salesReturnId: salesReturn._id,
      }))
    );

    return res.status(201).json({
      success: true,
      message: "Sales return draft created successfully",
      data: {
        salesReturn,
        items: returnItems,
      },
    });
  } catch (error) {
    console.error("Create sales return error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create sales return",
    });
  }
};



const processSalesReturn = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { returnId } = req.params;
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    if (!mongoose.isValidObjectId(returnId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sales return ID",
      });
    }

    let result;

    await session.withTransaction(async () => {
      const salesReturn = await SalesReturn.findOne({
        _id: returnId,
        tenantId,
        status: "DRAFT",
      }).session(session);

      if (!salesReturn) {
        const error = new Error(
          "Draft sales return not found or already processed"
        );
        error.statusCode = 404;
        throw error;
      }

      const sale = await Sale.findOne({
        _id: salesReturn.saleId,
        tenantId,
        status: "COMPLETED",
      }).session(session);

      if (!sale) {
        const error = new Error("Completed sale not found");
        error.statusCode = 404;
        throw error;
      }

      const returnItems = await SalesReturnItem.find({
        tenantId,
        salesReturnId: salesReturn._id,
      }).session(session);

      if (!returnItems.length) {
        const error = new Error("Sales return has no items");
        error.statusCode = 400;
        throw error;
      }

      // Validate all items before changing stock.
      for (const item of returnItems) {
        if (item.restock && item.condition !== "GOOD") {
          const error = new Error(
            "Only items in GOOD condition can be restocked"
          );
          error.statusCode = 400;
          throw error;
        }

        const saleItem = await SaleItem.findOne({
          _id: item.saleItemId,
          tenantId,
          saleId: salesReturn.saleId,
          productId: item.productId,
        }).session(session);

        if (!saleItem) {
          const error = new Error("Related sale item not found");
          error.statusCode = 400;
          throw error;
        }

        const completedReturns = await SalesReturn.find({
          tenantId,
          saleId: salesReturn.saleId,
          status: "COMPLETED",
          _id: { $ne: salesReturn._id },
        })
          .select("_id")
          .session(session);

        const completedReturnIds = completedReturns.map(
          (record) => record._id
        );

        const previousItems = completedReturnIds.length
          ? await SalesReturnItem.find({
              tenantId,
              salesReturnId: { $in: completedReturnIds },
              saleItemId: item.saleItemId,
            }).session(session)
          : [];

        const alreadyReturned = previousItems.reduce(
          (sum, record) => sum + Number(record.quantity),
          0
        );

        const allItemsInThisDraft = returnItems
          .filter(
            (record) =>
              record.saleItemId.toString() === item.saleItemId.toString()
          )
          .reduce((sum, record) => sum + Number(record.quantity), 0);

        if (
          alreadyReturned + allItemsInThisDraft >
          Number(saleItem.quantity) + 0.000001
        ) {
          const error = new Error(
            "Return quantity exceeds the remaining sold quantity"
          );
          error.statusCode = 400;
          throw error;
        }
      }

      // Process stock returns.
      for (const item of returnItems) {
        if (!item.restock) continue;

        const soldBatchAllocations = await SaleItemBatch.find({
          tenantId,
          saleId: salesReturn.saleId,
          saleItemId: item.saleItemId,
          productId: item.productId,
        })
          .sort({ createdAt: 1, _id: 1 })
          .session(session);

        if (!soldBatchAllocations.length) {
          const error = new Error(
            "Original sale batch allocation not found"
          );
          error.statusCode = 400;
          throw error;
        }

        // Subtract quantities already returned to each original batch.
        const priorCompletedReturns = await SalesReturn.find({
          tenantId,
          saleId: salesReturn.saleId,
          status: "COMPLETED",
          _id: { $ne: salesReturn._id },
        })
          .select("_id")
          .session(session);

        const priorReturnIds = priorCompletedReturns.map(
          (record) => record._id
        );

        const priorReturnItems = priorReturnIds.length
          ? await SalesReturnItem.find({
              tenantId,
              salesReturnId: { $in: priorReturnIds },
              saleItemId: item.saleItemId,
              restock: true,
            }).session(session)
          : [];

        let quantityToAllocate = Number(item.quantity);

        for (const allocation of soldBatchAllocations) {
          if (quantityToAllocate <= 0.000001) break;

          const alreadyReturnedToBatch = priorReturnItems
            .filter(
              (record) =>
                record.inventoryBatchId &&
                record.inventoryBatchId.toString() ===
                  allocation.batchId.toString()
            )
            .reduce((sum, record) => sum + Number(record.quantity), 0);

          const remainingFromBatch = Math.max(
            0,
            Number(allocation.quantity) - alreadyReturnedToBatch
          );

          const quantity = Math.min(
            quantityToAllocate,
            remainingFromBatch
          );

          if (quantity <= 0) continue;

          const batch = await InventoryBatch.findOne({
            _id: allocation.batchId,
            tenantId,
            productId: item.productId,
          }).session(session);

          if (!batch) {
            const error = new Error(
              "Original inventory batch not found"
            );
            error.statusCode = 400;
            throw error;
          }

          const product = await Product.findOne({
            _id: item.productId,
            tenantId,
          }).session(session);

          if (!product) {
            const error = new Error("Product not found");
            error.statusCode = 404;
            throw error;
          }

          const previousBatchStock = Number(batch.quantity);
          const previousProductStock = Number(
            product.inventory.currentStock
          );

          batch.quantity = previousBatchStock + quantity;
          batch.status =
            batch.expiryDate && batch.expiryDate < new Date()
              ? "EXPIRED"
              : "ACTIVE";

          product.inventory.currentStock =
            previousProductStock + quantity;

          await batch.save({ session });
          await product.save({ session });

          await StockMovement.create(
            [
              {
                tenantId,
                productId: item.productId,
                batchId: batch._id,
                movementType: "RETURN_IN",
                quantity,
                previousStock: previousProductStock,
                newStock: product.inventory.currentStock,
                referenceType: "RETURN",
                referenceId: salesReturn._id,
                note: `Sales return ${salesReturn.returnNumber}`,
                performedBy: userId,
              },
            ],
            { session }
          );

          item.inventoryBatchId = batch._id;
          await item.save({ session });

          quantityToAllocate -= quantity;
        }

        if (quantityToAllocate > 0.000001) {
          const error = new Error(
            "Return quantity exceeds the quantity allocated to original batches"
          );
          error.statusCode = 400;
          throw error;
        }
      }

      salesReturn.status = "COMPLETED";
      // Inventory processing does not itself prove that money was refunded.
      salesReturn.refundStatus = "PENDING";

      await salesReturn.save({ session });

      result = {
        salesReturn,
        items: returnItems,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Sales return processed successfully",
      data: result,
    });
  } catch (error) {
    console.error("Process sales return error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to process sales return",
    });
  } finally {
    await session.endSession();
  }
};


module.exports = {
  createSalesReturn,
    processSalesReturn,
};
