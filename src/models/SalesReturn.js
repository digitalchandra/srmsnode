
const mongoose = require("mongoose");

const salesReturnSchema = new mongoose.Schema(
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

    returnNumber: {
      type: String,
      required: true,
      trim: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    returnDate: {
      type: Date,
      default: Date.now,
    },

    reason: {
      type: String,
      enum: [
        "CUSTOMER_REQUEST",
        "DAMAGED",
        "WRONG_ITEM",
        "EXPIRED",
        "OTHER",
      ],
      required: true,
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },

    totalRefundAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    refundStatus: {
      type: String,
      enum: ["PENDING", "REFUNDED", "STORE_CREDIT", "REJECTED"],
      default: "PENDING",
    },

    status: {
      type: String,
      enum: ["DRAFT", "COMPLETED", "CANCELLED"],
      default: "DRAFT",
    },

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

salesReturnSchema.index(
  { tenantId: 1, returnNumber: 1 },
  { unique: true }
);

salesReturnSchema.index({
  tenantId: 1,
  saleId: 1,
  returnDate: -1,
});

module.exports = mongoose.model("SalesReturn", salesReturnSchema);
