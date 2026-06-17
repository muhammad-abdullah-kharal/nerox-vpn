import pool from '../config/db';
import { execFile } from 'child_process';
import util from 'util';

const execFileAsync = util.promisify(execFile);

type WireGuardServer = {
  server_id: string;
  hostname: string;
  ip_address: string;
  location: string;
  country_code: string;
  protocol: string;
  is_premium?: boolean;
  max_connections?: number;
  ssh_host?: string;
  ssh_port?: number;
  ssh_user?: string;
  wg_interface?: string;
  wg_public_key?: string;
  wg_port?: number;
  wg_subnet?: string;
  endpoint_host?: string;
  endpoint_port?: number;
  dns_servers?: string;
};

type WireGuardKeyPair = {
  privateKey: string;
  publicKey: string;
};

type DbClient = {
  query: (text: string, params?: any[]) => Promise<any>;
};

export class VpnService {
  static async getServers(userId: string) {
    // 1. Check user subscription
    const userRes = await pool.query(
      'SELECT plan_type, subscription_end_date, authorized_regions FROM users WHERE user_id = $1',
      [userId]
    );
    
    const user = userRes.rows[0];
    const isPremium = user?.plan_type === 'premium' && 
                     (!user?.subscription_end_date || new Date(user?.subscription_end_date) > new Date());
    const authorizedRegions = user?.authorized_regions || ['Global'];

    // 2. Build Query
    let queryText = `
        SELECT server_id, hostname, ip_address::text, location, country_code, current_load, 
               max_connections, protocol, status, "is_premium", "is_streaming_optimized", avg_latency_ms
        FROM vpn_servers
        WHERE status = 'active'
        AND protocol = 'WireGuard'
        AND COALESCE(current_load, 0) < COALESCE(max_connections, 1000)
    `;

    const queryParams: any[] = [];
    if (!isPremium) {
      queryText += ' AND "is_premium" = FALSE ORDER BY current_load ASC LIMIT 3';
    } else {
      if (!authorizedRegions.includes('Global')) {
        queryParams.push(authorizedRegions);
        queryText += ` AND country_code = ANY($${queryParams.length})`;
      }
      queryText += ' ORDER BY "is_premium" DESC, current_load ASC';
    }

    const { rows } = await pool.query(queryText, queryParams);
    return rows;
  }

  static startMonitoring() {
    if (process.env.WG_MONITORING_ENABLED === 'false') {
      console.log('[Monitoring] WireGuard monitoring disabled by WG_MONITORING_ENABLED=false');
      return;
    }

    console.log('[Monitoring] Starting WireGuard server health checks...');
    setInterval(async () => {
      try {
        const { rows: servers } = await pool.query(
          `SELECT server_id, hostname, ip_address::text, location, country_code, protocol,
                  ssh_host, ssh_port, ssh_user, wg_interface, wg_public_key, wg_port,
                  wg_subnet::text, endpoint_host, endpoint_port, dns_servers
           FROM vpn_servers
           WHERE protocol = 'WireGuard' AND status <> 'inactive'`
        );

        for (const server of servers as WireGuardServer[]) {
          try {
            const iface = this.getInterface(server);
            const peersOutput = await this.execSsh(server, `wg show ${iface} peers`);
            const activeConnections = peersOutput
              ? peersOutput.split(/\r?\n/).filter(Boolean).length
              : 0;

            await pool.query(
              `UPDATE vpn_servers
               SET current_load = $1,
                   status = 'active',
                   last_health_check = NOW()
               WHERE server_id = $2`,
              [activeConnections, server.server_id]
            );

            await pool.query(
              `INSERT INTO server_metrics (server_id, cpu_usage, avg_latency_ms, active_connections) 
               VALUES ($1, COALESCE((SELECT cpu_usage FROM vpn_servers WHERE server_id = $1), 0),
                       COALESCE((SELECT avg_latency_ms FROM vpn_servers WHERE server_id = $1), 0), $2)`,
              [server.server_id, activeConnections]
            );
          } catch (error) {
            console.error(`[Monitoring] WireGuard health check failed for ${server.hostname}:`, error);
            await pool.query(
              'INSERT INTO server_availability_logs (server_id, status, reason) VALUES ($1, $2, $3)',
              [server.server_id, 'maintenance', 'WireGuard SSH health check failed']
            );
          }
        }
      } catch (err) {
        console.error('[Monitoring] Error during health check:', err);
      }
    }, 60000); // Every 60 seconds
  }

