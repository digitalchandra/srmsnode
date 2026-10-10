const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
  createSale,
  completeSale,
  getSale,
} = require("../controllers/saleController");

const router = express.Router();

router.use(authMiddleware);

router.post("/", createSale);

router.get("/:id", getSale);

router.post("/:id/complete", completeSale);


module.exports = router;