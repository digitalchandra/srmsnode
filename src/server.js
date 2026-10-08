const dns = require("dns");

dns.setServers([
  "1.1.1.1",
  "1.0.0.1"
]);
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

const connectDB = require("./config/database");

const authRoutes = require("./routes/authRoutes");

const categoryRoutes = require("./routes/categoryRoutes");

const brandRoutes = require("./routes/brandRoutes");

const productRoutes = require("./routes/productRoutes");

const inventoryBatchRoutes = require("./routes/inventoryBatchRoutes");

const stockAdjustmentRoutes = require("./routes/stockAdjustmentRoutes");

const stockMovementRoutes = require("./routes/stockMovementRoutes");

const supplierRoutes = require("./routes/supplierRoutes");

const purchaseRoutes = require("./routes/purchaseRoutes");

const purchaseItemRoutes = require("./routes/purchaseItemRoutes");

const app = express();

const PORT = process.env.PORT || 5050;


// ---------Middleware-----------
app.use(helmet());


app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -------Route -------------

app.use("/api/auth", authRoutes);

app.use("/api/categories", categoryRoutes);

app.use("/api/brands", brandRoutes);

app.use("/api/products", productRoutes);

app.use("/api/inventory-batches", inventoryBatchRoutes);

app.use("/api/stock-adjustments",stockAdjustmentRoutes);

app.use("/api/stock-movements",stockMovementRoutes);

app.use("/api/suppliers", supplierRoutes);

app.use("/api/purchases", purchaseRoutes);

app.use("/api/purchases", purchaseItemRoutes);


// -----------Health Check---------
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "SRMS API is running",
    environment: process.env.NODE_ENV || "development",
  });
});


// ---404-----------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

 
// -------Start Application-------------
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`SRMS API running on port ${PORT}`);
      console.log(
        `Environment: ${process.env.NODE_ENV || "development"}`
      );
    });
  } catch (error) {
    console.error("Failed to start server:");
    console.error(error.message);

    process.exit(1);
  }
};

startServer();