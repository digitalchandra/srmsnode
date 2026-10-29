
const mongoose = require("mongoose");

const refundSchema = new mongoose.Schema(
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

    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    refundMethod: {
      type: String,
      enum: ["CASH", "CARD", "BANK_TRANSFER", "MOBILE_PAYMENT", "STORE_CREDIT", "OTHER"],
      required: true,
    },

    referenceNumber: {
      type: String,
      trim: true,
      default: "",
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },

    refundDate: {
      type: Date,
      default: Date.now,
    },

    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["COMPLETED", "VOIDED"],
      default: "COMPLETED",
    },
  },
  {
    timestamps: true,
  }
);

refundSchema.index({
  tenantId: 1,
  salesReturnId: 1,
  refundDate: -1,
});

refundSchema.index({
  tenantId: 1,
  saleId: 1,
  refundDate: -1,
});

module.exports = mongoose.model("Refund", refundSchema);
