const mongoose = require("mongoose");

const inventoryBatchSchema = new mongoose.Schema(
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

    batchNumber: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    costPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    manufacturedDate: {
      type: Date,
      default: null,
    },

    expiryDate: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "EXPIRED", "DEPLETED"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  }
);

inventoryBatchSchema.index(
  { tenantId: 1, productId: 1, batchNumber: 1 },
  { unique: true }
);

inventoryBatchSchema.index({
  tenantId: 1,
  expiryDate: 1,
});

module.exports = mongoose.model(
  "InventoryBatch",
  inventoryBatchSchema
);