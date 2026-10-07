const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
  createProduct,
  getProducts,
  getLowStockProducts,
} = require("../controllers/productController");

const router = express.Router();

router.use(authMiddleware);

router.post("/", createProduct);

router.get("/", getProducts);

router.get("/low-stock", getLowStockProducts);



module.exports = router;