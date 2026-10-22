// const PDFDocument = require("pdfkit");
// const fetch = require("node-fetch");
// const sharp = require("sharp");

// let cachedLogoBuffer = null;
// let cacheKey = null;

// function generateInvoice(invoice) {
//   return new Promise(async (resolve, reject) => {
//     let buffers = [];
//     let doc = new PDFDocument({ margin: 50 });

//     doc.on("data", buffers.push.bind(buffers));
//     doc.on("end", () => {
//       resolve(Buffer.concat(buffers));
//     });

//     const pageBottom = 720;
//     const tableTop = 230;
//     const rowHeight = 20;
//     const rowsPerPage = Math.floor((pageBottom - tableTop - 100) / rowHeight); // safe margin

//     // ====== 1. Pre-calc total pages ======
//     const totalPages = Math.ceil(invoice.items.length / rowsPerPage) || 1;

//     const noX = 50;
//     const itemX = 80;
//     const descX = 190;
//     const qtyX = 350;
//     const priceX = 410;
//     const totalX = 490;
//     const tableWidth = 500;
//     const headerRightTitleWidth = 200;
//     const colonBold = 55;
//     const colon = 56;
//     const pageWidth = doc.page.width;
//     const headerRightTitle = pageWidth - headerRightTitleWidth;

//     async function loadAndOptimizeLogo(invoice) {
//       let buffer = null;

//       if (invoice.company.logoBase64) {
//         const base64Data = invoice.company.logoBase64.replace(/^data:image\/\w+;base64,/, "");
//         buffer = Buffer.from(base64Data, "base64");
//       } else if (invoice.company.logoUrl) {
//         const res = await fetch(invoice.company.logoUrl);
//         if (!res.ok) throw new Error("Failed to fetch logo from URL");
//         buffer = Buffer.from(await res.arrayBuffer());
//       }

//       if (buffer) {
//         buffer = await sharp(buffer)
//           .resize({ width: 200, withoutEnlargement: true })
//           .png({ quality: 80, compressionLevel: 9 })
//           .toBuffer();
//       }

//       return buffer;
//     }

//     async function drawCompanyLogo(doc, invoice, type) {
//       try {
//         const newKey = invoice.company.logoBase64
//           ? invoice.company.logoBase64.slice(0, 50)
//           : invoice.company.logoUrl;

//         if (!cachedLogoBuffer || cacheKey !== newKey) {
//           cachedLogoBuffer = await loadAndOptimizeLogo(invoice);
//           cacheKey = newKey;
//         }

//         if (cachedLogoBuffer) {
//           if (type == "logo") {
//             doc.image(cachedLogoBuffer, 50, 45, { width: 60 });
//           } else if (type == "watermark") {
//             doc.save();
//             doc.opacity(0.1);
//             doc.image(cachedLogoBuffer, 150, 200, { width: 300 });
//             doc.restore();
//           }
//         }
//       } catch (err) {
//         console.error("Logo rendering failed:", err.message);
//         return null;
//       }
//     }

//     function drawTableHeader(doc, y) {
//       doc.rect(noX, y, tableWidth, 20).fill("#eeeeee").stroke();
//       doc
//         .fillColor("#000000")
//         .font("Helvetica-Bold")
//         .fontSize(12)
//         .text("#", noX + 5, y + 5)
//         .text("Item/Service", itemX, y + 5)
//         .text("Description", descX, y + 5)
//         .text("Qty", qtyX, y + 5)
//         .text("Price", priceX, y + 5)
//         .text("Total", totalX, y + 5);

//       doc.font("Helvetica").fontSize(10);
//     }

