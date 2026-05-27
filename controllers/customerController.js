const pool = require("../db");
const { validateSubscription } = require("../services/getServicesQuery");

// Create customer
exports.createCustomer = async (req, res) => {
    const { company_id, name, email, phone, address, discount_rate } = req.body;
    const tenantId = req.user.tenantId;

    try {
        // check on subscription details valid
        await validateSubscription(pool, tenantId, "customer", res);
        
        const result = await pool.query(
            `INSERT INTO customers 
            (tenant_id, company_id, name, email, phone, address, discount_rate, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
            RETURNING *`,
            [tenantId, company_id, name, email, phone, address, discount_rate]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Error creating customer:", err);
        res.status(500).json({ error: "server_error" });
    }
};

// Get all customers for a company
exports.getCustomers = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { companyId } = req.query; // optional filter by company

    try {
        let result;
        if (companyId) {
        result = await pool.query(
            `SELECT * FROM customers WHERE tenant_id=$1 AND company_id=$2 ORDER BY created_at DESC`,
            [tenantId, companyId]
        );
        } else {
        result = await pool.query(
            `SELECT * FROM customers WHERE tenant_id=$1 ORDER BY created_at DESC`,
            [tenantId]
        );
        }

        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching customers:", err);
        res.status(500).json({ error: "server_error" });
    }
};

// Get single customer by ID
exports.getCustomerById = async (req, res) => {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    try {
        const result = await pool.query(
            `SELECT * FROM customers WHERE id=$1 AND tenant_id=$2`,
            [id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "customer_not_found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("Error fetching customer:", err);
        res.status(500).json({ error: "server_error" });
    }
};

// Update customer
exports.updateCustomer = async (req, res) => {
    const { id } = req.params;
    const { company_id, name, email, phone, address, discount_rate } = req.body;
    const tenantId = req.user.tenantId;

    try {
            const result = await pool.query(
                `UPDATE customers 
                SET company_id=$1, name=$2, email=$3, phone=$4, address=$5, discount_rate=$6, updated_at=NOW()
                WHERE id=$7 AND tenant_id=$8
                RETURNING *`,
                [company_id, name, email, phone, address, discount_rate, id, tenantId]
            );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "customer_not_found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("Error updating customer:", err);
        res.status(500).json({ error: "server_error" });
    }
};

// Delete customer
exports.deleteCustomer = async (req, res) => {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    try {
        const result = await pool.query(
            `DELETE FROM customers WHERE id=$1 AND tenant_id=$2 RETURNING *`,
            [id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "customer_not_found" });
        }

        res.json({ message: "customer_deleted" });
    } catch (err) {
        console.error("Error deleting customer:", err);
        res.status(500).json({ error: "server_error" });
    }
};
