const mongoose = require("mongoose");

const stockAdjustmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryBatch",
      required: true,
      index: true,
    },

    adjustmentType: {
      type: String,
      enum: ["INCREASE", "DECREASE"],
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0.01,
    },

    previousStock: {
      type: Number,
      required: true,
      min: 0,
    },

    newStock: {
      type: Number,
      required: true,
      min: 0,
    },

    reason: {
      type: String,
      enum: [
        "STOCK_COUNT",
        "DAMAGED",
        "EXPIRED",
        "LOST",
        "FOUND",
        "CORRECTION",
        "OTHER",
      ],
      required: true,
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },

    adjustedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

stockAdjustmentSchema.index({
  tenantId: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "StockAdjustment",
  stockAdjustmentSchema
);