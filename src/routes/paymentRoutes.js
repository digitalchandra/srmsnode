
const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const {
  createPayment,
  getSalePayments,
} = require("../controllers/paymentController");

const router = express.Router();

router.use(authMiddleware);

// Record a payment for a sale
router.post("/:saleId", createPayment);

// Get payment history for a sale
router.get("/:saleId", getSalePayments);

module.exports = router;
