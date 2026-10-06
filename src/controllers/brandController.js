const Brand = require("../models/Brand");

// ==============================
// CREATE BRAND
// ==============================

const createBrand = async (req, res) => {
  try {
    const { name, description } = req.body || {};

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Brand name is required",
      });
    }

    const brand = await Brand.create({
      tenantId: req.user.tenantId,
      name: name.trim(),
      description: description?.trim() || "",
    });

    return res.status(201).json({
      success: true,
      message: "Brand created successfully",
      data: brand,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Brand already exists",
      });
    }

    console.error("Create brand error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create brand",
    });
  }
};

// ==============================
// GET ALL BRANDS
// ==============================

const getBrands = async (req, res) => {
  try {
    const brands = await Brand.find({
      tenantId: req.user.tenantId,
    }).sort({
      name: 1,
    });

    return res.status(200).json({
      success: true,
      count: brands.length,
      data: brands,
    });
  } catch (error) {
    console.error("Get brands error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get brands",
    });
  }
};

// ==============================
// GET SINGLE BRAND
// ==============================

const getBrand = async (req, res) => {
  try {
    const { id } = req.params;

    const brand = await Brand.findOne({
      _id: id,
      tenantId: req.user.tenantId,
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: brand,
    });
  } catch (error) {
    console.error("Get brand error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get brand",
    });
  }
};

// ==============================
// UPDATE BRAND
// ==============================

const updateBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body || {};

    const brand = await Brand.findOne({
      _id: id,
      tenantId: req.user.tenantId,
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    if (name !== undefined) {
      brand.name = name.trim();
    }

    if (description !== undefined) {
      brand.description = description.trim();
    }

    if (status !== undefined) {
      brand.status = status;
    }

    await brand.save();

    return res.status(200).json({
      success: true,
      message: "Brand updated successfully",
      data: brand,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Brand name already exists",
      });
    }

    console.error("Update brand error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update brand",
    });
  }
};

// ==============================
// DELETE BRAND
// ==============================

const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;

    const brand = await Brand.findOneAndDelete({
      _id: id,
      tenantId: req.user.tenantId,
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Brand deleted successfully",
    });
  } catch (error) {
    console.error("Delete brand error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete brand",
    });
  }
};

module.exports = {
  createBrand,
  getBrands,
  getBrand,
  updateBrand,
  deleteBrand,
};