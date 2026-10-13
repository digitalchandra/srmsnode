const mongoose = require("mongoose");

const salesReturnItemBatchSchema = new mongoose.Schema(
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
    },
    salesReturnItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesReturnItem",
      required: true,
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
    inventoryBatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryBatch",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.001,
    },
  },
  { timestamps: true }
);

// Prevent duplicate allocation records for the same
// return item and inventory batch.
salesReturnItemBatchSchema.index(
  {
    tenantId: 1,
    salesReturnItemId: 1,
    inventoryBatchId: 1,
  },
  { unique: true }
);

salesReturnItemBatchSchema.index({
  tenantId: 1,
  salesReturnId: 1,
});

module.exports = mongoose.model(
  "SalesReturnItemBatch",
  salesReturnItemBatchSchema
);