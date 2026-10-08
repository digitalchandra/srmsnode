const mongoose = require("mongoose");

const stockMovementSchema = new mongoose.Schema(
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
      default: null,
      index: true,
    },

    movementType: {
      type: String,
      enum: [
        "STOCK_IN",
        "STOCK_OUT",
        "ADJUSTMENT_IN",
        "ADJUSTMENT_OUT",
        "RETURN_IN",
        "RETURN_OUT",
      ],
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

    referenceType: {
      type: String,
      enum: [
        "PURCHASE",
        "SALE",
        "ADJUSTMENT",
        "RETURN",
        "MANUAL",
      ],
      required: true,
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

stockMovementSchema.index({
  tenantId: 1,
  productId: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "StockMovement",
  stockMovementSchema
);