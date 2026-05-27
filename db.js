// models/db.js
const { Pool } = require("pg");
require("dotenv").config(); // load environment variables from .env

const pool = new Pool({
  user: process.env.DB_USER,       // e.g., 'postgres'
  host: process.env.DB_HOST,       // e.g., 'localhost'
  database: process.env.DB_NAME,   // your DB name
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,       // e.g., 5432
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

module.exports = pool;
