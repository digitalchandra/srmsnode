const express = require("express");
const router = express.Router();

const {
        getSalesSummary,
        getDailySales,

 } = require("../controllers/reportController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/sales-summary", authMiddleware, getSalesSummary);

router.get("/daily-sales", authMiddleware, getDailySales);

module.exports = router;