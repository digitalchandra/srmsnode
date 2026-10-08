const mongoose = require("mongoose");
const Sale = require("../models/Sale");
const Customer = require("../models/Customer");

// Create Sale
const createSale = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const createdBy = req.user.userId;

    const {
      customerId,
      saleNumber,
      saleDate,
      discountAmount,
      taxAmount,
      note,
    } = req.body;

    if (!saleNumber || !saleNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: "Sale number is required",
      });
    }

    // Check duplicate sale number within tenant
    const existingSale = await Sale.findOne({
      tenantId,
      saleNumber: saleNumber.trim(),
    });

    if (existingSale) {
      return res.status(409).json({
        success: false,
        message: "Sale number already exists",
      });
    }

    // Customer is optional for walk-in sales
    if (customerId !== undefined && customerId !== null) {
      if (!mongoose.Types.ObjectId.isValid(customerId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid customer ID",
        });
      }

      const customer = await Customer.findOne({
        _id: customerId,
        tenantId,
        status: "ACTIVE",
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Active customer not found",
        });
      }
    }

    const discount = Number(discountAmount || 0);
    const tax = Number(taxAmount || 0);

    if (discount < 0 || tax < 0) {
      return res.status(400).json({
        success: false,
        message: "Discount and tax cannot be negative",
      });
    }

    const sale = await Sale.create({
      tenantId,
      customerId: customerId || null,
      saleNumber: saleNumber.trim(),
      saleDate: saleDate || new Date(),
      status: "DRAFT",
      subtotal: 0,
      discountAmount: discount,
      taxAmount: tax,
      totalAmount: tax - discount >= 0 ? tax - discount : 0,
      paidAmount: 0,
      paymentStatus: "UNPAID",
      note: note || "",
      createdBy,
    });

    return res.status(201).json({
      success: true,
      message: "Sale created successfully",
      data: sale,
    });
  } catch (error) {
    console.error("Create sale error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create sale",
    });
  }
};

module.exports = {
  createSale,
};