const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");



const {
  createStockAdjustment,
  getStockAdjustments
} = require("../controllers/stockAdjustmentController");

const router = express.Router();

router.use(authMiddleware);

router.post("/", createStockAdjustment);

router.get("/", getStockAdjustments);

module.exports = router;