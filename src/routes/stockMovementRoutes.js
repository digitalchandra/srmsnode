const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
  getStockMovements,
} = require("../controllers/stockMovementController");

const router = express.Router();

router.use(authMiddleware);

router.get("/", getStockMovements);

module.exports = router;