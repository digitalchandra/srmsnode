const mongoose = require("mongoose");
const StockAdjustment = require("../models/StockAdjustment");
const Product = require("../models/Product");
const InventoryBatch = require("../models/InventoryBatch");
const StockMovement = require("../models/StockMovement");

const getStockMovements = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const movements = await StockMovement.find({
      tenantId,
    })
      .populate("productId", "name sku barcode unit")
      .populate("batchId", "batchNumber expiryDate")
      .populate("performedBy", "name email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: movements.length,
      data: movements,
    });
  } catch (error) {
    console.error("Get stock movements error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch stock movements",
    });
  }
};

//--create stock adjustment and stock movement when stock is adjusted
const createStockAdjustment = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const {
      productId,
      batchId,
      adjustmentType,
      quantity,
      reason,
      note,
    } = req.body || {};

    const tenantId = req.user.tenantId;
    const adjustedBy = req.user.userId;

    if (
      !productId ||
      !batchId ||
      !adjustmentType ||
      quantity === undefined ||
      !reason
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Product, batch, adjustment type, quantity and reason are required",
      });
    }

    if (!["INCREASE", "DECREASE"].includes(adjustmentType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid adjustment type",
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Adjustment quantity must be greater than 0",
      });
    }

    session.startTransaction();

    const product = await Product.findOne({
      _id: productId,
      tenantId,
    }).session(session);

    if (!product) {
      await session.abortTransaction();

      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const batch = await InventoryBatch.findOne({
      _id: batchId,
      productId,
      tenantId,
    }).session(session);

    if (!batch) {
      await session.abortTransaction();

      return res.status(404).json({
        success: false,
        message: "Inventory batch not found",
      });
    }

    const previousStock = product.inventory.currentStock;

    let newStock;

    if (adjustmentType === "INCREASE") {
      newStock = previousStock + quantity;
    } else {
      newStock = previousStock - quantity;
    }

    if (newStock < 0) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "Insufficient stock for this adjustment",
      });
    }

    const previousBatchQuantity = batch.quantity;

    if (adjustmentType === "INCREASE") {
      batch.quantity += quantity;
    } else {
      if (batch.quantity < quantity) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message: "Insufficient quantity in this batch",
        });
      }

      batch.quantity -= quantity;
    }

    if (batch.quantity === 0) {
      batch.status = "DEPLETED";
    } else {
      batch.status = "ACTIVE";
    }

    product.inventory.currentStock = newStock;

    await product.save({ session });
    await batch.save({ session });

    const adjustment = await StockAdjustment.create(
      [
        {
          tenantId,
          productId,
          batchId,
          adjustmentType,
          quantity,
          previousStock,
          newStock,
          reason,
          note: note?.trim() || "",
          adjustedBy,
        },
      ],
      { session }
    );

    const movementType =
      adjustmentType === "INCREASE"
        ? "ADJUSTMENT_IN"
        : "ADJUSTMENT_OUT";

    await StockMovement.create(
      [
        {
          tenantId,
          productId,
          batchId,
          movementType,
          quantity,
          previousStock,
          newStock,
          referenceType: "ADJUSTMENT",
          referenceId: adjustment[0]._id,
          note: note?.trim() || "",
          performedBy: adjustedBy,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: "Stock adjustment created successfully",
      data: {
        adjustment: adjustment[0],
        stock: {
          previousStock,
          adjustmentType,
          quantity,
          newStock,
        },
        batch: {
          batchNumber: batch.batchNumber,
          previousQuantity: previousBatchQuantity,
          adjustmentQuantity: quantity,
          currentQuantity: batch.quantity,
          status: batch.status,
        },
      },
    });
  } catch (error) {
    await session.abortTransaction();

    console.error("Create stock adjustment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create stock adjustment",
    });
  } finally {
    await session.endSession();
  }
};

module.exports = {
    getStockMovements,
    createStockAdjustment,
};