const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const {
  addPurchaseItem,
  getPurchaseItems,
  updatePurchaseItem,
  deletePurchaseItem,
} = require("../controllers/purchaseItemController");

const router = express.Router();

router.use(authMiddleware);

// Add item to purchase
router.post("/:purchaseId/items", addPurchaseItem);

// Get purchase items
router.get("/:purchaseId/items", getPurchaseItems);

// Update purchase item
router.put("/:purchaseId/items/:itemId",updatePurchaseItem);

// Delete purchase item
router.delete("/:purchaseId/items/:itemId",deletePurchaseItem);

module.exports = router;