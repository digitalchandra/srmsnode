
const express = require("express");
const router = express.Router();

const {
  createRefund,
  getReturnRefunds,
} = require("../controllers/refundController");

const authMiddleware = require("../middleware/authMiddleware");

router.post("/:returnId", authMiddleware, createRefund);
router.get("/:returnId", authMiddleware, getReturnRefunds);

module.exports = router;
