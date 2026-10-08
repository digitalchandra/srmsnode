const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
  createProduct,
  getProducts,
  getLowStockProducts,
  getProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");

const router = express.Router();

router.use(authMiddleware);

router.post("/", createProduct);

router.get("/", getProducts);


router.get("/low-stock", getLowStockProducts);

router.get("/:id", getProduct);

router.put("/:id", updateProduct);

router.delete("/:id", deleteProduct);


module.exports = router;