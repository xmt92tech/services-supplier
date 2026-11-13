// const { generateInvoice } = require("../services/invoiceGenerator");

// exports.createInvoice = async (req, res) => {
//   try {
//     const invoiceData = req.body;
//     const pdfBuffer = await generateInvoice(invoiceData);

//     res.setHeader("Content-Type", "application/pdf");
//     res.setHeader("Content-Disposition", `attachment; filename=invoice-${invoiceData.invoice_number}.pdf`);
//     res.send(pdfBuffer);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Failed to generate invoice" });
//   }
// };
const pool = require("../db");
const { generateInvoice } = require("../services/invoiceGenerator");
const { validateSubscription } = require("../services/getServicesQuery")

exports.createInvoice = async (req, res) => {
  const invoiceData = req.body; // expects: company_id, customer_id, items[], reference, do_number, terms

  if (!invoiceData.company_id || !invoiceData.customer_id || !invoiceData.items?.length) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const tenantId = req.user?.tenantId; // from auth middleware
  if (!tenantId) return res.status(401).json({ error: "Tenant not found in token" });

  // check on subscription details valid
  const subscription = await validateSubscription(pool, tenantId, "company", res);



  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    if (!subscription.valid){
      await client.query("ROLLBACK");
      return res.status(subscription.status).json({
          error: subscription.error
      });
    }

    // ===== 1️⃣ Fetch Company Data =====
    const companyRes = await client.query(
      `SELECT id, name, address, phone, email, currency, bank, account, 
      logo_url AS "logoUrl", logo_base64 AS "logoBase64", tax_rate, tax_number
      FROM companies WHERE id = $1 AND tenant_id = $2`,
      [invoiceData.company_id, tenantId]
    );

    if (companyRes.rows.length === 0) {
      await client.query("ROLLBACK");
      //client.release();
      return res.status(404).json({ error: "Company not found" });
    }
    invoiceData.company = companyRes.rows[0];

    // ===== 2️⃣ Fetch Customer Data =====
    const customerRes = await client.query(
      `SELECT id, name, address, phone, email, discount_rate 
      FROM customers WHERE id = $1 AND tenant_id = $2`,
      [invoiceData.customer_id, tenantId]
    );

    if (customerRes.rows.length === 0) {
      await client.query("ROLLBACK");
      //client.release();
      return res.status(404).json({ error: "Customer not found" });
    }
    invoiceData.customer = customerRes.rows[0];

    // ===== 3️⃣ Generate Invoice Number =====
    const today = new Date();
    const datePart = `${String(today.getMonth() + 1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
    const prefix = `HL-${datePart}`;

    const seqRes = await client.query(
      `INSERT INTO invoice_sequences (tenant_id, company_id, prefix, last_number)
      VALUES ($1,$2,$3,1)
      ON CONFLICT (company_id, prefix) DO UPDATE
      SET last_number = invoice_sequences.last_number + 1
      RETURNING last_number`,
      [tenantId, invoiceData.company_id, prefix]
    );

    const seqNumber = String(seqRes.rows[0].last_number).padStart(3,'0');
    const invoiceNumber = `${prefix}/${seqNumber}`;
    invoiceData.invoice_number = invoiceNumber;

    // ===== 4️⃣ Insert Invoice =====
    const invoiceRes = await client.query(
      `INSERT INTO invoices
      (tenant_id, company_id, customer_id, invoice_number, invoice_date, discount_rate, tax_rate, reference, do_number, terms)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id`,
      [
        tenantId,
        invoiceData.company_id,
        invoiceData.customer_id,
        invoiceNumber,
        invoiceData.date,
        invoiceData.customer.discount_rate,
        invoiceData.company.tax_rate,
        invoiceData.reference,
        invoiceData.do_number,
        invoiceData.terms
      ]
    );
    const invoiceId = invoiceRes.rows[0].id;

    // ===== 5️⃣ Bulk Insert Invoice Items =====
    const itemValues = [];
    const placeholders = [];
    invoiceData.items.forEach((item, i) => {
      const idx = i * 5;
      placeholders.push(`($${idx + 1},$${idx + 2},$${idx + 3},$${idx + 4},$${idx + 5})`);
      itemValues.push(invoiceId, item.name, item.description, item.quantity, item.price);
    });

    if (itemValues.length > 0) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, name, description, quantity, unit_price) VALUES ${placeholders.join(",")}`,
        itemValues
      );
    }

    // ===== 6️⃣ Update Totals =====
    await client.query(
      `UPDATE invoices i
      SET subtotal = sub.total_items,
          total = sub.total_items
                  - COALESCE(i.discount_rate,0)*sub.total_items
                  + COALESCE(i.tax_rate,0)*(sub.total_items - COALESCE(i.discount_rate,0)*sub.total_items)
      FROM (
        SELECT invoice_id, SUM(quantity * unit_price) AS total_items
        FROM invoice_items
        WHERE invoice_id = $1
        GROUP BY invoice_id
      ) AS sub
      WHERE i.id = sub.invoice_id`,
      [invoiceId]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    // ===== 7️⃣ Generate PDF =====
    const pdfBuffer = await generateInvoice(invoiceData);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice-${invoiceNumber}.pdf`);
    return res.send(pdfBuffer);

  } catch (err) {
    // await client.query("ROLLBACK");
    // console.error("Invoice creation failed:", err.stack);
    // res.status(500).json({ error: "Failed to create invoice" });

    // console.error("Invoice creation failed:", err.stack);

    if (transactionStarted) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackErr) {
            console.error("Rollback failed:", rollbackErr);
        }
    }

    if (res.headersSent) {
        return;
    }

    return res.status(500).json({
        error: "Failed to create invoice"
    });

  } finally {
    client.release();
  }
};

exports.previewInvoice = async (req, res) => {
  try {
    const invoiceData = req.body; //expected invoice id only

    const tenantId = req.user?.tenantId; // from auth middleware
    if (!tenantId) return res.status(401).json({ error: "Tenant not found in token" });

    const client = await pool.connect();

    const invoiceRes = await client.query(
      `SELECT 
        i.invoice_number,
        to_char(i.invoice_date, 'YYYY-MM-DD') as date,
        i.reference,
        i.do_number,
        i.terms,
        json_build_object(
          'name', c.name,
          'address', c.address,
          'phone', c.phone,
          'email', c.email,
          'currency', c.currency,
          'bank', c.bank,
          'account', c.account,
          'logoUrl', c.logo_url,
          'logoBase64', c.logo_base64,
          'tax_rate', i.tax_rate,
          'tax_number', c.tax_number
        ) AS company,
        json_build_object(
          'name', cu.name,
          'address', cu.address,
          'phone', cu.phone,
          'email', cu.email,
          'discount_rate', i.discount_rate
        ) AS customer,
        COALESCE(
          json_agg(
            json_build_object(
              'name', v.name,
              'description', v.description,
              'quantity', v.quantity,
              'price', v.unit_price
            )
          ) FILTER (WHERE v.id IS NOT NULL), '[]'
        ) AS items

      FROM invoices i
      LEFT JOIN invoice_items v ON i.id = v.invoice_id
      LEFT JOIN companies c ON i.company_id = c.id
      LEFT JOIN customers cu ON i.customer_id = cu.id
      WHERE i.tenant_id = $1 AND i.id = $2
      GROUP BY i.id, c.id, cu.id;`,
      [tenantId, invoiceData.invoice_id]
    )

    if (invoiceRes.rows.length === 0) {
      return res.status(404).json({ error: "invoice not found" });
    }

    //res.json(invoiceRes.rows[0]);

    const pdfBuffer = await generateInvoice(invoiceRes.rows[0]);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice-${invoiceRes.rows[0].invoice_number}.pdf`);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to preview invoice" });
  }
};

