const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
  createSale,
  completeSale,
  getSale,
  getSales,
  addSaleItem,
  getSaleItems,
  updateSaleItem,
  deleteSaleItem,

} = require("../controllers/saleController");

const router = express.Router();

router.use(authMiddleware);

router.post("/", createSale);

router.get("/", getSales);

router.get("/:id", getSale);

router.post("/:id/complete", completeSale);

router.post("/:saleId/items", addSaleItem);

router.get("/:saleId/items", getSaleItems);

router.put("/:saleId/items/:itemId", updateSaleItem);

router.delete("/:saleId/items/:itemId", deleteSaleItem);

module.exports = router;