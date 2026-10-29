
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
  getLowStockAlerts,
} = require("../controllers/inventoryAlertController");

router.get("/low-stock", authMiddleware, getLowStockAlerts);

module.exports = router;
