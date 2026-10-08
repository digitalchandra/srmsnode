const mongoose = require("mongoose");
const InventoryBatch = require("../models/InventoryBatch");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");

const createInventoryBatch = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const {
      productId,
      batchNumber,
      quantity,
      costPrice,
      manufacturedDate,
      expiryDate,
    } = req.body || {};

    const tenantId = req.user.tenantId;

    if (
      !productId ||
      !batchNumber ||
      quantity === undefined ||
      costPrice === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Product, batch number, quantity and cost price are required",
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than 0",
      });
    }

    if (costPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Cost price cannot be negative",
      });
    }

    if (expiryDate && new Date(expiryDate) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Expiry date must be in the future",
      });
    }

    session.startTransaction();

    const product = await Product.findOne({
      _id: productId,
      tenantId,
    }).session(session);

    if (!product) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "Invalid product",
      });
    }

    if (!product.inventory.trackStock) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "Stock tracking is disabled for this product",
      });
    }

    if (product.expiryTracking.enabled && !expiryDate) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "Expiry date is required for this product",
      });
    }

    const previousStock = product.inventory.currentStock;
    const newStock = previousStock + quantity;

    const [batch] = await InventoryBatch.create(
      [
        {
          tenantId,
          productId,
          batchNumber: batchNumber.trim(),
          quantity,
          costPrice,
          manufacturedDate: manufacturedDate || null,
          expiryDate: expiryDate || null,
          status: "ACTIVE",
        },
      ],
      { session }
    );

    product.inventory.currentStock = newStock;

    await product.save({ session });

    await StockMovement.create(
      [
        {
          tenantId,
          productId,
          batchId: batch._id,
          movementType: "STOCK_IN",
          quantity,
          previousStock,
          newStock,
          referenceType: "PURCHASE",
          referenceId: null,
          note: `Stock added through batch ${batch.batchNumber}`,
          performedBy: req.user.userId,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: "Inventory batch created successfully",
      data: {
        batch,
        stock: {
          previousStock,
          addedQuantity: quantity,
          currentStock: newStock,
        },
      },
    });
  } catch (error) {
    await session.abortTransaction();

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Batch number already exists for this product",
      });
    }

    console.error("Create inventory batch error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create inventory batch",
    });
  } finally {
    await session.endSession();
  }
};

const getInventoryBatches = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const batches = await InventoryBatch.find({
      tenantId,
    })
      .populate("productId", "name sku barcode unit")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: batches.length,
      data: batches,
    });
  } catch (error) {
    console.error("Get inventory batches error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch inventory batches",
    });
  }
};

const getInventoryBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const batch = await InventoryBatch.findOne({
      _id: id,
      tenantId,
    }).populate(
      "productId",
      "name sku barcode unit pricing inventory expiryTracking"
    );

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Inventory batch not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: batch,
    });
  } catch (error) {
    console.error("Get inventory batch error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch inventory batch",
    });
  }
};

const getExpiryBatches = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const days = Number(req.query.days) || 30;

    if (days < 1 || days > 365) {
      return res.status(400).json({
        success: false,
        message: "Days must be between 1 and 365",
      });
    }

    const now = new Date();

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + days);

    const batches = await InventoryBatch.find({
      tenantId,
      status: "ACTIVE",
      expiryDate: {
        $ne: null,
        $lte: futureDate,
      },
    })
      .populate("productId", "name sku barcode unit")
      .sort({ expiryDate: 1 });

    const data = batches.map((batch) => {
      const expiryDate = new Date(batch.expiryDate);

      const differenceMs = expiryDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(
        differenceMs / (1000 * 60 * 60 * 24)
      );

      let expiryStatus;

      if (daysRemaining < 0) {
        expiryStatus = "EXPIRED";
      } else if (daysRemaining <= 7) {
        expiryStatus = "CRITICAL";
      } else {
        expiryStatus = "EXPIRING_SOON";
      }

      return {
        _id: batch._id,
        product: batch.productId,
        batchNumber: batch.batchNumber,
        quantity: batch.quantity,
        expiryDate: batch.expiryDate,
        daysRemaining,
        expiryStatus,
      };
    });

    return res.status(200).json({
      success: true,
      count: data.length,
      days,
      data,
    });
  } catch (error) {
    console.error("Get expiry batches error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch expiry batches",
    });
  }
};

module.exports = {
  createInventoryBatch,
  getInventoryBatches,
  getInventoryBatch,
  getExpiryBatches,
};