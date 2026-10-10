
const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const {
  createSalesReturn,
    processSalesReturn,
} = require("../controllers/salesReturnController");

const router = express.Router();

router.use(authMiddleware);

// Create a new sales return for a specific sale
router.post("/:saleId", createSalesReturn);

// Process a draft sales return
router.patch("/:returnId/process", processSalesReturn);

module.exports = router;
