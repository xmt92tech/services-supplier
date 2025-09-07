const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoiceController");
const authMiddleware = require("../middleware/authMiddleware");
const rateLimiter = require("../middleware/rateLimiter");

router.post("/generate", authMiddleware, rateLimiter, invoiceController.createInvoice);

module.exports = router;
