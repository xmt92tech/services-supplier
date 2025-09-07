const jwt = require("jsonwebtoken");

exports.login = (req, res) => {
  const { clientId, clientSecret } = req.body;

  // ✅ Replace with real DB lookup
  if (clientId === process.env.CLIENT_ID && clientSecret === process.env.CLIENT_SECRET) {
    const token = jwt.sign({ clientId }, process.env.JWT_SECRET, { expiresIn: "1h" });
    return res.json({ token });
  }

  res.status(401).json({ error: "invalid_credentials" });
};
