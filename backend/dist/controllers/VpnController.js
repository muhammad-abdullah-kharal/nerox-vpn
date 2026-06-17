"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VpnController = void 0;
const VpnService_1 = require("../services/VpnService");
const db_1 = __importDefault(require("../config/db"));
class VpnController {
    static async getServers(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId)
                return res.status(401).json({ error: 'Unauthorized' });
            const servers = await VpnService_1.VpnService.getServers(userId);
            res.json(servers);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async startSession(req, res) {
        try {
            const { serverId } = req.body;
            const userId = req.user?.userId;
            const clientIp = req.ip || '0.0.0.0';
            if (!serverId || !userId)
                return res.status(400).json({ error: 'Server ID is required' });
            const session = await VpnService_1.VpnService.startSession(userId, serverId, clientIp);
            res.json(session);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async endSession(req, res) {
        try {
            const { sessionId } = req.params;
            const userId = req.user?.userId;
            if (!sessionId)
                return res.status(400).json({ error: 'Session ID is required' });
            if (!userId)
                return res.status(401).json({ error: 'Unauthorized' });
            const result = await VpnService_1.VpnService.endSession(sessionId, userId);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async getLastSessionReport(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId)
                return res.status(401).json({ error: 'Unauthorized' });
            const { rows } = await db_1.default.query(`SELECT s.*, v.location, v.country_code, v.hostname, v.ip_address as server_ip,
         COALESCE(SUM(t.bytes_sent), 0) as bytes_sent,
         COALESCE(SUM(t.bytes_received), 0) as bytes_received,
         COALESCE(EXTRACT(EPOCH FROM (COALESCE(s.end_time, NOW()) - s.created_at))::INTEGER, 0) as duration_seconds
         FROM vpn_sessions s
         JOIN vpn_servers v ON s.server_id = v.server_id
         LEFT JOIN vpn_traffic_stats t ON s.session_id = t.session_id
         WHERE s.user_id = $1
         GROUP BY s.session_id, v.server_id, v.ip_address
         ORDER BY s.created_at DESC
         LIMIT 1`, [userId]);
            res.json(rows[0] || null);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async reportTraffic(req, res) {
        try {
            const { sessionId, bytesSent, bytesReceived } = req.body;
            const userId = req.user?.userId;
            if (!sessionId || !userId)
                return res.status(400).json({ error: 'Session ID is required' });
            const sent = Number(bytesSent || 0);
            const received = Number(bytesReceived || 0);
            if (!Number.isFinite(sent) || !Number.isFinite(received) || sent < 0 || received < 0) {
                return res.status(400).json({ error: 'Traffic values must be non-negative numbers' });
            }
            console.log(`[TrafficReport] session=${sessionId} sent=${sent} received=${received}`);
            const client = await db_1.default.connect();
            try {
                await client.query('BEGIN');
                const sessionRes = await client.query(`SELECT session_id
           FROM vpn_sessions
           WHERE session_id = $1 AND user_id = $2 AND status = 'active'
           FOR UPDATE`, [sessionId, userId]);
                if (sessionRes.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'Active session not found' });
                }
                // Insert into traffic stats
                await client.query('INSERT INTO vpn_traffic_stats (session_id, bytes_sent, bytes_received) VALUES ($1, $2, $3)', [sessionId, sent, received]);
                await client.query(`UPDATE vpn_sessions
           SET total_bytes_sent = COALESCE(total_bytes_sent, 0) + $1,
               total_bytes_received = COALESCE(total_bytes_received, 0) + $2,
               last_active_at = NOW()
           WHERE session_id = $3`, [sent, received, sessionId]);
                // Update user's daily usage
                await client.query('UPDATE users SET daily_data_used_bytes = daily_data_used_bytes + $1 WHERE user_id = $2', [sent + received, userId]);
                await client.query('COMMIT');
                res.json({ success: true });
            }
            catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
            finally {
                client.release();
            }
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async getOptimalServers(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId)
                return res.status(401).json({ error: 'Unauthorized' });
            const servers = await VpnService_1.VpnService.getOptimalServer(userId, 5);
            res.json(servers);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async runSpeedTest(req, res) {
        try {
            const { serverId } = req.body;
            if (!serverId)
                return res.status(400).json({ error: 'Server ID is required' });
            // In a real production app, we would perform an actual bandwidth test.
            // For this migration, we simulate a speed test result based on server health.
            const { rows } = await db_1.default.query('SELECT avg_latency_ms, current_load FROM vpn_servers WHERE server_id = $1', [serverId]);
            const server = rows[0];
            const latency = server ? server.avg_latency_ms : 100;
            const downloadSpeed = Math.max(5, 100 - (server?.current_load || 0)) + (Math.random() * 10);
            const uploadSpeed = downloadSpeed * 0.4 + (Math.random() * 5);
            res.json({
                serverId,
                latencyMs: latency + Math.floor(Math.random() * 20),
                downloadMbps: parseFloat(downloadSpeed.toFixed(2)),
                uploadMbps: parseFloat(uploadSpeed.toFixed(2)),
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
exports.VpnController = VpnController;
