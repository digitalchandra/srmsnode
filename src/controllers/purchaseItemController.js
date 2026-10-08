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

// purchase item list 

const getPurchaseItems = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { purchaseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(purchaseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid purchase ID",
      });
    }

    // Check purchase belongs to current tenant
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

    const items = await PurchaseItem.find({
      tenantId,
      purchaseId,
    })
      .populate(
        "productId",
        "name sku barcode unit productType pricing"
      )
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    console.error("Get purchase items error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch purchase items",
    });
  }
};

// update purchase item and recalculate purchase totals

const updatePurchaseItem = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { purchaseId, itemId } = req.params;

    const {
      quantity,
      costPrice,
      batchNumber,
      manufacturedDate,
      expiryDate,
      note,
    } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(purchaseId) ||
      !mongoose.Types.ObjectId.isValid(itemId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid purchase or item ID",
      });
    }

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

    if (purchase.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message: "Only draft purchases can be modified",
      });
    }

    const item = await PurchaseItem.findOne({
      _id: itemId,
      purchaseId,
      tenantId,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Purchase item not found",
      });
    }

    if (quantity !== undefined) {
      if (quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Quantity must be greater than 0",
        });
      }

      item.quantity = quantity;
    }

    if (costPrice !== undefined) {
      if (costPrice < 0) {
        return res.status(400).json({
          success: false,
          message: "Cost price cannot be negative",
        });
      }

      item.costPrice = costPrice;
    }

    if (batchNumber !== undefined) {
      if (!batchNumber.trim()) {
        return res.status(400).json({
          success: false,
          message: "Batch number cannot be empty",
        });
      }

      item.batchNumber = batchNumber.trim();
    }

    if (manufacturedDate !== undefined) {
      item.manufacturedDate = manufacturedDate || null;
    }

    if (expiryDate !== undefined) {
      item.expiryDate = expiryDate || null;
    }

    if (
      item.expiryDate &&
      item.manufacturedDate &&
      new Date(item.expiryDate) <= new Date(item.manufacturedDate)
    ) {
      return res.status(400).json({
        success: false,
        message: "Expiry date must be after manufactured date",
      });
    }

    if (note !== undefined) {
      item.note = note;
    }

    // Recalculate line total
    item.lineTotal = item.quantity * item.costPrice;

    await item.save();

    // Recalculate purchase totals
    const items = await PurchaseItem.find({
      tenantId,
      purchaseId,
    });

    const subtotal = items.reduce(
      (total, currentItem) => total + currentItem.lineTotal,
      0
    );

    purchase.subtotal = subtotal;

    const taxAmount = Number(purchase.taxAmount || 0);
    const discountAmount = Number(purchase.discountAmount || 0);

    purchase.totalAmount =
      subtotal + taxAmount - discountAmount;

    await purchase.save();

    return res.status(200).json({
      success: true,
      message: "Purchase item updated successfully",
      data: {
        item,
        purchaseSummary: {
          subtotal: purchase.subtotal,
          taxAmount: purchase.taxAmount,
          discountAmount: purchase.discountAmount,
          totalAmount: purchase.totalAmount,
        },
      },
    });
  } catch (error) {
    console.error("Update purchase item error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update purchase item",
    });
  }
};

// delete purchase item and recalculate purchase totals

const deletePurchaseItem = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { purchaseId, itemId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(purchaseId) ||
      !mongoose.Types.ObjectId.isValid(itemId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid purchase or item ID",
      });
    }

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

    if (purchase.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message: "Only draft purchases can be modified",
      });
    }

    const item = await PurchaseItem.findOne({
      _id: itemId,
      purchaseId,
      tenantId,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Purchase item not found",
      });
    }

    await PurchaseItem.deleteOne({
      _id: itemId,
      purchaseId,
      tenantId,
    });

    // Recalculate purchase totals
    const remainingItems = await PurchaseItem.find({
      tenantId,
      purchaseId,
    });

    const subtotal = remainingItems.reduce(
      (total, currentItem) => total + currentItem.lineTotal,
      0
    );

    purchase.subtotal = subtotal;

    const taxAmount = Number(purchase.taxAmount || 0);
    const discountAmount = Number(purchase.discountAmount || 0);

    purchase.totalAmount =
      subtotal + taxAmount - discountAmount;

    await purchase.save();

    return res.status(200).json({
      success: true,
      message: "Purchase item deleted successfully",
      data: {
        deletedItemId: itemId,
        purchaseSummary: {
          subtotal: purchase.subtotal,
          taxAmount: purchase.taxAmount,
          discountAmount: purchase.discountAmount,
          totalAmount: purchase.totalAmount,
        },
      },
    });
  } catch (error) {
    console.error("Delete purchase item error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete purchase item",
    });
  }
};

//


module.exports = {
  addPurchaseItem,
  getPurchaseItems,
  updatePurchaseItem,
  deletePurchaseItem,
};