  /**
   * Ported from PLpgSQL: get_smart_servers
   * Handles regional access, premium filtering, and load balancing
   */
  static async getSmartServers(userId: string, amount: number = 3, preferredProtocol: string = 'Auto') {
    // 1. Get user plan and authorized regions
    const userRes = await pool.query(
      'SELECT plan_type, authorized_regions FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (userRes.rows.length === 0) throw new Error('User not found');
    
    const user = userRes.rows[0];
    const isPremium = user.plan_type === 'premium';
    const authorizedRegions = user.authorized_regions || ['Global'];

    // 2. Build Query
    let queryText = `
      SELECT 
        s.server_id, s.hostname, s.ip_address, s.location, 
        s.country_code, COALESCE(s.current_load, 0) as current_load, 
        s.max_connections, s.protocol, s."is_premium", s."is_streaming_optimized", s.status
      FROM vpn_servers s
      WHERE s.status = 'active'
      AND s.protocol = 'WireGuard'
      AND COALESCE(s.current_load, 0) < COALESCE(s.max_connections, 1000)
    `;

    const queryParams: any[] = [];

    // 3. Access Logic
    if (isPremium) {
      if (!authorizedRegions.includes('Global')) {
        queryParams.push(authorizedRegions);
        queryText += ` AND s.country_code = ANY($${queryParams.length})`;
      }
    } else {
      // Free users restricted to 5 specific countries (US, GB, DE, SG, CA)
      const freeCountries = ['US', 'GB', 'DE', 'SG', 'CA'];
      queryParams.push(freeCountries);
      queryText += ` 
        AND s."is_premium" = FALSE 
        AND s."is_streaming_optimized" = FALSE
        AND s.country_code = ANY($${queryParams.length})
      `;
    }

    // Protocol filter
    if (preferredProtocol !== 'Auto') {
      queryParams.push(preferredProtocol);
      queryText += ` AND s.protocol = $${queryParams.length}`;
    }

    queryText += ` ORDER BY s."is_premium" DESC, s.current_load ASC LIMIT $${queryParams.length + 1}`;
    queryParams.push(amount);

    const { rows } = await pool.query(queryText, queryParams);
    
    // Fallback: If no restricted servers found for free user, give them any non-premium server
    if (rows.length === 0 && !isPremium) {
      const fallbackRes = await pool.query(
        `SELECT * FROM vpn_servers 
         WHERE status = $1 
         AND "is_premium" = FALSE 
         AND protocol = 'WireGuard'
         AND COALESCE(current_load, 0) < COALESCE(max_connections, 1000)
         LIMIT $2`,
        ['active', amount]
      );
      return fallbackRes.rows;
    }

    return rows;
  }

  /**
   * Ported from PLpgSQL: get_optimal_network_node
   * Intelligent selection scoring logic
   */
  static async getOptimalServer(userId: string, limit: number = 1) {
    const { rows } = await pool.query(`
      SELECT 
        s.server_id, s.hostname, s.ip_address, s.location, s.country_code,
        s.current_load, s.max_connections, s.avg_latency_ms, s."is_premium",
        (
          (COALESCE(s.current_load, 0)::FLOAT / GREATEST(COALESCE(s.max_connections, 1000), 1)::FLOAT * 40.0) +  -- 40% Load weight
          (COALESCE(s.cpu_usage, 0)::FLOAT / 100.0 * 20.0) +     -- 20% CPU weight
          (LEAST(COALESCE(s.avg_latency_ms, 0), 500)::FLOAT / 500.0 * 40.0) -- 40% Latency weight
        ) as score
      FROM vpn_servers s
      WHERE s.status = 'active'
      AND s.protocol = 'WireGuard'
      AND COALESCE(s.current_load, 0) < COALESCE(s.max_connections, 1000)
      AND (s."is_premium" = FALSE OR EXISTS (
        SELECT 1 FROM users WHERE user_id = $1 AND plan_type = 'premium'
      ))
      ORDER BY score ASC
      LIMIT $2
    `, [userId, limit]);

    return limit === 1 ? (rows[0] || null) : rows;
  }

  static async recordHealth(serverId: string, cpu: number, latency: number, connections: number) {
    await pool.query(
      `UPDATE vpn_servers SET cpu_usage = $1, avg_latency_ms = $2, current_load = $3, last_health_check = NOW() WHERE server_id = $4`,
      [cpu, latency, connections, serverId]
    );
    await pool.query(
      `INSERT INTO server_metrics (server_id, cpu_usage, avg_latency_ms, active_connections) VALUES ($1, $2, $3, $4)`,
      [serverId, cpu, latency, connections]
    );
  }

  private static async expireStaleUserSessions(client: DbClient, userId: string) {
    const staleMinutes = Number(process.env.STALE_SESSION_MINUTES || 30);
    if (!Number.isFinite(staleMinutes) || staleMinutes <= 0) return;
    const staleMinutesWindow = Math.max(1, Math.floor(staleMinutes));

    const { rows } = await client.query(
      `SELECT s.session_id, s.server_id, s.client_public_key,
              v.hostname, v.ip_address::text, v.location, v.country_code, v.protocol,
              v.ssh_host, v.ssh_port, v.ssh_user, v.wg_interface, v.wg_public_key,
              v.wg_port, v.wg_subnet::text, v.endpoint_host, v.endpoint_port, v.dns_servers
       FROM vpn_sessions s
       JOIN vpn_servers v ON s.server_id = v.server_id
       WHERE s.user_id = $1
         AND s.status = 'active'
         AND COALESCE(s.last_active_at, s.provisioned_at, s.created_at, s.start_time) <
             NOW() - ($2::int * INTERVAL '1 minute')
       FOR UPDATE`,
      [userId, staleMinutesWindow]
    );

    if (rows.length === 0) return;

    for (const row of rows) {
      if (row.client_public_key) {
        await this.removePeerFromServer(row as WireGuardServer, row.client_public_key).catch((error) => {
          console.warn('[WireGuard] Failed to remove stale peer:', error);
        });
      }
    }

    const sessionIds = rows.map((row: any) => row.session_id);
    await client.query(
      `UPDATE vpn_sessions
       SET status = 'expired', end_time = NOW()
       WHERE session_id = ANY($1::uuid[]) AND status = 'active'`,
      [sessionIds]
    );

    const expiredByServer = rows.reduce((counts: Record<string, number>, row: any) => {
      counts[row.server_id] = (counts[row.server_id] || 0) + 1;
      return counts;
    }, {});

    for (const [serverId, expiredCount] of Object.entries(expiredByServer)) {
      await client.query(
        'UPDATE vpn_servers SET current_load = GREATEST(0, COALESCE(current_load, 0) - $1) WHERE server_id = $2',
        [expiredCount, serverId]
      );
    }
  }

  static async startSession(userId: string, serverId: string, clientIp: string) {
    const client = await pool.connect();
    let provisionedPeer: { server: WireGuardServer; publicKey: string } | null = null;

    try {
      await client.query('BEGIN');

      const userRes = await client.query(
        `SELECT plan_type, subscription_end_date, trial_ends_at, preferred_protocol,
                split_tunneling_config, daily_data_used_bytes, daily_data_limit_bytes,
                max_devices
         FROM users
         WHERE user_id = $1
         FOR UPDATE`,
        [userId]
      );

      if (userRes.rows.length === 0) throw new Error('User not found');
      const user = userRes.rows[0];
      const now = new Date();
      const isPremium =
        user.plan_type === 'premium' &&
        (!user.subscription_end_date || new Date(user.subscription_end_date) > now);
      const isTrialActive = user.trial_ends_at && new Date(user.trial_ends_at) > now;

      if (!isPremium && !isTrialActive) {
        const used = Number(user.daily_data_used_bytes || 0);
        const limit = Number(user.daily_data_limit_bytes || 524288000);
        if (used >= limit) {
          throw new Error('Daily data limit reached. Upgrade to premium for unlimited access.');
        }
      }

      await this.expireStaleUserSessions(client, userId);

      const activeSessionsRes = await client.query(
        `SELECT COUNT(*)::int AS active_sessions
         FROM vpn_sessions
         WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );
      const activeSessions = Number(activeSessionsRes.rows[0]?.active_sessions || 0);
      const maxDevices = Number(user.max_devices || (isPremium ? 5 : 1));
      if (activeSessions >= maxDevices) {
        throw new Error(`Device limit reached (${maxDevices}). Disconnect another device first.`);
      }

      const serverRes = await client.query(
        `SELECT server_id, hostname, ip_address::text, "is_premium", protocol, location,
                country_code, max_connections, ssh_host, ssh_port, ssh_user,
                wg_interface, wg_public_key, wg_port, wg_subnet::text,
                endpoint_host, endpoint_port, dns_servers
         FROM vpn_servers
         WHERE server_id = $1 AND status = $2
         FOR UPDATE`,
        [serverId, 'active']
      );

      if (serverRes.rows.length === 0) throw new Error('Server not found or inactive');
      const server = serverRes.rows[0] as WireGuardServer;

      if (server.is_premium && !isPremium) {
        throw new Error('Premium subscription required to access this server');
      }

      if (server.protocol !== 'WireGuard') {
        throw new Error('This backend can only provision WireGuard servers right now.');
      }

      const assignedVpnIp = await this.getNextAvailableIP(client, server);
      const keyPair = await this.generateClientKeyPair(server);
      const serverPublicKey = await this.ensureServerPublicKey(server, client);

      const { rows } = await client.query(
        `INSERT INTO vpn_sessions (
           user_id, server_id, client_ip, assigned_vpn_ip, status,
           client_public_key, protocol_used, provisioned_at, last_active_at
         )
         VALUES ($1, $2, $3, $4, 'active', $5, 'WireGuard', NOW(), NOW())
         RETURNING session_id, assigned_vpn_ip, client_public_key`,
        [userId, serverId, clientIp, assignedVpnIp, keyPair.publicKey]
      );

      provisionedPeer = { server, publicKey: keyPair.publicKey };
      await this.addPeerToServer(server, keyPair.publicKey, assignedVpnIp);

      await client.query(
        `UPDATE vpn_servers
         SET current_load = LEAST(COALESCE(max_connections, 1000), COALESCE(current_load, 0) + 1)
         WHERE server_id = $1`,
        [serverId]
      );

      await client.query('COMMIT');
      provisionedPeer = null;

      const session = rows[0];
      const config = this.buildWireGuardConfig(server, keyPair.privateKey, assignedVpnIp, serverPublicKey);

      return {
        ...session,
        protocol: 'WireGuard',
        configFormat: 'wireguard',
        splitTunneling: user.split_tunneling_config || {},
        server: {
          hostname: server.hostname,
          endpoint: this.getEndpoint(server),
          location: server.location,
          country_code: server.country_code
        },
        config
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      if (provisionedPeer) {
        await this.removePeerFromServer(provisionedPeer.server, provisionedPeer.publicKey).catch((cleanupError) => {
          console.error('[WireGuard] Failed to cleanup provisioned peer:', cleanupError);
        });
      }
      throw error;
    } finally {
      client.release();
    }
  }

  static async endSession(sessionId: string, userId: string) {
    console.trace(`[VpnService] endSession called for session ${sessionId} by user ${userId}`);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `SELECT s.server_id, s.client_public_key,
                v.hostname, v.ip_address::text, v.location, v.country_code, v.protocol,
                v.ssh_host, v.ssh_port, v.ssh_user, v.wg_interface, v.wg_public_key,
                v.wg_port, v.wg_subnet::text, v.endpoint_host, v.endpoint_port, v.dns_servers
         FROM vpn_sessions s
         JOIN vpn_servers v ON s.server_id = v.server_id
         WHERE s.session_id = $1
           AND s.user_id = $2
           AND s.status = 'active'
         FOR UPDATE`,
        [sessionId, userId]
      );

      if (rows.length === 0) {
        await client.query('COMMIT');
        return { success: true, alreadyDisconnected: true };
      }

      const row = rows[0];
      const server = row as WireGuardServer;
      const clientPublicKey = row.client_public_key as string | null;

      if (clientPublicKey) {
        await this.removePeerFromServer(server, clientPublicKey);
      }

      await client.query(
        `UPDATE vpn_sessions
         SET status = 'disconnected', end_time = NOW()
         WHERE session_id = $1 AND user_id = $2`,
        [sessionId, userId]
      );

      await client.query(
        'UPDATE vpn_servers SET current_load = GREATEST(0, COALESCE(current_load, 0) - 1) WHERE server_id = $1',
        [row.server_id]
      );

      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private static async getNextAvailableIP(client: DbClient, server: WireGuardServer): Promise<string> {
    const subnet = this.parseIpv4Cidr(server.wg_subnet || '10.8.0.0/24');
    if (subnet.prefix !== 24) {
      throw new Error(`Unsupported WireGuard subnet ${server.wg_subnet}. Use a /24 subnet for now.`);
    }

    const usedRes = await client.query(
      `SELECT host(assigned_vpn_ip) AS assigned_vpn_ip
       FROM vpn_sessions
       WHERE server_id = $1 AND status = 'active'`,
      [server.server_id]
    );

    const used = new Set<string>(
      usedRes.rows
        .map((row: any) => row.assigned_vpn_ip)
        .filter(Boolean)
    );

    const remoteUsed = await this.getRemoteAllowedIPs(server).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[WireGuard] Could not read remote allowed IPs, using DB allocation only:', message);
      return [];
    });
    remoteUsed.forEach((ip) => used.add(ip));

    const octets = subnet.base.split('.');
    for (let host = 2; host <= 254; host += 1) {
      const candidate = `${octets[0]}.${octets[1]}.${octets[2]}.${host}`;
      if (!used.has(candidate)) return candidate;
    }

    throw new Error('No VPN IPs available on this server');
  }

  private static generateRealKeyPair(): WireGuardKeyPair {
    // Use Node.js built-in crypto to generate a real Curve25519 (X25519) key pair.
    // JWK format exposes raw key bytes as base64url — we convert to standard base64.
    const { privateKey: privObj, publicKey: pubObj } = require('crypto').generateKeyPairSync('x25519', {
      privateKeyEncoding: { format: 'jwk' },
      publicKeyEncoding:  { format: 'jwk' }
    });
    const toBase64 = (b64url: string) =>
      Buffer.from(b64url.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('base64');
    return {
      privateKey: toBase64(privObj.d),
      publicKey:  toBase64(pubObj.x)
    };
  }

  private static async generateClientKeyPair(server: WireGuardServer): Promise<WireGuardKeyPair> {
    // In mock/dev mode, generate real Curve25519 keys locally (no SSH needed).
    if (process.env.MOCK_SSH === 'true') {
      console.warn('[VpnService] Mock SSH: generating real Curve25519 key pair locally');
      return this.generateRealKeyPair();
    }

    const output = await this.execSsh(
      server,
      'set -e; private_key=$(wg genkey); public_key=$(printf "%s" "$private_key" | wg pubkey); printf "%s\\n%s\\n" "$private_key" "$public_key"'
    );
    const [privateKey, publicKey] = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    this.assertWireGuardKey(privateKey, 'client private key');
    this.assertWireGuardKey(publicKey, 'client public key');

    return { privateKey, publicKey };
  }

  private static async ensureServerPublicKey(server: WireGuardServer, client: DbClient): Promise<string> {
    // In mock/dev mode, generate a real Curve25519 server public key locally.
    // Always regenerate so we never use a previously-cached fake/invalid key.
    if (process.env.MOCK_SSH === 'true') {
      console.warn('[VpnService] Mock SSH: generating real server public key locally');
      const { publicKey: mockServerKey } = this.generateRealKeyPair();
      await client.query(
        'UPDATE vpn_servers SET wg_public_key = $1 WHERE server_id = $2',
        [mockServerKey, server.server_id]
      );
      server.wg_public_key = mockServerKey;
      return mockServerKey;
    }

    if (server.wg_public_key) {
      this.assertWireGuardKey(server.wg_public_key, 'server public key');
      return server.wg_public_key;
    }

    const iface = this.getInterface(server);
    const publicKey = (await this.execSsh(server, `wg show ${iface} public-key`)).trim();
    this.assertWireGuardKey(publicKey, 'server public key');

    await client.query(
      'UPDATE vpn_servers SET wg_public_key = $1 WHERE server_id = $2',
      [publicKey, server.server_id]
    );

    server.wg_public_key = publicKey;
    return publicKey;
  }

  private static async addPeerToServer(server: WireGuardServer, clientPublicKey: string, clientIp: string) {
    if (process.env.MOCK_SSH === 'true') {
      console.warn('[VpnService] Mock SSH: skipping addPeer SSH call');
      return;
    }

    this.assertWireGuardKey(clientPublicKey, 'client public key');
    this.assertIpv4(clientIp, 'client VPN IP');

    const iface = this.getInterface(server);
    // Use 'wg set' only (live config) — do NOT use 'wg-quick save' as it overwrites
    // PostUp/PostDown hooks in wg0.conf and duplicates iptables MASQUERADE rules,
    // which breaks NAT routing for all clients.
    const result = await this.execSsh(
      server,
      `set -e; wg set ${iface} peer ${clientPublicKey} allowed-ips ${clientIp}/32`
    );
    console.log(`[VpnService] addPeer result for ${clientIp}: "${result}"`);
  }

  private static async removePeerFromServer(server: WireGuardServer, clientPublicKey: string) {
    if (process.env.MOCK_SSH === 'true') {
      console.warn('[VpnService] Mock SSH: skipping removePeer SSH call');
      return;
    }

    this.assertWireGuardKey(clientPublicKey, 'client public key');

    const iface = this.getInterface(server);
    // Use 'wg set' only (live config) — do NOT use 'wg-quick save' as it overwrites
    // PostUp/PostDown hooks in wg0.conf and duplicates iptables MASQUERADE rules.
    await this.execSsh(
      server,
      `wg set ${iface} peer ${clientPublicKey} remove || true`
    );
  }

  private static async getRemoteAllowedIPs(server: WireGuardServer): Promise<string[]> {
    const iface = this.getInterface(server);
    const output = await this.execSsh(server, `wg show ${iface} allowed-ips`);

    if (!output) {
      // No peers or SSH failed; return empty array
      return [];
    }

    return output
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/)[1])
      .filter(Boolean)
      .map((cidr) => cidr.split('/')[0])
      .filter((ip) => this.isIpv4(ip));
  }

  private static buildWireGuardConfig(
    server: WireGuardServer,
    clientPrivateKey: string,
    assignedIp: string,
    serverPublicKey: string
  ): string {
    if (process.env.MOCK_SSH !== 'true') {
      this.assertWireGuardKey(clientPrivateKey, 'client private key');
      this.assertWireGuardKey(serverPublicKey, 'server public key');
    }
    this.assertIpv4(assignedIp, 'client VPN IP');

    const dnsServers = server.dns_servers || process.env.WG_DNS || '8.8.8.8, 1.1.1.1';
    const allowedIps = process.env.WG_ALLOWED_IPS || '0.0.0.0/0';
    const endpoint = this.getEndpoint(server);

    return `
[Interface]
PrivateKey = ${clientPrivateKey}
Address = ${assignedIp}/32
DNS = ${dnsServers}
MTU = 1120

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${endpoint}
AllowedIPs = ${allowedIps}
PersistentKeepalive = 25
    `.trim();
  }

  private static getEndpoint(server: WireGuardServer): string {
    const rawHost = server.endpoint_host || server.ssh_host || server.ip_address || server.hostname;
    const host = rawHost?.split('/')[0]; // Remove possible CIDR suffix like "/32"
    const port = Number(server.endpoint_port || server.wg_port || 51820);
    return `${host}:${port}`;
  }

  private static async execSsh(server: WireGuardServer, command: string): Promise<string> {
    const rawHost = server.ssh_host || server.ip_address || server.hostname;
    const host = rawHost?.split('/')[0]; // Remove possible CIDR suffix like "/32"
    const user = server.ssh_user || process.env.SSH_USER || 'root';
    const port = String(server.ssh_port || process.env.SSH_PORT || 22);
    const keyPath = process.env.SSH_PRIVATE_KEY_PATH || '/root/.ssh/id_rsa';

    this.assertSshTarget(host, user, port);

    // If we are running in a dev/mock environment, skip real SSH and return dummy data
    if (process.env.MOCK_SSH === 'true') {
      console.warn('[VpnService] Mock SSH enabled – returning dummy response for command:', command);
      // For the key generation command, return two lines: privateKey and publicKey
      if (command.includes('wg genkey')) {
        return 'dummy_private_key_a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1=\ndummy_public_key_a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1=';
      }
      return '';
    }

    const args = [
      '-i',
      keyPath,
      '-p',
      port,
      '-o',
      'BatchMode=yes',
      '-o',
      'StrictHostKeyChecking=accept-new',
      '-o',
      'ConnectTimeout=10',
      `${user}@${host}`,
      command
    ];

    try {
      const { stdout } = await execFileAsync('ssh', args, {
        timeout: 20000,
        maxBuffer: 1024 * 1024
      });
      return stdout.toString().trim();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[VpnService] SSH command failed on ${host}: ${errMsg}`);
      // If this was a key generation command, fall back to local generation
      if (command.includes('wg genkey')) {
        console.warn('[VpnService] SSH key generation failed – falling back to local generation');
        const { privateKey, publicKey } = this.generateRealKeyPair();
        return `${privateKey}\n${publicKey}`;
      }
      // For critical peer management commands, throw so the session creation fails loudly
      if (command.includes('wg set') || command.includes('wg show')) {
        throw new Error(`SSH command failed on ${host}: ${errMsg}`);
      }
      return '';
    }
  }

  private static getInterface(server: WireGuardServer): string {
    const iface = server.wg_interface || process.env.WG_INTERFACE || 'wg0';
    if (!/^[A-Za-z0-9_.-]+$/.test(iface)) {
      throw new Error(`Invalid WireGuard interface: ${iface}`);
    }
    return iface;
  }

  private static parseIpv4Cidr(cidr: string): { base: string; prefix: number } {
    const [base, prefixText] = cidr.split('/');
    const prefix = Number(prefixText);
    this.assertIpv4(base, 'WireGuard subnet');

    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
      throw new Error(`Invalid CIDR prefix: ${cidr}`);
    }

    return { base, prefix };
  }

  private static assertWireGuardKey(key: string | undefined, label: string) {
    if (!key || !/^[A-Za-z0-9+/]{42,43}=$/.test(key)) {
      throw new Error(`Invalid ${label}`);
    }
  }

  private static assertIpv4(ip: string | undefined, label: string) {
    if (!ip || !this.isIpv4(ip)) {
      throw new Error(`Invalid ${label}`);
    }
  }

  private static isIpv4(ip: string): boolean {
    const parts = ip.split('.');
    return (
      parts.length === 4 &&
      parts.every((part) => {
        if (!/^\d+$/.test(part)) return false;
        const value = Number(part);
        return value >= 0 && value <= 255;
      })
    );
  }

  private static assertSshTarget(host: string, user: string, port: string) {
    if (!/^[A-Za-z0-9_.:-]+$/.test(host)) {
      throw new Error(`Invalid SSH host: ${host}`);
    }
    if (!/^[A-Za-z0-9_-]+$/.test(user)) {
      throw new Error(`Invalid SSH user: ${user}`);
    }
    const numericPort = Number(port);
    if (!Number.isInteger(numericPort) || numericPort < 1 || numericPort > 65535) {
      throw new Error(`Invalid SSH port: ${port}`);
    }
  }
}
