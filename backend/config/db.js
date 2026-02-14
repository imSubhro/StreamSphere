const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Supabase and many cloud providers
  }
});

pool.on('connect', () => {
  console.log('Connected to the PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err.message);
  // Don't crash the server — log and let it try to reconnect
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