//     function drawFooter(doc, currentPage) {
//       const footerText = `Thank you for your business, goods sold are neither returnable nor refundable.`;
//       const footerText2 = `All amount stated in - ${invoice.company.currency}. All cheques should be crossed and made payable to`
//       const bankDetailText = `Name: ${invoice.company.name}, Bank Account: ${invoice.company.bank} ${invoice.company.account}`;
//       doc
//         .font("Helvetica-Oblique")
//         .fontSize(10)
//         .fillColor("#555555")
//         .text(footerText, 50, pageBottom - 20, { align: "center" })
//         .text(footerText2, 50, pageBottom - 5, { align: "center" })
//         .font("Helvetica-BoldOblique")
//         .fillColor("#000000")
//         .text(bankDetailText, 50, pageBottom + 10,{ align: "center" });

//     //   doc
//     //     .font("Helvetica")
//     //     .fontSize(10)
//     //     .fillColor("#000000")
//     //     .text(`Page ${currentPage} of ${totalPages}`, pageWidth - 150, pageBottom - 20, {
//     //       align: "right",
//     //     });
//     }

//     // async function drawHeader(doc, invoice, currentPage) {
//     //   await drawCompanyLogo(doc, invoice, "logo");

//     //   doc
//     //     .fontSize(20)
//     //     .fillColor("#000000")
//     //     .text(invoice.company.name, 120, 50)
//     //     .fontSize(10)
//     //     .text(invoice.company.address, 120, 70);

//     //   if (invoice.company.phone) {
//     //     doc.text(`Tel: ${invoice.company.phone}`, 120, 85);
//     //   }
//     //   if (invoice.company.email) {
//     //     doc.text(`Email: ${invoice.company.email}`, 120, 100);
//     //   }

//     //   let z = 65;
//     //   const lineHeight = 15;

//     //   function drawField(label, value) {
//     //     if (value) {
//     //       doc.fontSize(12).font("Helvetica").text(label, headerRightTitle, z).text(`: ${value}`, headerRightTitle + colon, z);
//     //       z += lineHeight;
//     //     }
//     //   }

//     //   drawField("Ref.", invoice.reference);
//     //   drawField("D/O No", invoice.do_number);
//     //   drawField("Terms", invoice.terms ? `${invoice.terms} Days` : null);
//     //   drawField("Date", invoice.date);
//     //   drawField("Page", `${currentPage} of ${totalPages}`);

//     //   doc.fontSize(13).font("Helvetica-Bold").text(`Invoice`, headerRightTitle, 50).text(`: ${invoice.invoice_number}`, headerRightTitle + colonBold, 50);

//     //   // Customer
//     //   doc.fontSize(12).font("Helvetica-Bold").text("Bill To:", 50, 150);
//     //   doc.font("Helvetica-Bold").text(invoice.customer.name, 100, 150).font("Helvetica").text(invoice.customer.address, 100, 165);

//     //   if (invoice.customer.phone) {
//     //     doc.text(`Tel: ${invoice.customer.phone}`, 100, 180);
//     //   }
//     //   if (invoice.customer.email) {
//     //     doc.text(`Email: ${invoice.customer.email}`, 100, 195);
//     //   }
//     // }

//     async function drawHeader(doc, invoice, currentPage) {
//   await drawCompanyLogo(doc, invoice, "logo");

//   doc
//     .fontSize(20)
//     .fillColor("#000000")
//     .text(invoice.company.name, 120, 50)
//     .fontSize(10)
//     .text(invoice.company.address, 120, 70);

//   if (invoice.company.phone) {
//     doc.text(`Tel: ${invoice.company.phone}`, 120, 85);
//   }
//   if (invoice.company.email) {
//     doc.text(`Email: ${invoice.company.email}`, 120, 100);
//   }

//   let z = 65;
//   const lineHeight = 15;

//   function drawField(label, value) {
//     if (value) {
//       doc
//         .fontSize(12)
//         .font("Helvetica")
//         .text(label, headerRightTitle, z)
//         .text(`: ${value}`, headerRightTitle + colon, z, {
//           width: 180,       // ✅ restrict width
//           continued: false, // ✅ allow wrapping
//           ellipsis: true    // ✅ cut off if too long
//         });
//       z += lineHeight;
//     }
//   }

