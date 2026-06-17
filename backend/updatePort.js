require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("UPDATE vpn_servers SET endpoint_port = 4500, wg_port = 4500 WHERE server_id = 'f9b9bc47-a73d-46d3-aebd-7a768734a3bd'").then(res => {
  console.log('Updated to port 4500');
  pool.end();
});
