const { Pool } = require('pg');
require('dotenv').config();

// Use the single connection string from Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Neon cloud connection
  }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Optional: don't exit in production unless critical
});

module.exports = pool;