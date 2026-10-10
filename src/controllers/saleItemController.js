
const mongoose = require("mongoose");
const Sale = require("../models/Sale");
const SaleItem = require("../models/SaleItem");
const Product = require("../models/Product");

const addSaleItem = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { saleId } = req.params;

    const {
      productId,
      quantity,
      unitPrice,
      discountAmount = 0,
      note = "",
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(saleId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    if (
      typeof quantity !== "number" ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than zero",
      });
    }

    if (
      typeof discountAmount !== "number" ||
      !Number.isFinite(discountAmount) ||
      discountAmount < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Discount cannot be negative",
      });
    }

    const sale = await Sale.findOne({
      _id: saleId,
      tenantId,
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    if (sale.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message: "Only draft sales can be modified",
      });
    }

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

    const price =
      unitPrice === undefined
        ? product.pricing.sellingPrice
        : unitPrice;

    if (
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Unit price must be a non-negative number",
      });
    }

    const grossTotal = quantity * price;

    if (!Number.isFinite(grossTotal) || discountAmount > grossTotal) {
      return res.status(400).json({
        success: false,
        message: "Item discount cannot exceed its gross total",
      });
    }

    const lineTotal = grossTotal - discountAmount;

    const item = await SaleItem.create({
      tenantId,
      saleId: sale._id,
      productId: product._id,
      quantity,
      unitPrice: price,
      discountAmount,
      lineTotal,
      note,
    });

    const items = await SaleItem.find({
      tenantId,
      saleId: sale._id,
    });

    sale.subtotal = items.reduce(
      (sum, current) => sum + current.lineTotal,
      0
    );

    const total =
      sale.subtotal +
      sale.taxAmount -
      sale.discountAmount;

    if (total < 0) {
      await SaleItem.deleteOne({ _id: item._id, tenantId });
      sale.subtotal -= item.lineTotal;
      return res.status(400).json({
        success: false,
        message: "Sale discount cannot exceed subtotal plus tax",
      });
    }

    sale.totalAmount = total;
    await sale.save();

    return res.status(201).json({
      success: true,
      message: "Sale item added successfully",
      data: {
        item,
        saleSummary: {
          subtotal: sale.subtotal,
          discountAmount: sale.discountAmount,
          taxAmount: sale.taxAmount,
          totalAmount: sale.totalAmount,
        },
      },
    });
  } catch (error) {
    console.error("Add sale item error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add sale item",
    });
  }
};


const getSaleItems = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { saleId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(saleId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale ID",
      });
    }

    const sale = await Sale.findOne({
      _id: saleId,
      tenantId,
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    const items = await SaleItem.find({
      tenantId,
      saleId,
    }).populate("productId", "name sku barcode pricing");

    return res.status(200).json({
      success: true,
      data: {
        sale,
        items,
      },
    });
  } catch (error) {
    console.error("Get sale items error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get sale items",
    });
  }
};

const getSale = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale ID",
      });
    }

    const sale = await Sale.findOne({
      _id: id,
      tenantId,
    })
      .populate("customerId", "name phone email")
      .populate("createdBy", "name email role");

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    const items = await SaleItem.find({
      tenantId,
      saleId: sale._id,
    }).populate("productId", "name sku barcode pricing");

    return res.status(200).json({
      success: true,
      data: {
        sale,
        items,
      },
    });
  } catch (error) {
    console.error("Get sale error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get sale",
    });
  }
};


const updateSaleItem = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { saleId, itemId } = req.params;

    const {
      quantity,
      unitPrice,
      discountAmount,
      note,
    } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(saleId) ||
      !mongoose.Types.ObjectId.isValid(itemId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale or item ID",
      });
    }

    const sale = await Sale.findOne({
      _id: saleId,
      tenantId,
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    if (sale.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message: "Only draft sales can be modified",
      });
    }

    const item = await SaleItem.findOne({
      _id: itemId,
      saleId,
      tenantId,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Sale item not found",
      });
    }

    const newQuantity =
      quantity === undefined ? item.quantity : quantity;

    const newPrice =
      unitPrice === undefined ? item.unitPrice : unitPrice;

    const newDiscount =
      discountAmount === undefined
        ? item.discountAmount
        : discountAmount;

    if (
      typeof newQuantity !== "number" ||
      !Number.isFinite(newQuantity) ||
      newQuantity <= 0 ||
      typeof newPrice !== "number" ||
      !Number.isFinite(newPrice) ||
      newPrice < 0 ||
      typeof newDiscount !== "number" ||
      !Number.isFinite(newDiscount) ||
      newDiscount < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid quantity, price, or discount",
      });
    }

    const grossTotal = newQuantity * newPrice;

    if (
      !Number.isFinite(grossTotal) ||
      newDiscount > grossTotal
    ) {
      return res.status(400).json({
        success: false,
        message: "Item discount cannot exceed gross total",
      });
    }

    const newLineTotal = grossTotal - newDiscount;

    const otherItems = await SaleItem.find({
      tenantId,
      saleId,
      _id: { $ne: itemId },
    }).select("lineTotal");

    const newSubtotal =
      otherItems.reduce(
        (sum, current) => sum + current.lineTotal,
        0
      ) + newLineTotal;

    const newTotal =
      newSubtotal + sale.taxAmount - sale.discountAmount;

    if (newTotal < 0) {
      return res.status(400).json({
        success: false,
        message: "Sale discount cannot exceed subtotal plus tax",
      });
    }

    item.quantity = newQuantity;
    item.unitPrice = newPrice;
    item.discountAmount = newDiscount;
    item.lineTotal = newLineTotal;

    if (note !== undefined) {
      item.note = note;
    }

    await item.save();

    sale.subtotal = newSubtotal;
    sale.totalAmount = newTotal;
    await sale.save();

    return res.status(200).json({
      success: true,
      message: "Sale item updated successfully",
      data: {
        item,
        saleSummary: {
          subtotal: sale.subtotal,
          discountAmount: sale.discountAmount,
          taxAmount: sale.taxAmount,
          totalAmount: sale.totalAmount,
        },
      },
    });
  } catch (error) {
    console.error("Update sale item error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update sale item",
    });
  }
};


const deleteSaleItem = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { saleId, itemId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(saleId) ||
      !mongoose.Types.ObjectId.isValid(itemId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale or item ID",
      });
    }

    const sale = await Sale.findOne({
      _id: saleId,
      tenantId,
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    if (sale.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message: "Only draft sales can be modified",
      });
    }

    const item = await SaleItem.findOne({
      _id: itemId,
      saleId,
      tenantId,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Sale item not found",
      });
    }

    const newSubtotal = Math.max(
      0,
      sale.subtotal - item.lineTotal
    );

    const newTotal =
      newSubtotal + sale.taxAmount - sale.discountAmount;

    if (newTotal < 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete item because sale discount exceeds remaining subtotal plus tax",
      });
    }

    await SaleItem.deleteOne({
      _id: itemId,
      saleId,
      tenantId,
    });

    sale.subtotal = newSubtotal;
    sale.totalAmount = newTotal;
    await sale.save();

    return res.status(200).json({
      success: true,
      message: "Sale item deleted successfully",
      data: {
        saleSummary: {
          subtotal: sale.subtotal,
          discountAmount: sale.discountAmount,
          taxAmount: sale.taxAmount,
          totalAmount: sale.totalAmount,
        },
      },
    });
  } catch (error) {
    console.error("Delete sale item error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete sale item",
    });
  }
};


module.exports = {
    addSaleItem,
    getSaleItems,
    getSale,
    updateSaleItem,
    deleteSaleItem,
}; 