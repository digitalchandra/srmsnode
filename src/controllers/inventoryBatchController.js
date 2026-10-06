const InventoryBatch = require("../models/InventoryBatch");
const Product = require("../models/Product");

const createInventoryBatch = async (req, res) => {
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

    // Required fields
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

    // Validate quantity
    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than 0",
      });
    }

    // Validate cost price
    if (costPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Cost price cannot be negative",
      });
    }

    // Find product belonging to current tenant
    const product = await Product.findOne({
      _id: productId,
      tenantId,
    });

    if (!product) {
      return res.status(400).json({
        success: false,
        message: "Invalid product",
      });
    }

    // Check stock tracking
    if (!product.inventory.trackStock) {
      return res.status(400).json({
        success: false,
        message: "Stock tracking is disabled for this product",
      });
    }

    // Expiry validation
    if (expiryDate && new Date(expiryDate) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Expiry date must be in the future",
      });
    }

    // If expiry tracking is enabled, expiry date is required
    if (product.expiryTracking.enabled && !expiryDate) {
      return res.status(400).json({
        success: false,
        message: "Expiry date is required for this product",
      });
    }

    // Create inventory batch
    const batch = await InventoryBatch.create({
      tenantId,
      productId,
      batchNumber: batchNumber.trim(),
      quantity,
      costPrice,
      manufacturedDate: manufacturedDate || null,
      expiryDate: expiryDate || null,
      status: "ACTIVE",
    });

    // Increase product stock
    product.inventory.currentStock += quantity;

    await product.save();

    return res.status(201).json({
      success: true,
      message: "Inventory batch created successfully",
      data: {
        batch,
        stock: {
          previousStock: product.inventory.currentStock - quantity,
          addedQuantity: quantity,
          currentStock: product.inventory.currentStock,
        },
      },
    });
  } catch (error) {
    // Duplicate batch
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

module.exports = {
  createInventoryBatch,
  getInventoryBatches,
  getInventoryBatch,
};