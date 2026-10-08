const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const {
  createPurchase,
    getPurchase,
    getPurchases,
    receivePurchase,    
    cancelPurchase,
} = require("../controllers/purchaseController");

const router = express.Router();

router.use(authMiddleware);

// Create purchase
router.post("/", createPurchase);

router.get("/", getPurchases);

// Receive purchase and create inventory batches
router.post("/:id/receive", receivePurchase);

//cancel purchase
router.patch("/:id/cancel", cancelPurchase);

// Get purchase by ID
router.get("/:id", getPurchase);


module.exports = router;