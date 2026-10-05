const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Tenant = require("../models/Tenant");
const User = require("../models/User");

const {
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/token");



const registerVendor = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const {
      businessName,
      ownerName,
      email,
      password,
      subdomain,
      country,
      currency,
      timezone,
    } = req.body;

    // -------------------------
    // Basic validation
    // -------------------------

    if (
      !businessName ||
      !ownerName ||
      !email ||
      !password ||
      !subdomain
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Business name, owner name, email, password and subdomain are required",
      });
    }

    // -------------------------
    // Normalize values
    // -------------------------

    const normalizedEmail = email.toLowerCase().trim();

    const normalizedSubdomain = subdomain
      .toLowerCase()
      .trim();

    // -------------------------
    // Validate password
    // -------------------------

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    // -------------------------
    // Validate subdomain
    // -------------------------

    const subdomainRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

    if (!subdomainRegex.test(normalizedSubdomain)) {
      return res.status(400).json({
        success: false,
        message:
          "Subdomain can contain only lowercase letters, numbers and hyphens",
      });
    }

    // -------------------------
    // Start transaction
    // -------------------------

    session.startTransaction();

    // Check existing subdomain
    const existingTenant = await Tenant.findOne({
      subdomain: normalizedSubdomain,
    }).session(session);

    if (existingTenant) {
      await session.abortTransaction();

      return res.status(409).json({
        success: false,
        message: "Subdomain is already registered",
      });
    }

    // Check existing email inside tenant system
    const existingUser = await User.findOne({
      email: normalizedEmail,
    }).session(session);

    if (existingUser) {
      await session.abortTransaction();

      return res.status(409).json({
        success: false,
        message: "Email is already registered",
      });
    }

    // -------------------------
    // Hash password
    // -------------------------

    const passwordHash = await bcrypt.hash(password, 12);

    // -------------------------
    // Create Tenant
    // -------------------------

    const tenant = await Tenant.create(
      [
        {
          businessName: businessName.trim(),
          subdomain: normalizedSubdomain,
          country: country || "Japan",
          currency: currency || "JPY",
          timezone: timezone || "Asia/Tokyo",
        },
      ],
      { session }
    );

    // -------------------------
    // Create Owner
    // -------------------------

    const user = await User.create(
      [
        {
          tenantId: tenant[0]._id,
          name: ownerName.trim(),
          email: normalizedEmail,
          passwordHash,
          role: "OWNER",
        },
      ],
      { session }
    );

    // -------------------------
    // Commit transaction
    // -------------------------

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: "Vendor registered successfully",

      data: {
        tenant: {
          id: tenant[0]._id,
          businessName: tenant[0].businessName,
          subdomain: tenant[0].subdomain,
          shopUrl: `${tenant[0].subdomain}.srms.com`,
        },

        owner: {
          id: user[0]._id,
          name: user[0].name,
          email: user[0].email,
          role: user[0].role,
        },
      },
    });
  } catch (error) {
    await session.abortTransaction();

    console.error("Vendor registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Vendor registration failed",
    });
  } finally {
    await session.endSession();
  }

  


};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // -------------------------
    // Validate
    // -------------------------

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // -------------------------
    // Find user
    // -------------------------

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // -------------------------
    // Check status
    // -------------------------

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive",
      });
    }

    // -------------------------
    // Compare password
    // -------------------------

    const isPasswordValid = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // -------------------------
    // Generate tokens
    // -------------------------

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // -------------------------
    // Response
    // -------------------------

    return res.status(200).json({
      success: true,
      message: "Login successful",

      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
        },

        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select("-passwordHash");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get user information",
    });
  }
};

module.exports = {
  registerVendor,
  loginUser,
  getMe,
};

