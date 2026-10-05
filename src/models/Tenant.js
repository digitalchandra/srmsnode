const mongoose = require("mongoose");

const tenantSchema = new mongoose.Schema(
  {
    businessName: {
      type: String,
      required: true,
      trim: true,
    },

    subdomain: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    country: {
      type: String,
      default: "Japan",
      trim: true,
    },

    currency: {
      type: String,
      default: "JPY",
    },

    timezone: {
      type: String,
      default: "Asia/Tokyo",
    },

    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "PENDING"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Tenant", tenantSchema);