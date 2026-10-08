const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const {
    createSupplier,
    getSuppliers,
    getSupplier,
    updateSupplier,
    deleteSupplier,
} = require("../controllers/supplierController");

const router = express.Router();

// All supplier routes require authentication
router.use(authMiddleware);

// Create supplier
router.post("/", createSupplier);

router.get("/", getSuppliers);

router.get("/:id", getSupplier);

router.put("/:id", updateSupplier);

router.delete("/:id", deleteSupplier);

module.exports = router;