//   drawField("Ref.", invoice.reference);
//   drawField("D/O No", invoice.do_number);
//   drawField("Terms", invoice.terms ? `${invoice.terms} Days` : null);
//   drawField("Date", invoice.date);
//   drawField("Page", `${currentPage} of ${totalPages}`);

//   // Invoice Number (fix overlap)
//   doc
//     .fontSize(13)
//     .font("Helvetica-Bold")
//     .text("Invoice", headerRightTitle, 50)
//     .text(`: ${invoice.invoice_number}`, headerRightTitle + colonBold, 50, {
//       width: 180,       // ✅ restrict width
//       continued: false,
//       ellipsis: true
//     });

//   // Customer
//   doc
//     .fontSize(12)
//     .font("Helvetica-Bold")
//     .text("Bill To:", 50, 150);

//   doc
//     .font("Helvetica-Bold")
//     .text(invoice.customer.name, 100, 150, { width: 250 }) // ✅ wrap if long
//     .font("Helvetica")
//     .text(invoice.customer.address, 100, 165, { width: 250 });

//   if (invoice.customer.phone) {
//     doc.text(`Tel: ${invoice.customer.phone}`, 100, 180);
//   }
//   if (invoice.customer.email) {
//     doc.text(`Email: ${invoice.customer.email}`, 100, 195, { width: 250 });
//   }
// }


//     // ===== First Page =====
//     let currentPage = 1;
//     await drawCompanyLogo(doc, invoice, "watermark");
//     doc.opacity(1);
//     await drawHeader(doc, invoice, currentPage);
//     drawTableHeader(doc, tableTop);

//     let y = tableTop + rowHeight;

//     for (let i = 0; i < invoice.items.length; i++) {
//       let item = invoice.items[i];

//       if (y > pageBottom - 100) {
//         //drawFooter(doc, currentPage);
//         doc.addPage();
//         currentPage++;
//         await drawCompanyLogo(doc, invoice, "watermark");
//         await drawHeader(doc, invoice, currentPage);
//         drawTableHeader(doc, tableTop);
//         y = tableTop + rowHeight;
//       }

//       //if data too long and go to second line and it will based on that to give some space for next line
//       const descHeight = doc.heightOfString(item.description, {
//         width: qtyX - descX - 10
//       })
//       const rowHeightDynamic = Math.max(rowHeight,descHeight + 10);

//       doc
//         // .text(i + 1, noX + 5, y + 5)
//         // .text(item.name, itemX, y + 5)
//         // .text(item.description, descX, y + 5)
//         // .text(item.quantity, qtyX, y + 5)
//         // .text(`$${item.price.toFixed(2)}`, priceX, y + 5)
//         // .text(`$${(item.quantity * item.price).toFixed(2)}`, totalX, y + 5);
//         .text(i + 1, noX + 5, y + 5, { width: itemX - noX - 5 }) // index column
//         .text(item.name, itemX, y + 5, { width: descX - itemX - 5 }) // item name
//         .text(item.description, descX, y + 5, {
//           width: qtyX - descX - 10,
//           continued: false
//         })
//         .text(item.quantity, qtyX, y + 5, { width: priceX - qtyX - 5 })
//         .text(`$${item.price.toFixed(2)}`, priceX, y + 5, { width: totalX - priceX - 5 })
//         .text(`$${(item.quantity * item.price).toFixed(2)}`, totalX, y + 5);

//       // y += rowHeight;
//       y += rowHeightDynamic;
//     }

//     // Totals
//     const subtotal = invoice.items.reduce((sum, i) => sum + i.quantity * i.price, 0);
//     const discount = invoice.discount_rate ? subtotal * invoice.discount_rate : 0;
//     const tax = invoice.tax_rate ? (subtotal - discount) * invoice.tax_rate : 0;
//     const grandTotal = subtotal - discount + tax;

