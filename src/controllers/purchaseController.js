const mongoose = require("mongoose");
const Purchase = require("../models/Purchase");
const PurchaseItem = require("../models/PurchaseItem");
const Supplier = require("../models/Supplier");
const Product = require("../models/Product");
const InventoryBatch = require("../models/InventoryBatch");
const StockMovement = require("../models/StockMovement");

const createPurchase = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const createdBy = req.user.userId;

    const {
      supplierId,
      purchaseNumber,
      invoiceNumber,
      purchaseDate,
      taxAmount,
      discountAmount,
      note,
    } = req.body;

    // Required fields
    if (!supplierId) {
      return res.status(400).json({
        success: false,
        message: "Supplier is required",
      });
    }

    if (!purchaseNumber || !purchaseNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: "Purchase number is required",
      });
    }

    // Validate supplier ID
    if (!mongoose.Types.ObjectId.isValid(supplierId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid supplier ID",
      });
    }

    // Check supplier belongs to current tenant
    const supplier = await Supplier.findOne({
      _id: supplierId,
      tenantId,
      status: "ACTIVE",
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Active supplier not found",
      });
    }

    // Check duplicate purchase number
    const existingPurchase = await Purchase.findOne({
      tenantId,
      purchaseNumber: purchaseNumber.trim(),
    });

    if (existingPurchase) {
      return res.status(409).json({
        success: false,
        message: "Purchase number already exists",
      });
    }

    const purchase = await Purchase.create({
      tenantId,
      supplierId,
      purchaseNumber: purchaseNumber.trim(),
      invoiceNumber: invoiceNumber || "",
      purchaseDate: purchaseDate || new Date(),
      status: "DRAFT",
      subtotal: 0,
      taxAmount: taxAmount || 0,
      discountAmount: discountAmount || 0,
      totalAmount: 0,
      note: note || "",
      createdBy,
    });

    return res.status(201).json({
      success: true,
      message: "Purchase created successfully",
      data: purchase,
    });
  } catch (error) {
    console.error("Create purchase error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create purchase",
    });
  }
};


const getPurchase = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid purchase ID",
      });
    }

    const purchase = await Purchase.findOne({
      _id: id,
      tenantId,
    })
      .populate("supplierId", "name contactPerson phone email address country status")
      .populate("createdBy", "name email role");

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    const items = await PurchaseItem.find({
      tenantId,
      purchaseId: id,
    })
      .populate("productId", "name sku barcode unit productType pricing")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      data: {
        purchase,
        items,
      },
    });
  } catch (error) {
    console.error("Get purchase error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch purchase",
    });
  }
};


const getPurchases = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const purchases = await Purchase.find({ tenantId })
      .populate(
        "supplierId",
        "name contactPerson phone email status"
      )
      .populate(
        "createdBy",
        "name email role"
      )
      .sort({ purchaseDate: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: purchases.length,
      data: purchases,
    });
  } catch (error) {
    console.error("Get purchases error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch purchases",
    });
  }
};

// receive purchase and create inventory batches

const receivePurchase = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid purchase ID",
      });
    }

    session.startTransaction();

    // 1. Find purchase
    const purchase = await Purchase.findOne({
      _id: id,
      tenantId,
    }).session(session);

    if (!purchase) {
      await session.abortTransaction();

      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    // 2. Purchase must be DRAFT
    if (purchase.status !== "DRAFT") {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "Only draft purchases can be received",
      });
    }

    // 3. Get purchase items
    const items = await PurchaseItem.find({
      tenantId,
      purchaseId: id,
    }).session(session);

    if (items.length === 0) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "Cannot receive purchase without items",
      });
    }

    const receivedItems = [];

    // 4. Process every purchase item
    for (const item of items) {
      // Find product
      const product = await Product.findOne({
        _id: item.productId,
        tenantId,
        status: "ACTIVE",
      }).session(session);

      if (!product) {
        throw new Error(
          `Product not found: ${item.productId}`
        );
      }

      // Current product stock
      const previousStock =
        product.inventory.currentStock || 0;

      const newStock =
        previousStock + item.quantity;

      // Create inventory batch
      const createdBatch = await InventoryBatch.create(
        [
          {
            tenantId,
            productId: item.productId,
            batchNumber: item.batchNumber,
            quantity: item.quantity,
            costPrice: item.costPrice,
            manufacturedDate: item.manufacturedDate,
            expiryDate: item.expiryDate,
            status: item.quantity > 0 ? "ACTIVE" : "DEPLETED",
          },
        ],
        { session }
      );

      const batch = createdBatch[0];

      // Update product stock
      product.inventory.currentStock = newStock;

      await product.save({ session });

      // Create stock movement
      await StockMovement.create(
        [
          {
            tenantId,
            productId: item.productId,
            batchId: batch._id,
            movementType: "STOCK_IN",
            quantity: item.quantity,
            previousStock,
            newStock,
            referenceType: "PURCHASE",
            referenceId: purchase._id,
            note: `Purchase ${purchase.purchaseNumber}`,
            performedBy: userId,
          },
        ],
        { session }
      );

      receivedItems.push({
        productId: item.productId,
        batchId: batch._id,
        quantity: item.quantity,
        previousStock,
        newStock,
      });
    }

    // 5. Mark purchase as received
    purchase.status = "RECEIVED";

    await purchase.save({ session });

    // 6. Commit transaction
    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Purchase received successfully",
      data: {
        purchaseId: purchase._id,
        purchaseNumber: purchase.purchaseNumber,
        status: purchase.status,
        receivedItems,
      },
    });
  } catch (error) {
    await session.abortTransaction();

    console.error("Receive purchase error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to receive purchase",
    });
  } finally {
    await session.endSession();
  }
};

//cancle purchase

const cancelPurchase = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid purchase ID",
      });
    }

    const purchase = await Purchase.findOne({
      _id: id,
      tenantId,
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    if (purchase.status === "RECEIVED") {
      return res.status(400).json({
        success: false,
        message: "Received purchase cannot be cancelled",
      });
    }

    if (purchase.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Purchase is already cancelled",
      });
    }

    purchase.status = "CANCELLED";

    await purchase.save();

    return res.status(200).json({
      success: true,
      message: "Purchase cancelled successfully",
      data: {
        _id: purchase._id,
        purchaseNumber: purchase.purchaseNumber,
        status: purchase.status,
      },
    });
  } catch (error) {
    console.error("Cancel purchase error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel purchase",
    });
  }
};


module.exports = {
    createPurchase,
    getPurchase,
    getPurchases,
    receivePurchase,
    cancelPurchase,
};