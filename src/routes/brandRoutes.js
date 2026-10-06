const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
  createBrand,
  getBrands,
  getBrand,
  updateBrand,
  deleteBrand,
} = require("../controllers/brandController");

const router = express.Router();

// All brand APIs require authentication
router.use(authMiddleware);

router.post("/", createBrand);

router.get("/", getBrands);

router.get("/:id", getBrand);

router.put("/:id", updateBrand);

router.delete("/:id", deleteBrand);

module.exports = router;