//     if (y > pageBottom - 100) {
//       drawFooter(doc, currentPage);
//       doc.addPage();
//       currentPage++;
//       await drawCompanyLogo(doc, invoice, "watermark");
//       await drawHeader(doc, invoice, currentPage);
//       y = tableTop;
//     }

//     doc.moveTo(noX, y + 10).lineTo(noX + tableWidth, y + 10).strokeColor("#000000").stroke();

//     let offset = y + 20;
//     doc.font("Helvetica").fontSize(12);
//     doc.text("Subtotal:", qtyX, offset).text(`$${subtotal.toFixed(2)}`, totalX, offset);
//     offset += 15;

//     if (invoice.discount_rate) {
//       doc.text(`Discount (${(invoice.discount_rate * 100).toFixed(0)}%):`, qtyX, offset).text(`-$${discount.toFixed(2)}`, totalX, offset);
//       offset += 15;
//     }

//     if (invoice.tax_rate) {
//       doc.text(`Tax (${(invoice.tax_rate * 100).toFixed(0)}%):`, qtyX, offset).text(`$${tax.toFixed(2)}`, totalX, offset);
//       offset += 15;
//     }

//     const grandTotalY = offset;
//     doc.rect(qtyX, grandTotalY, noX + tableWidth - qtyX, 20).fill("#eeeeee");
//     doc.font("Helvetica-Bold").fillColor("#000000").text("Grand Total:", qtyX, grandTotalY + 5).text(`$${grandTotal.toFixed(2)}`, totalX, grandTotalY + 5);

//     // Last Footer
//     drawFooter(doc, currentPage);

//     doc.end();
//   });
// }

// module.exports = { generateInvoice };


const PDFDocument = require("pdfkit");
const fetch = require("node-fetch");
const sharp = require("sharp");
const path = require("path");

let cachedLogoBuffer = null;
let cacheKey = null;

