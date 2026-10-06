const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      default: null,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    barcode: {
      type: String,
      trim: true,
      default: null,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    productType: {
      type: String,
      enum: ["FOOD", "NON_FOOD"],
      default: "NON_FOOD",
    },

    unit: {
      type: String,
      enum: [
        "PCS",
        "KG",
        "G",
        "L",
        "ML",
        "BOX",
        "PACK",
        "BOTTLE",
        "CAN",
        "BAG",
        "OTHER",
      ],
      default: "PCS",
    },

    pricing: {
      costPrice: {
        type: Number,
        required: true,
        min: 0,
      },

      sellingPrice: {
        type: Number,
        required: true,
        min: 0,
      },
    },

    inventory: {
      trackStock: {
        type: Boolean,
        default: true,
      },

      currentStock: {
        type: Number,
        default: 0,
        min: 0,
      },

      lowStockThreshold: {
        type: Number,
        default: 5,
        min: 0,
      },
    },

    expiryTracking: {
      enabled: {
        type: Boolean,
        default: false,
      },
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  }
);

// SKU unique within each tenant
productSchema.index(
  { tenantId: 1, sku: 1 },
  { unique: true }
);

// Barcode unique within each tenant
productSchema.index(
  { tenantId: 1, barcode: 1 },
  {
    unique: true,
    partialFilterExpression: {
      barcode: { $type: "string" },
    },
  }
);

// Useful for category/brand filtering
productSchema.index({ tenantId: 1, categoryId: 1 });
productSchema.index({ tenantId: 1, brandId: 1 });

module.exports = mongoose.model("Product", productSchema);