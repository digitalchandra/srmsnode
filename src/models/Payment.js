
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
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

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    paymentMethod: {
      type: String,
      enum: [
        "CASH",
        "CARD",
        "BANK_TRANSFER",
        "MOBILE_PAYMENT",
        "OTHER",
      ],
      required: true,
    },

    paymentDate: {
      type: Date,
      default: Date.now,
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

    receivedBy: {
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

paymentSchema.index({
  tenantId: 1,
  saleId: 1,
  paymentDate: -1,
});

module.exports = mongoose.model("Payment", paymentSchema);
