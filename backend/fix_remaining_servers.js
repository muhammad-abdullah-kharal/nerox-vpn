require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function main() {
  // Update India (vpn-india-bge) - previously France
  await pool.query(
    `UPDATE vpn_servers 
     SET hostname = 'in-bangalore-01',
         location = 'India',
         country_code = 'IN',
         protocol = 'WireGuard',
         ip_address = $1, 
         endpoint_host = $2, 
         endpoint_port = 51820,
         ssh_host = $3,
         ssh_user = 'root',
         ssh_port = 22,
         wg_public_key = $4,
         status = 'active'
     WHERE hostname = 'fr-paris-02'`,
    ['168.144.74.177/32', '168.144.74.177', '168.144.74.177', '2SPKEcPGAIYnzLjln9bZPKdmqInv/dJuTzPXkcn/qWc=']
  );
  console.log('✅ Updated India server (in-bangalore-01)');

  // Update Singapore (vpn-sgp) - previously Australia
  await pool.query(
    `UPDATE vpn_servers 
     SET hostname = 'sg-singapore-01',
         location = 'Singapore',
         country_code = 'SG',
         protocol = 'WireGuard',
         ip_address = $1, 
         endpoint_host = $2, 
         endpoint_port = 51820,
         ssh_host = $3,
         ssh_user = 'root',
         ssh_port = 22,
         wg_public_key = $4,
         status = 'active'
     WHERE hostname = 'au-sydney-03'`,
    ['139.59.227.78/32', '139.59.227.78', '139.59.227.78', 'GrzuCcEvdirdOcDAwhIkBYjgCSV0E2e2vQukQ9fGHwU=']
  );
  console.log('✅ Updated Singapore server (sg-singapore-01)');

  // Update San Francisco (vpn-sfo) - previously New York
  await pool.query(
    `UPDATE vpn_servers 
     SET hostname = 'us-sanfrancisco-01',
         location = 'United States',
         country_code = 'US',
         protocol = 'WireGuard',
         ip_address = $1, 
         endpoint_host = $2, 
         endpoint_port = 51820,
         ssh_host = $3,
         ssh_user = 'root',
         ssh_port = 22,
         wg_public_key = $4,
         status = 'active'
     WHERE hostname = 'us-newyork-01'`,
    ['64.23.142.203/32', '64.23.142.203', '64.23.142.203', 'OQuc8e9JzbcsE11g9oLDYJf0oHay+X06VvIhFHwpZy4=']
  );
  console.log('✅ Updated San Francisco server (us-sanfrancisco-01)');
  
  pool.end();
}

main().catch(console.error);
