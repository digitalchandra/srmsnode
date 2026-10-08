const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const {
  addPurchaseItem,
} = require("../controllers/purchaseItemController");

const router = express.Router();

router.use(authMiddleware);

// Add item to purchase
router.post("/:purchaseId/items", addPurchaseItem);

module.exports = router;