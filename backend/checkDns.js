require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT dns_servers FROM vpn_servers WHERE server_id = 'f9b9bc47-a73d-46d3-aebd-7a768734a3bd'").then(res => {
  console.log(res.rows[0]);
  pool.end();
});
