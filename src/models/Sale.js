const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },

    saleNumber: {
      type: String,
      required: true,
      trim: true,
    },

    saleDate: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ["DRAFT", "COMPLETED", "CANCELLED"],
      default: "DRAFT",
    },

    subtotal: {
      type: Number,
      min: 0,
      default: 0,
    },

    discountAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    taxAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    totalAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    paidAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PARTIAL", "PAID"],
      default: "UNPAID",
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Sale number must be unique within a tenant
saleSchema.index(
  { tenantId: 1, saleNumber: 1 },
  { unique: true }
);

saleSchema.index({
  tenantId: 1,
  saleDate: -1,
});

saleSchema.index({
  tenantId: 1,
  customerId: 1,
  saleDate: -1,
});

module.exports = mongoose.model("Sale", saleSchema);