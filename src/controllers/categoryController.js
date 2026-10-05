const Category = require("../models/Category");

// ==============================
// CREATE CATEGORY
// ==============================

const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    const tenantId = req.user.tenantId;

    const category = await Category.create({
      tenantId,
      name: name.trim(),
      description: description?.trim() || "",
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Category already exists",
      });
    }

    console.error("Create category error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create category",
    });
  }
};

// ==============================
// GET ALL CATEGORIES
// ==============================

const getCategories = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const categories = await Category.find({
      tenantId,
    }).sort({
      name: 1,
    });

    return res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    console.error("Get categories error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get categories",
    });
  }
};

// ==============================
// GET SINGLE CATEGORY
// ==============================

const getCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findOne({
      _id: id,
      tenantId: req.user.tenantId,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("Get category error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get category",
    });
  }
};

// ==============================
// UPDATE CATEGORY
// ==============================

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    const category = await Category.findOne({
      _id: id,
      tenantId: req.user.tenantId,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    if (name !== undefined) {
      category.name = name.trim();
    }

    if (description !== undefined) {
      category.description = description.trim();
    }

    if (status !== undefined) {
      category.status = status;
    }

    await category.save();

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Category name already exists",
      });
    }

    console.error("Update category error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update category",
    });
  }
};

// ==============================
// DELETE CATEGORY
// ==============================

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findOneAndDelete({
      _id: id,
      tenantId: req.user.tenantId,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete category error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete category",
    });
  }
};

module.exports = {
  createCategory,
  getCategories,
  getCategory,
  updateCategory,
  deleteCategory,
};