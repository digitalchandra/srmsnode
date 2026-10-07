const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
  createInventoryBatch,
  getInventoryBatches,
  getInventoryBatch,
  getExpiryBatches,
} = require("../controllers/inventoryBatchController");

const router = express.Router();

router.use(authMiddleware);

router.post("/", createInventoryBatch);

router.get("/", getInventoryBatches);

router.get("/expiry", getExpiryBatches);

router.get("/:id", getInventoryBatch);


module.exports = router;