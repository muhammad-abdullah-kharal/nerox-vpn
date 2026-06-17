"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCronJobs = initCronJobs;
const node_cron_1 = __importDefault(require("node-cron"));
const db_1 = __importDefault(require("../config/db"));
/**
 * Scheduled jobs for database maintenance and logic enforcement
 */
function initCronJobs() {
    // 1. Reset Daily Data Usage at midnight (UTC)
    node_cron_1.default.schedule('0 0 * * *', async () => {
        console.log('[Cron] Resetting daily data usage...');
        try {
            await db_1.default.query('UPDATE users SET daily_data_used_bytes = 0, last_data_reset_at = NOW()');
            console.log('[Cron] Daily data usage reset successful.');
        }
        catch (err) {
            console.error('[Cron] Error resetting daily data usage:', err);
        }
    });
    // 2. Clean up expired sessions every hour
    node_cron_1.default.schedule('0 * * * *', async () => {
        console.log('[Cron] Cleaning up expired sessions...');
        try {
            // Mark sessions as disconnected if they haven't reported traffic in 2 hours
            const { rowCount } = await db_1.default.query(`UPDATE vpn_sessions 
         SET status = 'disconnected', end_time = NOW() 
         WHERE status = 'active' AND last_active_at < NOW() - interval '2 hours'`);
            console.log(`[Cron] Cleaned up ${rowCount} stale sessions.`);
        }
        catch (err) {
            console.error('[Cron] Error cleaning up sessions:', err);
        }
    });
    // 3. Deactivate expired trials daily
    node_cron_1.default.schedule('0 1 * * *', async () => {
        console.log('[Cron] Deactivating expired trials...');
        try {
            const { rowCount } = await db_1.default.query(`UPDATE users 
         SET plan_type = 'free' 
         WHERE plan_type = 'trial' AND trial_ends_at < NOW()`);
            console.log(`[Cron] Deactivated ${rowCount} expired trials.`);
        }
        catch (err) {
            console.error('[Cron] Error deactivating trials:', err);
        }
    });
    // 4. Auto-create vpn_traffic_stats partition for next month (runs on 25th at 2am)
    node_cron_1.default.schedule('0 2 25 * *', async () => {
        console.log('[Cron] Creating next month traffic stats partition...');
        try {
            const now = new Date();
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const monthAfter = new Date(now.getFullYear(), now.getMonth() + 2, 1);
            const partName = `vpn_traffic_stats_${nextMonth.getFullYear()}_${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
            const fromDate = nextMonth.toISOString().slice(0, 10);
            const toDate = monthAfter.toISOString().slice(0, 10);
            await db_1.default.query(`CREATE TABLE IF NOT EXISTS ${partName} PARTITION OF vpn_traffic_stats FOR VALUES FROM ('${fromDate}') TO ('${toDate}')`);
            console.log(`[Cron] Partition ${partName} ensured.`);
        }
        catch (err) {
            // Ignore "already exists" errors
            if (err?.code !== '42P07') {
                console.error('[Cron] Error creating partition:', err);
            }
        }
    });
}
