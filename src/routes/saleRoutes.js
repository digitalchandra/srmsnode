const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
  createSale,
} = require("../controllers/saleController");

const router = express.Router();

router.use(authMiddleware);

router.post("/", createSale);

module.exports = router;