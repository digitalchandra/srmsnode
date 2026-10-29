
const mongoose = require("mongoose");

const Refund = require("../models/Refund");
const SalesReturn = require("../models/SalesReturn");
const Sale = require("../models/Sale");

// Create a refund for a completed sales return
const createRefund = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { returnId } = req.params;
    const {
      amount,
      refundMethod,
      referenceNumber,
      note,
      refundDate,
    } = req.body;

    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    const validMethods = [
      "CASH",
      "CARD",
      "BANK_TRANSFER",
      "MOBILE_PAYMENT",
      "STORE_CREDIT",
      "OTHER",
    ];

    const refundAmount = Number(amount);

    if (
      !mongoose.Types.ObjectId.isValid(returnId) ||
      !Number.isFinite(refundAmount) ||
      refundAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid sales return ID and positive refund amount are required.",
      });
    }

    if (!validMethods.includes(refundMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid refund method.",
      });
    }

    let createdRefund;

    await session.withTransaction(async () => {
      const salesReturn = await SalesReturn.findOne({
        _id: returnId,
        tenantId,
      }).session(session);

      if (!salesReturn) {
        const error = new Error("Sales return not found.");
        error.statusCode = 404;
        throw error;
      }

      if (salesReturn.status !== "COMPLETED") {
        const error = new Error(
          "Only completed sales returns can be refunded."
        );
        error.statusCode = 400;
        throw error;
      }

      const sale = await Sale.findOne({
        _id: salesReturn.saleId,
        tenantId,
      }).session(session);

      if (!sale) {
        const error = new Error("Related sale not found.");
        error.statusCode = 404;
        throw error;
      }

      const previousRefunds = await Refund.aggregate([
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(String(tenantId)),
            salesReturnId: salesReturn._id,
            status: "COMPLETED",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
          },
        },
      ]).session(session);

      // Work in cents to reduce floating-point rounding errors.
      const totalRefundCents = Math.round(
        Number(salesReturn.totalRefundAmount) * 100
      );

      const alreadyRefundedCents = Math.round(
        Number(previousRefunds[0]?.total || 0) * 100
      );

      const requestedRefundCents = Math.round(refundAmount * 100);

      const remainingCents = totalRefundCents - alreadyRefundedCents;

      if (requestedRefundCents > remainingCents) {
        const error = new Error(
          `Refund exceeds the remaining refundable amount of ${(
            Math.max(remainingCents, 0) / 100
          ).toFixed(2)}.`
        );
        error.statusCode = 400;
        throw error;
      }

      const roundedRefundAmount = requestedRefundCents / 100;

      const [refund] = await Refund.create(
        [
          {
            tenantId,
            salesReturnId: salesReturn._id,
            saleId: sale._id,
            amount: roundedRefundAmount,
            refundMethod,
            referenceNumber: referenceNumber || "",
            note: note || "",
            refundDate: refundDate || new Date(),
            refundedBy: userId,
            status: "COMPLETED",
          },
        ],
        { session }
      );

      const newTotalRefundedCents =
        alreadyRefundedCents + requestedRefundCents;

      // Update the return inside the same transaction. This also ensures
      // concurrent refunds for this return contend on the same document.
      const nextRefundStatus =
        newTotalRefundedCents >= totalRefundCents
          ? refundMethod === "STORE_CREDIT"
            ? "STORE_CREDIT"
            : "REFUNDED"
          : "PENDING";

      const updatedReturn = await SalesReturn.findOneAndUpdate(
        {
          _id: salesReturn._id,
          tenantId,
        },
        {
          $set: {
            refundStatus: nextRefundStatus,
            updatedAt: new Date(),
          },
        },
        {
          new: true,
          session,
          runValidators: true,
        }
      );

      if (!updatedReturn) {
        const error = new Error("Could not update sales return refund status.");
        error.statusCode = 409;
        throw error;
      }

      createdRefund = refund;
    });

    return res.status(201).json({
      success: true,
      message: "Refund recorded successfully.",
      data: createdRefund,
    });
  } catch (error) {
    console.error("Create refund error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Failed to create refund.",
    });
  } finally {
    await session.endSession();
  }
};

// Get refund history for a sales return
const getReturnRefunds = async (req, res) => {
  try {
    const { returnId } = req.params;
    const tenantId = req.user.tenantId;

    if (!mongoose.Types.ObjectId.isValid(returnId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sales return ID.",
      });
    }

    const salesReturn = await SalesReturn.findOne({
      _id: returnId,
      tenantId,
    }).lean();

    if (!salesReturn) {
      return res.status(404).json({
        success: false,
        message: "Sales return not found.",
      });
    }

    const refunds = await Refund.find({
      tenantId,
      salesReturnId: salesReturn._id,
    })
      .populate("refundedBy", "name email")
      .sort({ refundDate: -1, createdAt: -1 })
      .lean();

    const completedRefundCents = refunds
      .filter((refund) => refund.status === "COMPLETED")
      .reduce(
        (total, refund) => total + Math.round(Number(refund.amount) * 100),
        0
      );

    const refundableCents = Math.round(
      Number(salesReturn.totalRefundAmount) * 100
    );

    return res.status(200).json({
      success: true,
      data: {
        salesReturn,
        refunds,
        totalRefunded: completedRefundCents / 100,
        remainingRefundable: Math.max(
          0,
          refundableCents - completedRefundCents
        ) / 100,
      },
    });
  } catch (error) {
    console.error("Get return refunds error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve refund history.",
    });
  }
};

module.exports = {
  createRefund,
  getReturnRefunds,
};
