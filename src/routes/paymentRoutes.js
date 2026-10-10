
const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const {
  createPayment,
  getSalePayments,
    voidPayment,
} = require("../controllers/paymentController");

const router = express.Router();

router.use(authMiddleware);

// Record a payment for a sale
router.post("/:saleId", createPayment);

// Get payment history for a sale
router.get("/:saleId", getSalePayments);

router.patch("/:paymentId/void", voidPayment);

module.exports = router;
