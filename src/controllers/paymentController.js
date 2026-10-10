
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Sale = require("../models/Sale");

// Create a new payment for a sale

const createPayment = async (req, res) => {
  const { saleId } = req.params;
  const {
    amount,
    paymentMethod,
    referenceNumber,
    note,
    paymentDate,
  } = req.body || {};

  const paymentAmount = Number(amount);

  if (
    amount === undefined ||
    amount === null ||
    amount === "" ||
    !Number.isFinite(paymentAmount) ||
    paymentAmount <= 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Payment amount must be greater than zero",
    });
  }

  const allowedMethods = [
    "CASH",
    "CARD",
    "BANK_TRANSFER",
    "MOBILE_PAYMENT",
    "OTHER",
  ];

  if (!allowedMethods.includes(paymentMethod)) {
    return res.status(400).json({
      success: false,
      message: "Invalid payment method",
    });
  }

  if (!mongoose.isValidObjectId(saleId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid sale ID",
    });
  }

  if (
    paymentDate !== undefined &&
    Number.isNaN(Date.parse(paymentDate))
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid payment date",
    });
  }

  const tenantId = req.user.tenantId;
  const receivedBy = req.user.userId;

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const sale = await Sale.findOne({
        _id: saleId,
        tenantId,
      }).session(session);

      if (!sale) {
        const error = new Error("Sale not found");
        error.statusCode = 404;
        throw error;
      }

      if (sale.status !== "COMPLETED") {
        const error = new Error(
          "Payment is allowed only for completed sales"
        );
        error.statusCode = 400;
        throw error;
      }
      

      const totalAmount = Number(sale.totalAmount);
      const currentPaid = Number(sale.paidAmount || 0);

            if (
            !Number.isFinite(currentPaid) ||
            currentPaid < 0 ||
            currentPaid > totalAmount
            ) {
            const error = new Error(
                "Sale payment totals are invalid"
            );
            error.statusCode = 400;
            throw error;
            }


      // Work in yen using two decimal places for safe comparisons.
      const totalCents = Math.round(totalAmount * 100);
      const paidCents = Math.round(currentPaid * 100);
      const amountCents = Math.round(paymentAmount * 100);
      const balanceCents = totalCents - paidCents;

      //-------------------------

              if (
        !Number.isSafeInteger(amountCents) ||
        amountCents <= 0
        ) {
        const error = new Error(
            "Payment amount is too small or invalid"
        );
        error.statusCode = 400;
        throw error;
        }

    

      if (
        !Number.isFinite(totalAmount) ||
        totalAmount <= 0 ||
        balanceCents <= 0
      ) {
        const error = new Error(
          "This sale has no outstanding balance"
        );
        error.statusCode = 400;
        throw error;
      }

      if (amountCents > balanceCents) {
        const error = new Error(
          `Payment exceeds outstanding balance of ${(
            balanceCents / 100
          ).toFixed(2)}`
        );
        error.statusCode = 400;
        throw error;
      }

      const newPaidCents = paidCents + amountCents;
      const newPaidAmount = newPaidCents / 100;

      const newPaymentStatus =
        newPaidCents >= totalCents ? "PAID" : "PARTIAL";

      const payment = new Payment({
        tenantId,
        saleId,
        amount: amountCents / 100,
        paymentMethod,
        referenceNumber,
        note,
        ...(paymentDate ? { paymentDate: new Date(paymentDate) } : {}),
        receivedBy,
      });

      await payment.save({ session });

      const updatedSale = await Sale.findOneAndUpdate(
        {
          _id: saleId,
          tenantId,
          paidAmount: sale.paidAmount,
          status: "COMPLETED",
        },
        {
          $set: {
            paidAmount: newPaidAmount,
            paymentStatus: newPaymentStatus,
          },
        },
        {
          new: true,
          runValidators: true,
          session,
        }
      );

      if (!updatedSale) {
        throw new Error(
          "Sale payment update conflict; please retry"
        );
      }

      result = {
        payment,
        sale: updatedSale,
        balanceDue: (totalCents - newPaidCents) / 100,
      };
    });

    return res.status(201).json({
      success: true,
      message: "Payment recorded successfully",
      data: result,
    });
  } catch (error) {
    console.error("Create payment error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : "Failed to record payment",
    });
  } finally {
    await session.endSession();
  }
};

