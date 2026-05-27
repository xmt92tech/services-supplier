const pool = require("../db");
const { validateSubscription } = require("../services/getServicesQuery");

// Create company
exports.createCompany = async (req, res) => {
  const { name, address, phone, email, tax_number, bank, account, logo_url, logo_base64, currency, tax_rate } = req.body;
  const tenantId = req.user.tenantId;

//   try {
//     const result = await pool.query(
//       `INSERT INTO companies 
//        (tenant_id, name, address, phone, email, tax_number, bank, account, logo_url, logo_base64, currency, tax_rate, updated_at)
//        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
//        RETURNING *`,
//       [tenantId, name, address, phone, email, tax_number, bank, account, logo_url, logo_base64, currency, tax_rate]
//     );

//     res.status(201).json(result.rows[0]);
//   } catch (err) {
//     console.error("Error creating company:", err);
//     res.status(500).json({ error: "server_error" });
//   }
    
    try {

        // check on subscription details valid
        await validateSubscription(pool, tenantId, "company", res);

        // Above validation passed, proceed to insertion transaction
        const result = await pool.query(
            `INSERT INTO companies 
            (tenant_id, name, address, phone, email, tax_number, bank, account, logo_url, logo_base64, currency, tax_rate, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
            RETURNING *`,
            [tenantId, name, address, phone, email, tax_number, bank, account, logo_url, logo_base64, currency, tax_rate]
        );

        res.status(201).json(result.rows[0]);

    } catch (err) {
        console.error("Create company failed:", err.stack);
        res.status(500).json({ error: "server_error" });
    }

};

// Get all companies for tenant
exports.getCompanies = async (req, res) => {
    const tenantId = req.user.tenantId;

    try {
        const result = await pool.query(
        `SELECT * FROM companies WHERE tenant_id = $1 ORDER BY created_at DESC`,
        [tenantId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching companies:", err);
        res.status(500).json({ error: "server_error" });
    }
};

// Get single company by ID
exports.getCompanyById = async (req, res) => {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    try {
        const result = await pool.query(
        `SELECT * FROM companies WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId]
        );

        if (result.rows.length === 0) {
        return res.status(404).json({ error: "company_not_found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("Error fetching company:", err);
        res.status(500).json({ error: "server_error" });
    }
};

// Update company
exports.updateCompany = async (req, res) => {
    const { id } = req.params;
    const { name, address, phone, email, tax_number, bank, account, logo_url, logo_base64, currency, tax_rate } = req.body;
    const tenantId = req.user.tenantId;

    try {
        const result = await pool.query(
            `UPDATE companies 
            SET name=$1, address=$2, phone=$3, email=$4, tax_number=$5, bank=$6, account=$7, logo_url=$8, logo_base64=$9, currency=$10, tax_rate=$11, updated_at=NOW()
            WHERE id=$12 AND tenant_id=$13
            RETURNING *`,
            [name, address, phone, email, tax_number, bank, account, logo_url, logo_base64, currency, tax_rate, id, tenantId]
        );

        if (result.rows.length === 0) {
        return res.status(404).json({ error: "company_not_found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("Error updating company:", err);
        res.status(500).json({ error: "server_error" });
    }
};

// Delete company
exports.deleteCompany = async (req, res) => {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    try {
        const result = await pool.query(
        `DELETE FROM companies WHERE id = $1 AND tenant_id = $2 RETURNING *`,
        [id, tenantId]
        );

        if (result.rows.length === 0) {
        return res.status(404).json({ error: "company_not_found" });
        }

        res.json({ message: "company_deleted" });
    } catch (err) {
        console.error("Error deleting company:", err);
        res.status(500).json({ error: "server_error" });
    }
};
