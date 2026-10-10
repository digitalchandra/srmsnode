
const mongoose = require("mongoose");

const salesReturnItemSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },

    salesReturnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesReturn",
      required: true,
      index: true,
    },

    saleItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SaleItem",
      required: true,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0.001,
    },

    unitRefundPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    totalRefundAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    condition: {
      type: String,
      enum: ["GOOD", "DAMAGED", "EXPIRED"],
      required: true,
    },

    restock: {
      type: Boolean,
      default: false,
    },

    inventoryBatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryBatch",
      default: null,
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

salesReturnItemSchema.index({
  tenantId: 1,
  salesReturnId: 1,
});

module.exports = mongoose.model(
  "SalesReturnItem",
  salesReturnItemSchema
);
