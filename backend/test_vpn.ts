import { VpnService } from './src/services/VpnService';
import pool from './src/config/db';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  try {
    const { rows } = await pool.query(\"SELECT * FROM vpn_servers WHERE status = 'active' LIMIT 1\");
    if (rows.length === 0) return console.log('No active servers');
    const server = rows[0];
    console.log('Server:', server.hostname, server.ip_address);
    const out1 = await VpnService.execSsh(server, 'sysctl net.ipv4.ip_forward');
    console.log('IP Forwarding:', out1.trim());
    const out2 = await VpnService.execSsh(server, 'iptables -t nat -S POSTROUTING');
    console.log('NAT Rules:', out2.trim());
  } catch(e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
