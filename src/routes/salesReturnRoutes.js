
const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const {
    createSalesReturn,
    processSalesReturn,
    getSalesReturnBatchAllocations,
} = require("../controllers/salesReturnController");

const router = express.Router();

router.use(authMiddleware);

// Create a new sales return for a specific sale
router.post("/:saleId", createSalesReturn);

// Process a draft sales return
router.patch("/:returnId/process", processSalesReturn);

router.get(
  "/:returnId/batch-allocations",
  getSalesReturnBatchAllocations
);

module.exports = router;