exports.getInvoices = async (req, res) => {
  try {
    const invoiceData = req.body; //expected invoice date from and to

    const tenantId = req.user?.tenantId; // from auth middleware
    if (!tenantId) return res.status(401).json({ error: "Tenant not found in token" });

    const results = await pool.query(
      `SELECT invoice_id, invoice_number, invoice_date, 
      company_name, customer_name, subtotal, discount_amt, 
      tax_amt, total, reference, do_number, terms, created_at
      FROM tenant_invoice_list
      WHERE invoice_date >= $1 
      AND invoice_date <= $2
      AND tenant_id = $3`,
      [invoiceData.datefrm, invoiceData.dateto, tenantId]
    );

    if (results.rows.length === 0) {
      return res.json({ message: "invoice not found within date range." });
    }

    res.json(results.rows)
    
  } catch (err) {
    console.error("Error fetching invoice:", err);
    res.status(500).json({ error: "server_error" });
  }
};

exports.getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const tenantId = req.user.tenantId; // from auth middleware
    if (!tenantId) return res.status(401).json({ error: "Tenant not found in token" });

    const results = await pool.query(
      `SELECT invoice_id, invoice_number, invoice_date, 
      company_name, customer_name, subtotal, discount_amt, 
      tax_amt, total, reference, do_number, terms, created_at
      FROM tenant_invoice_list
      WHERE invoice_id = $1
      AND tenant_id = $2`,
      [id, tenantId]
    );

    if (results.rows.length === 0) {
      return res.json({ message: "invoice not found." });
    }

    res.json(results.rows)
    
  } catch (err) {
    console.error("Error fetching invoice:", err);
    res.status(500).json({ error: "server_error" });
  }
};

