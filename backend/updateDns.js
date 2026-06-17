require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await pool.query("UPDATE vpn_servers SET dns_servers = '8.8.8.8'");
    console.log('Updated rows:', res.rowCount);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
