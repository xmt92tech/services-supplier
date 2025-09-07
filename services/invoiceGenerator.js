const PDFDocument = require("pdfkit");
const fetch = require("node-fetch");
const sharp = require("sharp");

let cachedLogoBuffer = null;
let cacheKey = null;

function generateInvoice(invoice) {
  return new Promise(async (resolve, reject) => {
    let buffers = [];
    let doc = new PDFDocument({ margin: 50 });

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      resolve(Buffer.concat(buffers));
    });

    const pageBottom = 720;
    const tableTop = 230;
    const rowHeight = 20;
    const rowsPerPage = Math.floor((pageBottom - tableTop - 100) / rowHeight); // safe margin

    // ====== 1. Pre-calc total pages ======
    const totalPages = Math.ceil(invoice.items.length / rowsPerPage) || 1;

    const noX = 50;
    const itemX = 80;
    const descX = 190;
    const qtyX = 350;
    const priceX = 410;
    const totalX = 490;
    const tableWidth = 500;
    const headerRightTitleWidth = 200;
    const colonBold = 55;
    const colon = 56;
    const pageWidth = doc.page.width;
    const headerRightTitle = pageWidth - headerRightTitleWidth;

    async function loadAndOptimizeLogo(invoice) {
      let buffer = null;

      if (invoice.company.logoBase64) {
        const base64Data = invoice.company.logoBase64.replace(/^data:image\/\w+;base64,/, "");
        buffer = Buffer.from(base64Data, "base64");
      } else if (invoice.company.logoUrl) {
        const res = await fetch(invoice.company.logoUrl);
        if (!res.ok) throw new Error("Failed to fetch logo from URL");
        buffer = Buffer.from(await res.arrayBuffer());
      }

      if (buffer) {
        buffer = await sharp(buffer)
          .resize({ width: 200, withoutEnlargement: true })
          .png({ quality: 80, compressionLevel: 9 })
          .toBuffer();
      }

      return buffer;
    }

    async function drawCompanyLogo(doc, invoice, type) {
      try {
        const newKey = invoice.company.logoBase64
          ? invoice.company.logoBase64.slice(0, 50)
          : invoice.company.logoUrl;

        if (!cachedLogoBuffer || cacheKey !== newKey) {
          cachedLogoBuffer = await loadAndOptimizeLogo(invoice);
          cacheKey = newKey;
        }

        if (cachedLogoBuffer) {
          if (type == "logo") {
            doc.image(cachedLogoBuffer, 50, 45, { width: 60 });
          } else if (type == "watermark") {
            doc.save();
            doc.opacity(0.1);
            doc.image(cachedLogoBuffer, 150, 200, { width: 300 });
            doc.restore();
          }
        }
      } catch (err) {
        console.error("Logo rendering failed:", err.message);
        return null;
      }
    }

    function drawTableHeader(doc, y) {
      doc.rect(noX, y, tableWidth, 20).fill("#eeeeee").stroke();
      doc
        .fillColor("#000000")
        .font("Helvetica-Bold")
        .fontSize(12)
        .text("#", noX + 5, y + 5)
        .text("Item/Service", itemX, y + 5)
        .text("Description", descX, y + 5)
        .text("Qty", qtyX, y + 5)
        .text("Price", priceX, y + 5)
        .text("Total", totalX, y + 5);

      doc.font("Helvetica").fontSize(10);
    }

    function drawFooter(doc, currentPage) {
      const footerText = `Thank you for your business, goods sold are neither returnable nor refundable.`;
      const footerText2 = `All amount stated in - ${invoice.company.currency}. All cheques should be crossed and made payable to`
      const bankDetailText = `Name: ${invoice.company.name}, Bank Account: ${invoice.company.bank} ${invoice.company.account}`;
      doc
        .font("Helvetica-Oblique")
        .fontSize(10)
        .fillColor("#555555")
        .text(footerText, 50, pageBottom - 20, { align: "center" })
        .text(footerText2, 50, pageBottom - 5, { align: "center" })
        .font("Helvetica-BoldOblique")
        .fillColor("#000000")
        .text(bankDetailText, 50, pageBottom + 10,{ align: "center" });

    //   doc
    //     .font("Helvetica")
    //     .fontSize(10)
    //     .fillColor("#000000")
    //     .text(`Page ${currentPage} of ${totalPages}`, pageWidth - 150, pageBottom - 20, {
    //       align: "right",
    //     });
    }

    async function drawHeader(doc, invoice, currentPage) {
      await drawCompanyLogo(doc, invoice, "logo");

      doc
        .fontSize(20)
        .fillColor("#000000")
        .text(invoice.company.name, 120, 50)
        .fontSize(10)
        .text(invoice.company.address, 120, 70);

      if (invoice.company.phone) {
        doc.text(`Tel: ${invoice.company.phone}`, 120, 85);
      }
      if (invoice.company.email) {
        doc.text(`Email: ${invoice.company.email}`, 120, 100);
      }

      let z = 65;
      const lineHeight = 15;

      function drawField(label, value) {
        if (value) {
          doc.fontSize(12).font("Helvetica").text(label, headerRightTitle, z).text(`: ${value}`, headerRightTitle + colon, z);
          z += lineHeight;
        }
      }

      drawField("Ref.", invoice.reference);
      drawField("D/O No", invoice.do_number);
      drawField("Terms", invoice.terms ? `${invoice.terms} Days` : null);
      drawField("Date", invoice.date);
      drawField("Page", `${currentPage} of ${totalPages}`);

      doc.fontSize(13).font("Helvetica-Bold").text(`Invoice`, headerRightTitle, 50).text(`: ${invoice.invoice_number}`, headerRightTitle + colonBold, 50);

      // Customer
      doc.fontSize(12).font("Helvetica-Bold").text("Bill To:", 50, 150);
      doc.font("Helvetica-Bold").text(invoice.customer.name, 100, 150).font("Helvetica").text(invoice.customer.address, 100, 165);

      if (invoice.customer.phone) {
        doc.text(`Tel: ${invoice.customer.phone}`, 100, 180);
      }
      if (invoice.customer.email) {
        doc.text(`Email: ${invoice.customer.email}`, 100, 195);
      }
    }

    // ===== First Page =====
    let currentPage = 1;
    await drawCompanyLogo(doc, invoice, "watermark");
    doc.opacity(1);
    await drawHeader(doc, invoice, currentPage);
    drawTableHeader(doc, tableTop);

    let y = tableTop + rowHeight;

    for (let i = 0; i < invoice.items.length; i++) {
      let item = invoice.items[i];

      if (y > pageBottom - 100) {
        //drawFooter(doc, currentPage);
        doc.addPage();
        currentPage++;
        await drawCompanyLogo(doc, invoice, "watermark");
        await drawHeader(doc, invoice, currentPage);
        drawTableHeader(doc, tableTop);
        y = tableTop + rowHeight;
      }

      doc
        .text(i + 1, noX + 5, y + 5)
        .text(item.name, itemX, y + 5)
        .text(item.description, descX, y + 5)
        .text(item.quantity, qtyX, y + 5)
        .text(`$${item.price.toFixed(2)}`, priceX, y + 5)
        .text(`$${(item.quantity * item.price).toFixed(2)}`, totalX, y + 5);

      y += rowHeight;
    }

    // Totals
    const subtotal = invoice.items.reduce((sum, i) => sum + i.quantity * i.price, 0);
    const discount = invoice.discount_rate ? subtotal * invoice.discount_rate : 0;
    const tax = invoice.tax_rate ? (subtotal - discount) * invoice.tax_rate : 0;
    const grandTotal = subtotal - discount + tax;

    if (y > pageBottom - 100) {
      drawFooter(doc, currentPage);
      doc.addPage();
      currentPage++;
      await drawCompanyLogo(doc, invoice, "watermark");
      await drawHeader(doc, invoice, currentPage);
      y = tableTop;
    }

    doc.moveTo(noX, y + 10).lineTo(noX + tableWidth, y + 10).strokeColor("#000000").stroke();

    let offset = y + 20;
    doc.font("Helvetica").fontSize(12);
    doc.text("Subtotal:", qtyX, offset).text(`$${subtotal.toFixed(2)}`, totalX, offset);
    offset += 15;

    if (invoice.discount_rate) {
      doc.text(`Discount (${(invoice.discount_rate * 100).toFixed(0)}%):`, qtyX, offset).text(`-$${discount.toFixed(2)}`, totalX, offset);
      offset += 15;
    }

    if (invoice.tax_rate) {
      doc.text(`Tax (${(invoice.tax_rate * 100).toFixed(0)}%):`, qtyX, offset).text(`$${tax.toFixed(2)}`, totalX, offset);
      offset += 15;
    }

    const grandTotalY = offset;
    doc.rect(qtyX, grandTotalY, noX + tableWidth - qtyX, 20).fill("#eeeeee");
    doc.font("Helvetica-Bold").fillColor("#000000").text("Grand Total:", qtyX, grandTotalY + 5).text(`$${grandTotal.toFixed(2)}`, totalX, grandTotalY + 5);

    // Last Footer
    drawFooter(doc, currentPage);

    doc.end();
  });
}

module.exports = { generateInvoice };
