require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const { rows } = await pool.query(`
      SELECT s.session_id, s.user_id, s.status, s.client_public_key, 
             s.assigned_vpn_ip, s.created_at, v.ip_address, v.hostname
      FROM vpn_sessions s
      JOIN vpn_servers v ON s.server_id = v.server_id
      ORDER BY s.created_at DESC
      LIMIT 5
    `);
    console.log('Recent sessions:');
    rows.forEach(r => {
      console.log(`  ${r.created_at} | ${r.status} | ip=${r.assigned_vpn_ip} | pubkey=${r.client_public_key ? r.client_public_key.substring(0,20)+'...' : 'NULL'}`);
    });
  } catch (err) {
    console.error(err.message);
  } finally {
    await pool.end();
  }
}
run();
