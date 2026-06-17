require('dotenv').config();
const { Pool } = require('pg');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function hardenServers() {
  const { rows } = await pool.query("SELECT server_id, hostname, ssh_host FROM vpn_servers WHERE status = 'active'");
  
  for (const server of rows) {
    console.log(`Hardening ${server.hostname} (${server.ssh_host})...`);
    
    // 1. Update Database Port
    await pool.query("UPDATE vpn_servers SET endpoint_port = 4500, wg_port = 4500 WHERE server_id = $1", [server.server_id]);
    
    // 2. SSH Command to Harden
    const sshCmd = `ssh -i "C:\\Users\\AFZAL COMPUTERS\\.ssh\\nerox_backend_rsa" -o StrictHostKeyChecking=no root@${server.ssh_host} ` + 
      `"sed -i 's/ListenPort.*/ListenPort = 4500/g' /etc/wireguard/wg0.conf && ` +
      `sed -i 's/MTU.*/MTU = 1120/g' /etc/wireguard/wg0.conf && ` +
      `wg-quick down wg0; wg-quick up wg0 && ` +
      `iptables -t mangle -D FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu 2>/dev/null; ` +
      `iptables -t mangle -A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu"`;
      
    try {
      await execPromise(sshCmd);
      console.log(`✅ Successfully hardened ${server.hostname}`);
    } catch (err) {
      console.error(`❌ Failed to harden ${server.hostname}:`, err.message);
    }
  }
  
  await pool.end();
  console.log("Done!");
}

hardenServers();
