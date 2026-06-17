-- 10. Automated Server Monitoring
-- This migration sets up a background simulation to fluctuate server stats

-- Enable the pg_cron extension (requires superuser or Supabase setup)
-- If this fails, you may need to enable it manually in the Supabase UI (Database -> Extensions)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Simulation Function
CREATE OR REPLACE FUNCTION simulate_server_monitoring()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- A. Update active servers with random health data
    UPDATE public.vpn_servers
    SET 
        current_load = CASE 
            -- Randomly fluctuate load by +/- 10%, keeping it between 5% and 95%
            WHEN (current_load + (floor(random() * 21) - 10)) < 5 THEN 5
            WHEN (current_load + (floor(random() * 21) - 10)) > 95 THEN 95
            ELSE (current_load + (floor(random() * 21) - 10))
        END,
        latency_ms = floor(random() * 161) + 20,
        last_health_check = NOW()
    WHERE status = 'active';

    -- B. Fail-safe: Mark servers as 'maintenance' if they reach 100% load
    UPDATE public.vpn_servers
    SET status = 'maintenance'
    WHERE current_load >= 100 AND status = 'active';

    -- C. Cleanup: Ensure any old 'active' servers that haven't heart-beated in an hour are marked inactive
    -- (This shouldn't happen with the monitor running, but good for data integrity)
    UPDATE public.vpn_servers
    SET status = 'maintenance'
    WHERE last_health_check < NOW() - INTERVAL '1 hour'
    AND status = 'active';
END;
$$;

-- 2. Schedule the Job (Every Minute)
-- In Supabase, use the 'cron' schema
SELECT cron.schedule(
    'server-monitoring-simulator', -- unique job name
    '* * * * *',                   -- every minute
    'SELECT simulate_server_monitoring();'
);
