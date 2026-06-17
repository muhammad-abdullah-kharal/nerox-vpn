require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function main() {
  await pool.query(
    `UPDATE vpn_servers 
     SET ip_address = $1, 
         endpoint_host = $2, 
         endpoint_port = 51820,
         ssh_host = $3,
         ssh_user = 'root',
         ssh_port = 22,
         wg_public_key = $4,
         status = 'active'
     WHERE hostname = $5`,
    ['178.128.233.82/32', '178.128.233.82', '178.128.233.82', 'bdGL7tczv3vkhlWQ/JnwQUKLBoha2xWstxeneIK4UmM=', 'ca-toronto-05']
  );
  console.log('✅ Updated Canada server (ca-toronto-05)');
  
  const { rows } = await pool.query("SELECT hostname, ip_address, wg_public_key FROM vpn_servers WHERE hostname = 'ca-toronto-05'");
  console.log(rows[0]);
  pool.end();
}

main().catch(console.error);
