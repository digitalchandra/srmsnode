const mongoose = require("mongoose");

const saleItemSchema = new mongoose.Schema(
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

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0.01,
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    discountAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

saleItemSchema.index({
  tenantId: 1,
  saleId: 1,
});

saleItemSchema.index({
  tenantId: 1,
  productId: 1,
  createdAt: -1,
});

module.exports = mongoose.model("SaleItem", saleItemSchema);