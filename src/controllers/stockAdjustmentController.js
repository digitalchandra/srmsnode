const StockAdjustment = require("../models/StockAdjustment");
const Product = require("../models/Product");
const InventoryBatch = require("../models/InventoryBatch");

const createStockAdjustment = async (req, res) => {
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

    // Required fields
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

    // Validate adjustment type
    if (!["INCREASE", "DECREASE"].includes(adjustmentType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid adjustment type",
      });
    }

    // Validate quantity
    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Adjustment quantity must be greater than 0",
      });
    }

    // Find product belonging to tenant
    const product = await Product.findOne({
      _id: productId,
      tenantId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Find batch belonging to tenant and product
    const batch = await InventoryBatch.findOne({
      _id: batchId,
      productId,
      tenantId,
    });

    if (!batch) {
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

    // Prevent negative stock
    if (newStock < 0) {
      return res.status(400).json({
        success: false,
        message: "Insufficient stock for this adjustment",
      });
    }

    // Update product stock
    product.inventory.currentStock = newStock;

    await product.save();

    // Update batch quantity
    if (adjustmentType === "INCREASE") {
      batch.quantity += quantity;
    } else {
      batch.quantity -= quantity;
    }

    // Update batch status
    if (batch.quantity === 0) {
      batch.status = "DEPLETED";
    } else if (batch.status === "DEPLETED") {
      batch.status = "ACTIVE";
    }

    await batch.save();

    // Create adjustment history
    const adjustment = await StockAdjustment.create({
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
    });

    return res.status(201).json({
      success: true,
      message: "Stock adjustment created successfully",
      data: {
        adjustment,
        stock: {
          previousStock,
          adjustmentType,
          quantity,
          newStock,
        },
        batch: {
          batchNumber: batch.batchNumber,
          previousQuantity:
            adjustmentType === "INCREASE"
              ? batch.quantity - quantity
              : batch.quantity + quantity,
          adjustmentQuantity: quantity,
          currentQuantity: batch.quantity,
          status: batch.status,
        },
      },
    });
  } catch (error) {
    console.error("Create stock adjustment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create stock adjustment",
    });
  }
};

const getStockAdjustments = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const adjustments = await StockAdjustment.find({
      tenantId,
    })
      .populate("productId", "name sku barcode unit")
      .populate("batchId", "batchNumber expiryDate")
      .populate("adjustedBy", "name email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: adjustments.length,
      data: adjustments,
    });
  } catch (error) {
    console.error("Get stock adjustments error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch stock adjustments",
    });
  }
};

module.exports = {
  createStockAdjustment,
  getStockAdjustments,
};