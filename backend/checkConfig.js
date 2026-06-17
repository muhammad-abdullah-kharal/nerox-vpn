require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT configuration FROM vpn_sessions WHERE session_id = '944fe606-adec-470b-930c-0b24a3cc883f'").then(res => {
  console.log(res.rows[0].configuration);
  pool.end();
});
