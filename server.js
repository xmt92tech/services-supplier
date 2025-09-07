const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require('dotenv').config();

const invoiceRoutes = require("./routes/invoice");
const authRoutes = require("./routes/auth");

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));
app.use(cors());

// Routes
app.use("/api/invoices", invoiceRoutes);
app.use("/api/auth", authRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Invoice API running at http://localhost:${PORT}`);
});
