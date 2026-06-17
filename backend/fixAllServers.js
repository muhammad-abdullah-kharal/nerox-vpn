require('dotenv').config();
const { Pool } = require('pg');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const { rows } = await pool.query('SELECT ip_address FROM vpn_servers WHERE status = $1', ['active']);
    const keyPath = process.env.SSH_PRIVATE_KEY_PATH || '/root/.ssh/id_rsa';
    
    for (const row of rows) {
      const host = row.ip_address;
      console.log('Fixing server:', host);
      
      const args = [
        '-i', keyPath,
        '-o', 'BatchMode=yes',
        '-o', 'StrictHostKeyChecking=accept-new',
        '-o', 'ConnectTimeout=10',
        `root@${host}`,
        'ufw disable; iptables -P FORWARD ACCEPT; iptables -F FORWARD; iptables -A FORWARD -i wg0 -j ACCEPT; iptables -A FORWARD -o wg0 -j ACCEPT; iptables -t nat -F POSTROUTING; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE; wg syncconf wg0 <(wg-quick strip wg0)'
      ];
      
      try {
        await execFileAsync('ssh', args, { timeout: 15000 });
        console.log('  -> OK');
      } catch (err) {
        console.log('  -> FAILED:', err.message);
      }
    }
  } catch (err) {
    console.error('DB Error:', err);
  } finally {
    await pool.end();
  }
}
run();
