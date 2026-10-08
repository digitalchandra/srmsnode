const Supplier = require("../models/Supplier");

const createSupplier = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const {
      name,
      contactPerson,
      phone,
      email,
      address,
      country,
      note,
    } = req.body;

    // Basic validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Supplier name is required",
      });
    }

    // Check duplicate supplier within same tenant
    const existingSupplier = await Supplier.findOne({
      tenantId,
      name: name.trim(),
    });

    if (existingSupplier) {
      return res.status(409).json({
        success: false,
        message: "Supplier already exists",
      });
    }

    const supplier = await Supplier.create({
      tenantId,
      name: name.trim(),
      contactPerson,
      phone,
      email,
      address,
      country,
      note,
    });

    return res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      data: supplier,
    });
  } catch (error) {
    console.error("Create supplier error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create supplier",
    });
  }
};

// Get all suppliers for a tenant
const getSuppliers = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const suppliers = await Supplier.find({ tenantId })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: suppliers.length,
      data: suppliers,
    });
  } catch (error) {
    console.error("Get suppliers error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch suppliers",
    });
  }
};

// ----get single supplier by id----
const getSupplier = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const supplier = await Supplier.findOne({
      _id: id,
      tenantId,
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: supplier,
    });
  } catch (error) {
    console.error("Get supplier error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch supplier",
    });
  }
};

// update supplier by id
const updateSupplier = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const {
      name,
      contactPerson,
      phone,
      email,
      address,
      country,
      status,
      note,
    } = req.body;

    const supplier = await Supplier.findOne({
      _id: id,
      tenantId,
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    // Check duplicate name within the same tenant
    if (name && name.trim() !== supplier.name) {
      const existingSupplier = await Supplier.findOne({
        tenantId,
        name: name.trim(),
        _id: { $ne: id },
      });

      if (existingSupplier) {
        return res.status(409).json({
          success: false,
          message: "Supplier with this name already exists",
        });
      }

      supplier.name = name.trim();
    }

    if (contactPerson !== undefined) {
      supplier.contactPerson = contactPerson;
    }

    if (phone !== undefined) {
      supplier.phone = phone;
    }

    if (email !== undefined) {
      supplier.email = email;
    }

    if (address !== undefined) {
      supplier.address = address;
    }

    if (country !== undefined) {
      supplier.country = country;
    }

    if (status !== undefined) {
      supplier.status = status;
    }

    if (note !== undefined) {
      supplier.note = note;
    }

    await supplier.save();

    return res.status(200).json({
      success: true,
      message: "Supplier updated successfully",
      data: supplier,
    });
  } catch (error) {
    console.error("Update supplier error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update supplier",
    });
  }
};

// deactivate supplier by id

const deleteSupplier = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const supplier = await Supplier.findOne({
      _id: id,
      tenantId,
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    if (supplier.status === "INACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Supplier is already inactive",
      });
    }

    supplier.status = "INACTIVE";

    await supplier.save();

    return res.status(200).json({
      success: true,
      message: "Supplier deactivated successfully",
      data: {
        _id: supplier._id,
        name: supplier.name,
        status: supplier.status,
      },
    });
  } catch (error) {
    console.error("Delete supplier error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to deactivate supplier",
    });
  }
};


module.exports = {
    createSupplier,
    getSuppliers,
    getSupplier,
    updateSupplier,
    deleteSupplier,
};