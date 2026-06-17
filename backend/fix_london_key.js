require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function main() {
  await pool.query(
    "UPDATE vpn_servers SET wg_public_key = $1 WHERE hostname = $2",
    ['pQmxbl/yoxDhTJKc3UsM2LBxMRL7zB/oAJ6WV8INknc=', 'gb-london-08']
  );
  console.log('✅ Updated public key for London server');
  
  const { rows } = await pool.query("SELECT hostname, wg_public_key FROM vpn_servers WHERE hostname = 'gb-london-08'");
  console.log(rows[0]);
  pool.end();
}

main().catch(console.error);
