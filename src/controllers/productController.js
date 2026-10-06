const Product = require("../models/Product");
const Category = require("../models/Category");
const Brand = require("../models/Brand");

const createProduct = async (req, res) => {
  try {
    const {
      categoryId,
      brandId,
      name,
      sku,
      barcode,
      description,
      productType,
      unit,
      costPrice,
      sellingPrice,
      trackStock,
      lowStockThreshold,
      expiryTracking,
    } = req.body || {};

    const tenantId = req.user.tenantId;

    if (
      !categoryId ||
      !name ||
      !sku ||
      costPrice === undefined ||
      sellingPrice === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Category, name, SKU, cost price and selling price are required",
      });
    }

    // -----------------------------
    // Verify category belongs to tenant
    // -----------------------------

    const category = await Category.findOne({
      _id: categoryId,
      tenantId,
    });

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Invalid category",
      });
    }

    // -----------------------------
    // Verify brand belongs to tenant
    // -----------------------------

    if (brandId) {
      const brand = await Brand.findOne({
        _id: brandId,
        tenantId,
      });

      if (!brand) {
        return res.status(400).json({
          success: false,
          message: "Invalid brand",
        });
      }
    }

    // -----------------------------
    // Create product
    // -----------------------------

    const product = await Product.create({
      tenantId,
      categoryId,
      brandId: brandId || null,
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      barcode: barcode?.trim() || null,
      description: description?.trim() || "",
      productType: productType || "NON_FOOD",
      unit: unit || "PCS",

      pricing: {
        costPrice,
        sellingPrice,
      },

      inventory: {
        trackStock: trackStock ?? true,
        currentStock: 0,
        lowStockThreshold: lowStockThreshold ?? 5,
      },

      expiryTracking: {
        enabled: expiryTracking ?? false,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern?.sku) {
        return res.status(409).json({
          success: false,
          message: "SKU already exists",
        });
      }

      if (error.keyPattern?.barcode) {
        return res.status(409).json({
          success: false,
          message: "Barcode already exists",
        });
      }
    }

    console.error("Create product error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create product",
    });
  }
};

module.exports = {
  createProduct,
};