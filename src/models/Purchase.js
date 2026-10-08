const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },

    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },

    purchaseNumber: {
      type: String,
      required: true,
      trim: true,
    },

    invoiceNumber: {
      type: String,
      trim: true,
      default: "",
    },

    purchaseDate: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ["DRAFT", "RECEIVED", "CANCELLED"],
      default: "DRAFT",
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    taxAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    discountAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
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

// Purchase number must be unique within a tenant
purchaseSchema.index(
  { tenantId: 1, purchaseNumber: 1 },
  { unique: true }
);

// Useful for supplier purchase history
purchaseSchema.index({
  tenantId: 1,
  supplierId: 1,
  purchaseDate: -1,
});

// Useful for purchase reports
purchaseSchema.index({
  tenantId: 1,
  purchaseDate: -1,
});

module.exports = mongoose.model("Purchase", purchaseSchema);