function generateInvoice(invoice) {
  return new Promise(async (resolve, reject) => {
    let buffers = [];
    let doc = new PDFDocument({ margin: 50 });

    doc.registerFont(
      "Regular",
      path.join(process.cwd(), "fonts", "NotoSansSC-Regular.ttf")
    );

    doc.registerFont(
      "Bold",
      path.join(process.cwd(), "fonts", "NotoSansSC-Bold.ttf")
    );

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      resolve(Buffer.concat(buffers));
    });

    const pageBottom = 720;
    const tableTop = 230;
    const rowHeight = 20;
    const rowsPerPage = Math.floor((pageBottom - tableTop - 100) / rowHeight); // safe margin

    // layout x positions (keep these in sync with drawing)
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

    function drawFooter(doc, currentPage, totalPages) {
      const footerText = `Thank you for your business, goods sold are neither returnable nor refundable.`;
      const footerText2 = `All amount stated in - ${invoice.company.currency}. All cheques should be crossed and made payable to`;
      const bankDetailText = `Name: ${invoice.company.name}, Bank Account: ${invoice.company.bank} ${invoice.company.account}`;
      doc
        .font("Helvetica-Oblique")
        .fontSize(10)
        .fillColor("#555555")
        .text(footerText, 50, pageBottom - 35, { align: "center" })
        .text(footerText2, 50, pageBottom - 20, { align: "center" })
        .font("Helvetica-BoldOblique")
        .fillColor("#000000")
        .text(bankDetailText, 50, pageBottom - 5, { align: "center" });

      // Page X of Y at bottom-right
      // doc
      //   .font("Helvetica")
      //   .fontSize(10)
      //   .fillColor("#000000")
      //   .text(`Page ${currentPage} of ${totalPages}`, pageWidth - 150, pageBottom - 20, {
      //     align: "right",
      //   });
    }

    // ---------- PRE-CALC TOTAL PAGES (simulate real layout) ----------
    function calcTotalPages() {
      // Use same fonts/sizes as when we render rows
      doc.font("Helvetica").fontSize(10);

      let pages = 1;
      let y = tableTop + rowHeight; // same starting y used in drawing loop

      for (let item of invoice.items) {
        // In drawing loop you check if (y > pageBottom - 100) BEFORE drawing the item
        if (y > pageBottom - 100) {
          pages++;
          y = tableTop + rowHeight;
        }

        const nameHeight = doc.heightOfString(String(item.name || ""), {
          width: descX - itemX - 5,
        });
        const descHeight = doc.heightOfString(String(item.description || ""), {
          width: qtyX - descX - 10,
        });

        const rowH = Math.max(rowHeight, nameHeight, descHeight + 10);
        y += rowH;
      }

      // After items, your code checks again whether we should start totals on a new page:
      if (y > pageBottom - 100) {
        pages++;
        y = tableTop; // drawing code resets to tableTop before totals
      }

      // Simulate totals block height (matches the offsets you use: +20, then +15 per line, rect 20)
      let offsetStart = y + 20;
      let totHeight = 0;
      totHeight += 15; // Subtotal
      if (invoice.customer.discount_rate) totHeight += 15;
      if (invoice.company.tax_rate) totHeight += 15;
      totHeight += 20; // Grand total rect

      if (offsetStart + totHeight > pageBottom - 100) {
        // If totals overflow, they'd need another page
        pages++;
      }

      return pages;
    }

    const totalPages = calcTotalPages();

    // ---------- HEADER (uses totalPages) ----------
    async function drawHeader(doc, invoice, currentPage) {
      await drawCompanyLogo(doc, invoice, "logo");

      doc
        .fontSize(16)
        .font("Helvetica-Bold")
        .fillColor("#000000")
        .text(invoice.company.name, 120, 55)
        .fontSize(10)
        .text("(" + invoice.company.tax_number + ")", 120, 75)
        .text(invoice.company.address, 120, 90, { width: 300 });

      if (invoice.company.phone) {
        doc.text(`Tel: ${invoice.company.phone}`, 120, 115);
      }
      if (invoice.company.email) {
        doc.text(`Email: ${invoice.company.email}`, 120, 128);
      }

      let z = 65;
      const lineHeight = 15;

      function drawField(label, value) {
        if (value) {
          doc
            .fontSize(12)
            .font("Helvetica")
            .text(label, headerRightTitle, z)
            .text(`: ${value}`, headerRightTitle + colon, z, {
              width: 180,
              continued: false,
              ellipsis: true,
            });
          z += lineHeight;
        }
      }

      drawField("Ref.", invoice.reference);
      drawField("D/O No", invoice.do_number);
      drawField("Terms", invoice.terms ? `${invoice.terms}` : null);
      drawField("Date", invoice.date);
      drawField("Page", `${currentPage} of ${totalPages}`);

      // Invoice Number (fix overlap)
      doc
        .fontSize(13)
        .font("Helvetica-Bold")
        .text("Invoice", headerRightTitle, 50)
        .text(`: ${invoice.invoice_number}`, headerRightTitle + colonBold, 50, {
          width: 180,
          continued: false,
          ellipsis: true,
        });

      // Customer
      doc.fontSize(12).font("Helvetica-Bold").text("Bill To:", 50, 150);

      doc
        .font("Bold")
        .text(invoice.customer.name, 100, 145, { width: 250 })
        .font("Helvetica")
        .text(invoice.customer.address, 100, 165, { width: 350 });

      if (invoice.customer.phone) {
        doc.text(`Tel: ${invoice.customer.phone}`, 100, 180);
      }
      if (invoice.customer.email) {
        doc.text(`Email: ${invoice.customer.email}`, 100, 195, { width: 250 });
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
        // add footer with accurate page numbers
        // drawFooter(doc, currentPage, totalPages);
        doc.addPage();
        currentPage++;
        await drawCompanyLogo(doc, invoice, "watermark");
        await drawHeader(doc, invoice, currentPage);
        drawTableHeader(doc, tableTop);
        y = tableTop + rowHeight;
      }

      // calculate dynamic row height (based on same widths as rendering)
      doc.font("Helvetica").fontSize(10);
      const nameHeight = doc.heightOfString(String(item.name || ""), {
        width: descX - itemX - 5,
      });
      const descHeight = doc.heightOfString(String(item.description || ""), {
        width: qtyX - descX - 10,
      });
      const rowHeightDynamic = Math.max(rowHeight, nameHeight, descHeight + 10);

      doc.font("Regular")
        .text(i + 1, noX + 5, y + 5, { width: itemX - noX - 5 }) // index column
        .text(item.name, itemX, y + 5, { width: descX - itemX - 5 }) // item name
        .text(item.description, descX, y + 5, {
          width: qtyX - descX - 10,
          continued: false,
        })
        .text(item.quantity, qtyX, y + 5, { width: priceX - qtyX - 5 })
        .text(`RM ${item.price.toFixed(2)}`, priceX, y + 5, { width: totalX - priceX - 5 })
        .text(`RM ${(item.quantity * item.price).toFixed(2)}`, totalX, y + 5);

      y += rowHeightDynamic;
    }

    // Totals
    const subtotal = invoice.items.reduce((sum, i) => sum + i.quantity * i.price, 0);
    const discount = invoice.customer.discount_rate ? subtotal * invoice.customer.discount_rate : 0;
    const tax = invoice.company.tax_rate ? (subtotal - discount) * invoice.company.tax_rate : 0;
    const grandTotal = subtotal - discount + tax;

    if (y > pageBottom - 100) {
      // draw footer with accurate totalPages before adding page
      // drawFooter(doc, currentPage, totalPages);
      doc.addPage();
      currentPage++;
      await drawCompanyLogo(doc, invoice, "watermark");
      await drawHeader(doc, invoice, currentPage);
      y = tableTop;
    }

    doc.moveTo(noX, y + 10).lineTo(noX + tableWidth, y + 10).strokeColor("#000000").stroke();

    //check amount for extend width
    const amount = grandTotal.toFixed(2);
    // Remove the decimal point to count only digits
    const digitCount = amount.replace(".", "").length;
    const widthlg = digitCount > 8 ? 120 : 0;
    const adjustXpos = digitCount > 8 ? 0 : 15;

    let offset = y + 20;
    doc.font("Helvetica").fontSize(12);
    doc.text("Subtotal:", qtyX, offset).text(`RM ${subtotal.toFixed(2)}`, totalX-adjustXpos, offset, {width:widthlg});
    offset += 15;

    if (invoice.customer.discount_rate) {
      doc.text(`Discount (${(invoice.customer.discount_rate * 100).toFixed(0)}%):`, qtyX, offset).text(`-$${discount.toFixed(2)}`, totalX, offset);
      offset += 15;
    }

    if (invoice.company.tax_rate) {
      doc.text(`Tax (${(invoice.company.tax_rate * 100).toFixed(0)}%):`, qtyX, offset).text(`$${tax.toFixed(2)}`, totalX, offset);
      offset += 15;
    }

    const grandTotalY = offset;
    doc.rect(qtyX, grandTotalY, noX + tableWidth - qtyX, 20).fill("#eeeeee");
    doc.font("Helvetica-Bold").fillColor("#000000").text("Grand Total:", qtyX, grandTotalY + 5).text(`RM ${grandTotal.toFixed(2)}`, totalX-adjustXpos, grandTotalY + 5, {width:widthlg});

    // Last Footer (final page)
    drawFooter(doc, currentPage, totalPages);

    doc.end();
  });
}

module.exports = { generateInvoice };

