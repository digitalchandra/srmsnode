const mongoose = require("mongoose");

const purchaseItemSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },

    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Purchase",
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

    costPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },

    batchNumber: {
      type: String,
      required: true,
      trim: true,
    },

    manufacturedDate: {
      type: Date,
      default: null,
    },

    expiryDate: {
      type: Date,
      default: null,
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

// Useful for fetching all items of a purchase
purchaseItemSchema.index({
  tenantId: 1,
  purchaseId: 1,
});

// Useful for product purchase history
purchaseItemSchema.index({
  tenantId: 1,
  productId: 1,
  createdAt: -1,
});

module.exports = mongoose.model("PurchaseItem", purchaseItemSchema);