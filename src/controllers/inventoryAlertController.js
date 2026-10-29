
const Product = require("../models/Product");

const getLowStockAlerts = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const products = await Product.find({
      tenantId,
      status: "ACTIVE",
      "inventory.trackStock": true,
      $expr: {
        $lte: [
          "$inventory.currentStock",
          "$inventory.lowStockThreshold",
        ],
      },
    })
      .select(
        "name sku barcode unit pricing.sellingPrice inventory.currentStock inventory.lowStockThreshold"
      )
      .sort({ "inventory.currentStock": 1 })
      .lean();

    const alerts = products.map((product) => ({
      _id: product._id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      unit: product.unit,
      sellingPrice: product.pricing?.sellingPrice ?? 0,
      currentStock: product.inventory?.currentStock ?? 0,
      lowStockThreshold:
        product.inventory?.lowStockThreshold ?? 5,
      stockStatus:
        (product.inventory?.currentStock ?? 0) === 0
          ? "OUT_OF_STOCK"
          : "LOW_STOCK",
    }));

    return res.status(200).json({
      success: true,
      count: alerts.length,
      data: alerts,
    });
  } catch (error) {
    console.error("Get low stock alerts error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch low stock alerts",
    });
  }
};

module.exports = {
  getLowStockAlerts,
};