exports.updateInvoice = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const {
      invoice_number,
      invoice_date,
      reference,
      do_number,
      terms,
      discount_rate,
      tax_rate,
      items
    } = req.body;

    await client.query("BEGIN");

    // 1. Update invoice master
    const updateInvoiceQuery = `
      UPDATE invoices
      SET
        invoice_number = $1,
        invoice_date = $2,
        reference = $3,
        do_number = $4,
        terms = $5,
        discount_rate = $6,
        tax_rate = $7,
        updated_at = NOW()
      WHERE id = $8
    `;
    await client.query(updateInvoiceQuery, [
      invoice_number,
      invoice_date,
      reference,
      do_number,
      terms,
      discount_rate,
      tax_rate,
      id
    ]);

    // 2. Batch update invoice_items with parameterized VALUES
    if (items && items.length > 0) {
      // Build a parameterized VALUES clause
      const valueClauses = [];
      const params = [];

      items.forEach((item, idx) => {
        const base = idx * 6;
        valueClauses.push(
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`
        );
        params.push(
          item.id,
          id,
          item.description,
          item.quantity,
          item.unit_price,
          item.name
        );
      });

      console.log(valueClauses.join(", "));
      console.log(params);

      const updateItemsQuery = `
        WITH data (id, invoice_id, description, quantity, unit_price, name) AS (
          VALUES ${valueClauses.join(", ")}
        )
        UPDATE invoice_items
        SET
          description = data.description,
          quantity = data.quantity,
          unit_price = data.unit_price,
          name = data.name
        FROM (
    SELECT 
      id::integer,
      invoice_id::integer,
      description,
      quantity::numeric,
      unit_price::numeric,
      name
    FROM data
  ) AS data
        WHERE invoice_items.id = data.id
          AND invoice_items.invoice_id = data.invoice_id;
      `;

      await client.query(updateItemsQuery, params);
    }

    // 3. Update invoice grand total
    const updateTotalQuery = `
      WITH item_sum AS (
        SELECT COALESCE(SUM(total), 0) AS subtotal
        FROM invoice_items
        WHERE invoice_id = $1
      )
      UPDATE invoices
      SET subtotal = item_sum.subtotal, 
      total = (
        ROUND(COALESCE((item_sum.subtotal * (1 - discount_rate)) * (1 + tax_rate),0),2)
      )
      FROM item_sum
      WHERE id = $1;
    `;
    await client.query(updateTotalQuery, [id]);

    await client.query("COMMIT");
    res.status(200).json({ message: "Invoice updated successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error updating invoice:", err);
    res.status(500).json({ message: "Error updating invoice", error: err.message });
  } finally {
    client.release();
  }
};

exports.deleteInvoice = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query("BEGIN");

    // 1️⃣ Soft delete invoice
    await client.query(
      `UPDATE invoices 
       SET deleted_at = NOW()
       WHERE id = $1 and deleted_at IS NULL`,
      [id]
    );

    // 2️⃣ Soft delete related items
    await client.query(
      `UPDATE invoice_items 
       SET deleted_at = NOW()
       WHERE invoice_id = $1 and deleted_at IS NULL`,
      [id]
    );

    await client.query("COMMIT");
    res.status(200).json({ message: "Invoice deleted successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error deleting invoice:", err);
    res.status(500).json({ message: "Error deleting invoice", error: err.message });
  } finally {
    client.release();
  }
};
