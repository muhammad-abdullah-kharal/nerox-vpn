/**
 * fix_server_endpoints.js
 * 
 * Run this to fix IP addresses in vpn_servers.
 */

require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const WG_PORT           = 51820;
const SSH_PORT          = 22;
const SSH_USER          = 'root';

const SERVERS = [
  {
    hostname     : 'de-frankfurt-01',
    endpoint_host: '159.65.116.82',
    ssh_host     : '159.65.116.82',
    ip_address   : '159.65.116.82/32',
  },
  {
    // The REAL London server from the screenshot
    hostname     : 'gb-london-08',
    endpoint_host: '138.68.142.167',
    ssh_host     : '138.68.142.167',
    ip_address   : '138.68.142.167/32',
  },
  {
    hostname     : 'ca-toronto-05',
    endpoint_host: '159.65.116.82', // Still using DE server as placeholder unless we have a CA server IP
    ssh_host     : '159.65.116.82',
    ip_address   : '159.65.116.82/32', 
  },
];

async function main() {
  const client = await pool.connect();
  try {
    console.log('Connected to PostgreSQL.\n');

    for (const s of SERVERS) {
      const res = await client.query(
        `UPDATE vpn_servers
            SET ip_address    = $1,
                endpoint_host = $2,
                endpoint_port = $3,
                ssh_host      = $4,
                ssh_port      = $5,
                ssh_user      = $6,
                status        = 'active'
          WHERE hostname = $7
          RETURNING hostname, ip_address, endpoint_host, endpoint_port, ssh_host, status`,
        [
          s.ip_address,
          s.endpoint_host,
          WG_PORT,
          s.ssh_host,
          SSH_PORT,
          SSH_USER,
          s.hostname,
        ]
      );

      if (res.rowCount === 0) {
        console.warn(`  ⚠  No row found for hostname="${s.hostname}" – skipped.`);
      } else {
        const row = res.rows[0];
        console.log(`  ✅ ${row.hostname}`);
      }
    }

    console.log('\n=== Final vpn_servers table ===');
    const { rows } = await client.query(
      `SELECT hostname, ip_address::text, endpoint_host, endpoint_port, ssh_host, status
         FROM vpn_servers
        ORDER BY hostname`
    );
    console.table(rows);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
