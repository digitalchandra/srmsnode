const jwt = require("jsonwebtoken");

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      tenantId: user.tenantId.toString(),
      role: user.role,
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      tenantId: user.tenantId.toString(),
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    }
  );
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
};