
const mongoose = require("mongoose");

const saleItemBatchSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },

    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
      index: true,
    },

    saleItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SaleItem",
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

    quantity: {
      type: Number,
      required: true,
      min: 0.01,
    },

    unitCost: {
      type: Number,
      required: true,
      min: 0,
    },

    unitSellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

saleItemBatchSchema.index({
  tenantId: 1,
  saleId: 1,
  saleItemId: 1,
});

module.exports = mongoose.model(
  "SaleItemBatch",
  saleItemBatchSchema
);
