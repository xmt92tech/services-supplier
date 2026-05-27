async function getTenantSubscription(client, tenantId) {
    const query = `SELECT * FROM tenant_subscription_status WHERE tenant_id = $1`;
    const result = await client.query(query, [tenantId]);
    return result.rows[0];
}

async function validateSubscription(client, tenantId, type, res) {
  const sub = await getTenantSubscription(client, tenantId);

  if (!sub) {
    // throw new Error("Subscription plan details not found.");
    return res.status(404).json({ error: "Subscription plan details not found." });
  }

  if (!sub.is_active) {
    // throw new Error("Subscription is inactive. Action not allowed.");
    return res.status(403).json({ error: "Subscription is inactive. Action not allowed." });
  }

  if (sub.days_left <= 0) {
    // throw new Error("Subscription has expired. Action not allowed.");
    return res.status(403).json({ error: "Subscription has been expire. Action not allowed." });
  }

  // check limits
  let query, limit, used;
  if (type === "company") {
    query = `SELECT COUNT(*) AS used FROM companies WHERE tenant_id = $1`;
    limit = sub.company_limit;
  } else if (type === "customer") {
    query = `SELECT COUNT(*) AS used FROM customers WHERE tenant_id = $1`;
    limit = sub.customer_limit;
  } else if (type === "invoice") {
    query = `SELECT COUNT(*) AS used FROM invoices WHERE tenant_id = $1`;
    limit = sub.invoice_limit;
  }

  if (query) {
    const result = await client.query(query, [tenantId]);
    used = parseInt(result.rows[0].used, 10);

    if (used >= limit) {
      // throw new Error(`${type.charAt(0).toUpperCase() + type.slice(1)} limit has been reached for your plan.`);
      return res.status(403).json({ error: `${type.charAt(0).toUpperCase() + type.slice(1)} limit has been reached for your plan.` });
    }
  }

  return true; // passed all checks
}

module.exports = { getTenantSubscription, validateSubscription };