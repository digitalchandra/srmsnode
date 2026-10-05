const express = require("express");

const {
  registerVendor,
  loginUser,
  getMe,
} = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerVendor);

router.post("/login", loginUser);

router.get("/me", authMiddleware, getMe);

module.exports = router;