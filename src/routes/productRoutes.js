const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
  createProduct,
} = require("../controllers/productController");

const router = express.Router();

router.use(authMiddleware);

router.post("/", createProduct);

module.exports = router;