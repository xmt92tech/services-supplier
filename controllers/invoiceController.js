const { generateInvoice } = require("../services/invoiceGenerator");

exports.createInvoice = async (req, res) => {
  try {
    const invoiceData = req.body;
    const pdfBuffer = await generateInvoice(invoiceData);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice-${invoiceData.invoice_number}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate invoice" });
  }
};
