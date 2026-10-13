
const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
    addSaleItem,
    getSaleItems,
    getSale,
    updateSaleItem,
    deleteSaleItem,
    getSaleItemBatchAllocations,
    getSalesReturnBatchAllocations,
} = require("../controllers/saleItemController");

const router = express.Router();

router.use(authMiddleware);

router.post("/:saleId/items", addSaleItem);

router.get("/:saleId/items", getSaleItems);



router.get("/:id", getSale);

router.put("/:saleId/items/:itemId", updateSaleItem);

router.delete("/:saleId/items/:itemId", deleteSaleItem);


router.get("/:saleId/batch-allocations", getSaleItemBatchAllocations);


module.exports = router;
