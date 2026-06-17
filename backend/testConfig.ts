require('dotenv').config();
const { VpnService } = require('./src/services/VpnService');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const { rows } = await pool.query("SELECT server_id FROM vpn_servers LIMIT 1");
    if (rows.length === 0) return console.log("No servers");
    const serverId = rows[0].server_id;
    
    // find any user
    const { rows: uRows } = await pool.query("SELECT user_id FROM users LIMIT 1");
    if (uRows.length === 0) return console.log("No users");
    const userId = uRows[0].user_id;

    // Use test IP
    const session = await VpnService.startSession(userId, serverId, "1.1.1.1");
    console.log(session.config);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