// Get payment history for a sale

const getSalePayments = async (req, res) => {
  const { saleId } = req.params;

  if (!mongoose.isValidObjectId(saleId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid sale ID",
    });
  }

  try {
    const sale = await Sale.findOne({
      _id: saleId,
      tenantId: req.user.tenantId,
    }).select("_id totalAmount paidAmount paymentStatus");

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    const payments = await Payment.find({
      tenantId: req.user.tenantId,
      saleId,
    }).sort({ paymentDate: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: payments.length,
      data: {
        sale,
        payments,
      },
    });
  } catch (error) {
    console.error("Get sale payments error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment history",
    });
  }
};


const voidPayment = async (req, res) => {
  const { paymentId } = req.params;

  if (!mongoose.isValidObjectId(paymentId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid payment ID",
    });
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const payment = await Payment.findOne({
        _id: paymentId,
        tenantId: req.user.tenantId,
        status: "COMPLETED",
      }).session(session);

      if (!payment) {
        const error = new Error(
          "Completed payment not found"
        );
        error.statusCode = 404;
        throw error;
      }

      const sale = await Sale.findOne({
        _id: payment.saleId,
        tenantId: req.user.tenantId,
      }).session(session);

      if (!sale) {
        const error = new Error("Sale not found");
        error.statusCode = 404;
        throw error;
      }

      if (sale.status !== "COMPLETED") {
        const error = new Error(
          "Only completed sales can have payments voided"
        );
        error.statusCode = 400;
        throw error;
      }

      const updatedPayment = await Payment.findOneAndUpdate(
        {
          _id: paymentId,
          tenantId: req.user.tenantId,
          status: "COMPLETED",
        },
        {
          $set: {
            status: "VOIDED",
          },
        },
        {
          new: true,
          session,
          runValidators: true,
        }
      );

      if (!updatedPayment) {
        throw new Error(
          "Payment changed during this operation; please retry"
        );
      }

      const remainingPayments = await Payment.find({
        tenantId: req.user.tenantId,
        saleId: payment.saleId,
        status: "COMPLETED",
      })
        .select("amount")
        .session(session);

      const totalPaid = Math.round(
        remainingPayments.reduce(
          (sum, item) => sum + Math.round(item.amount * 100),
          0
        )
      ) / 100;

      const totalAmount = Number(sale.totalAmount);

      if (
        !Number.isFinite(totalAmount) ||
        totalAmount < 0 ||
        totalPaid > totalAmount
      ) {
        throw new Error(
          "Payment totals are inconsistent; transaction cancelled"
        );
      }

      let paymentStatus = "UNPAID";

      if (totalPaid > 0 && totalPaid < totalAmount) {
        paymentStatus = "PARTIAL";
      } else if (totalPaid >= totalAmount && totalAmount > 0) {
        paymentStatus = "PAID";
      }

      const updatedSale = await Sale.findOneAndUpdate(
        {
          _id: sale._id,
          tenantId: req.user.tenantId,
          paidAmount: sale.paidAmount,
          status: "COMPLETED",
        },
        {
          $set: {
            paidAmount: totalPaid,
            paymentStatus,
          },
        },
        {
          new: true,
          session,
          runValidators: true,
        }
      );

      if (!updatedSale) {
        throw new Error(
          "Sale changed during this operation; please retry"
        );
      }

      result = {
        payment: updatedPayment,
        sale: updatedSale,
        balanceDue: Math.round(
          (totalAmount - totalPaid) * 100
        ) / 100,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Payment voided and sale totals recalculated",
      data: result,
    });
  } catch (error) {
    console.error("Void payment error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Failed to void payment",
    });
  } finally {
    await session.endSession();
  }
};


module.exports = {
  createPayment,
  getSalePayments,
  voidPayment,
    
};
