const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
  createCategory,
  getCategories,
  getCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");

const router = express.Router();

// All category APIs require login
router.use(authMiddleware);

router.post("/", createCategory);

router.get("/", getCategories);

router.get("/:id", getCategory);

router.put("/:id", updateCategory);

router.delete("/:id", deleteCategory);

module.exports = router;