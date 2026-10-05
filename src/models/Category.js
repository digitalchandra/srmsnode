const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  }
);

// Same category name cannot exist twice
// inside the same vendor.
categorySchema.index(
  { tenantId: 1, name: 1 },
  { unique: true }
);

module.exports = mongoose.model("Category", categorySchema);