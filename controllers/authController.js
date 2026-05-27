// const jwt = require("jsonwebtoken");

// exports.login = (req, res) => {
//   const { clientId, clientSecret } = req.body;

//   // ✅ Replace with real DB lookup
//   if (clientId === process.env.CLIENT_ID && clientSecret === process.env.CLIENT_SECRET) {
//     const token = jwt.sign({ clientId }, process.env.JWT_SECRET, { expiresIn: "1h" });
//     return res.json({ token });
//   }

//   res.status(401).json({ error: "invalid_credentials" });
// };

const pool = require("../db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password" });
  }

  try {
    // Fetch user with tenant info
    const result = await pool.query(
      `SELECT u.id AS user_id, u.email, u.password_hash, u.role, u.tenant_id, t.name AS tenant_name, t.email AS tenant_email
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const user = result.rows[0];

    // Compare password using bcrypt
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.user_id,
        tenantId: user.tenant_id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      token,
      user: {
        id: user.user_id,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
        tenantName: user.tenant_name,
        tenantEmail: user.tenant_email
      }
    });

  } catch (err) {
    console.error("Login error:", err.stack);
    res.status(500).json({ error: "internal_server_error" });
  }
};

// =================== REGISTER ===================
exports.register = async (req, res) => {
  const { email, password, role, tenantName, tenantEmail } = req.body;

  if (!email || !password || !role || !tenantName) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1️⃣ Check or create tenant
    let tenantRes = await client.query(
      `SELECT id FROM tenants WHERE name = $1`,
      [tenantName]
    );

    let tenantId;
    if (tenantRes.rows.length === 0) {
      const insertTenant = await client.query(
        `INSERT INTO tenants (name, email) VALUES ($1, $2) RETURNING id`,
        [tenantName, tenantEmail]
      );
      tenantId = insertTenant.rows[0].id;

      // Assign subscription plan to tenant, mainly for saas purpose
      const tenantSubscibe = await client.query(
        `INSERT INTO tenant_subscriptions (tenant_id, plan_id, start_date, end_date, is_active)
        VALUES ($1, $2, NOW(), NOW() + interval '1 month', true) RETURNING id`,
        [tenantId, '1']
      );

      if (tenantSubscibe.rows.length === 0) {
        return res.status(500).json({ error: "error creating tenant subscription" });
      }

    } else {
      tenantId = tenantRes.rows[0].id;
    }

    // 2️⃣ Check if email already exists for this tenant
    const userExists = await client.query(
      `SELECT id FROM users WHERE email = $1 AND tenant_id = $2`,
      [email, tenantId]
    );
    if (userExists.rows.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // 3️⃣ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4️⃣ Insert user
    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, role, tenant_id) 
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, role`,
      [email, hashedPassword, role, tenantId]
    );

    await client.query("COMMIT");

    const user = userRes.rows[0];

    // 5️⃣ Generate JWT immediately
    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: tenantId,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId,
        tenantName,
        tenantEmail
      }
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Registration failed:", err.stack);
    res.status(500).json({ error: "internal_server_error" });
  } finally {
    client.release();
  }
};
