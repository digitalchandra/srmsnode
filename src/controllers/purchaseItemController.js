const mongoose = require("mongoose");
const Purchase = require("../models/Purchase");
const PurchaseItem = require("../models/PurchaseItem");

const Product = require("../models/Product");


const addPurchaseItem = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const { purchaseId } = req.params;

    const {
      productId,
      quantity,
      costPrice,
      batchNumber,
      manufacturedDate,
      expiryDate,
      note,
    } = req.body;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(purchaseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid purchase ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    // Validate required fields
    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than 0",
      });
    }

    if (costPrice === undefined || costPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid cost price is required",
      });
    }

    if (!batchNumber || !batchNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: "Batch number is required",
      });
    }

    // Find purchase belonging to current tenant
    const purchase = await Purchase.findOne({
      _id: purchaseId,
      tenantId,
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    // Only DRAFT purchases can receive items
    if (purchase.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message: "Items can only be added to a draft purchase",
      });
    }

    // Find product belonging to current tenant
    const product = await Product.findOne({
      _id: productId,
      tenantId,
      status: "ACTIVE",
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Active product not found",
      });
    }

    // Expiry required for products with expiry tracking
    if (
      product.expiryTracking?.enabled &&
      !expiryDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Expiry date is required for this product",
      });
    }

    // Validate expiry date
    if (expiryDate && manufacturedDate) {
      if (new Date(expiryDate) <= new Date(manufacturedDate)) {
        return res.status(400).json({
          success: false,
          message: "Expiry date must be after manufactured date",
        });
      }
    }

    // Calculate line total
    const lineTotal = Number(quantity) * Number(costPrice);

    // Create purchase item
    const purchaseItem = await PurchaseItem.create({
      tenantId,
      purchaseId,
      productId,
      quantity,
      costPrice,
      lineTotal,
      batchNumber: batchNumber.trim(),
      manufacturedDate: manufacturedDate || null,
      expiryDate: expiryDate || null,
      note: note || "",
    });

    // Recalculate purchase totals
    const items = await PurchaseItem.find({
      tenantId,
      purchaseId,
    });

    const subtotal = items.reduce(
      (total, item) => total + item.lineTotal,
      0
    );

    purchase.subtotal = subtotal;

    const taxAmount = Number(purchase.taxAmount || 0);
    const discountAmount = Number(purchase.discountAmount || 0);

    purchase.totalAmount =
      subtotal + taxAmount - discountAmount;

    await purchase.save();

    return res.status(201).json({
      success: true,
      message: "Purchase item added successfully",
      data: {
        purchaseItem,
        purchaseSummary: {
          subtotal: purchase.subtotal,
          taxAmount: purchase.taxAmount,
          discountAmount: purchase.discountAmount,
          totalAmount: purchase.totalAmount,
        },
      },
    });
  } catch (error) {
    console.error("Add purchase item error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add purchase item",
    });
  }
};

module.exports = {
  addPurchaseItem,
};