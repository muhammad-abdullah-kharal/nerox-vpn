require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query("SELECT ip_address FROM vpn_servers WHERE status = 'active' LIMIT 1")
  .then(res => console.log(res.rows[0].ip_address))
  .catch(err => console.error(err.message))
  .finally(() => pool.end());
