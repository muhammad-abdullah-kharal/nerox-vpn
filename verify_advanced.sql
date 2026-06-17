-- Advanced Backend Feature Verification
-- Run these in your Supabase SQL Editor to test the logic

-- 1. Test Load Balancing
SELECT * FROM get_optimal_server();

-- 2. Test Lockout Logic (Manual Simulation)
-- Suppose user 'test@example.com' exists
-- SELECT handle_failed_login('test@example.com'); -- Run this 5 times

-- 3. Verify User Lock State
SELECT email, failed_attempts, locked_until 
FROM users 
WHERE email = 'test@example.com';

-- 4. Verify Partitioning
-- You can see partitions under the "Database" -> "Tables" section in Supabase dashboard
-- Look for vpn_traffic_stats_2026_04

-- 5. Test Data Cleanup (Retention)
-- SELECT cleanup_old_data();
