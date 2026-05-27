const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoiceController");
const authMiddleware = require("../middleware/authMiddleware");
const rateLimiter = require("../middleware/rateLimiter");

router.post("/generate", authMiddleware, rateLimiter, invoiceController.createInvoice);
router.post("/preview", authMiddleware, rateLimiter, invoiceController.previewInvoice);
router.post("/", authMiddleware, invoiceController.getInvoices);
router.get("/:id", authMiddleware, invoiceController.getInvoiceById);
router.put("/update/:id", authMiddleware, invoiceController.updateInvoice);
router.patch("/delete/:id", authMiddleware, invoiceController.deleteInvoice);

module.exports = router;
