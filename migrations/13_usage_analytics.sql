-- 13. Usage & Analytics
-- Adds session-level traffic counters and aggregation functions

-- 1. Add Total counters to vpn_sessions
ALTER TABLE public.vpn_sessions ADD COLUMN IF NOT EXISTS total_bytes_sent BIGINT DEFAULT 0;
ALTER TABLE public.vpn_sessions ADD COLUMN IF NOT EXISTS total_bytes_received BIGINT DEFAULT 0;

-- 2. Update end_vpn_session to calculate final totals
CREATE OR REPLACE FUNCTION end_vpn_session(p_session_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_total_sent BIGINT;
    v_total_recv BIGINT;
BEGIN
    -- A. Calculate totals from granular traffic stats
    SELECT COALESCE(SUM(bytes_sent), 0), COALESCE(SUM(bytes_received), 0)
    INTO v_total_sent, v_total_recv
    FROM public.vpn_traffic_stats
    WHERE session_id = p_session_id;

    -- B. Update session with totals, end time, and status
    UPDATE public.vpn_sessions
    SET 
        end_time = NOW(),
        status = 'disconnected',
        total_bytes_sent = v_total_sent,
        total_bytes_received = v_total_recv
    WHERE session_id = p_session_id AND status = 'active';

    -- C. Update server load (decrement)
    UPDATE public.vpn_servers
    SET current_load = GREATEST(0, current_load - 1)
    WHERE server_id = (SELECT server_id FROM public.vpn_sessions WHERE session_id = p_session_id);

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. RPC: Get User Lifetime Usage Stats
DROP FUNCTION IF EXISTS get_user_usage_aggregates();

CREATE OR REPLACE FUNCTION get_user_usage_aggregates()
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_upload', COALESCE(SUM(total_bytes_sent), 0),
        'total_download', COALESCE(SUM(total_bytes_received), 0),
        'session_count', COUNT(session_id),
        'total_active_minutes', COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - start_time))/60), 0)
    ) INTO v_result
    FROM public.vpn_sessions
    WHERE user_id = auth.uid();

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. RPC: Get Last Session Report
DROP FUNCTION IF EXISTS get_last_session_report();

CREATE OR REPLACE FUNCTION get_last_session_report()
RETURNS TABLE (
    session_id UUID,
    start_time TIMESTAMP, -- Changed from WITH TIME ZONE to match table
    end_time TIMESTAMP,   -- Changed from WITH TIME ZONE to match table
    duration_seconds INTEGER,
    bytes_sent BIGINT,
    bytes_received BIGINT,
    hostname TEXT,
    location TEXT,
    assigned_vpn_ip TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.session_id,
        s.start_time,
        s.end_time,
        COALESCE(EXTRACT(EPOCH FROM (s.end_time - s.start_time))::INTEGER, 0) as duration_seconds,
        COALESCE(s.total_bytes_sent, 0) as bytes_sent,
        COALESCE(s.total_bytes_received, 0) as bytes_received,
        srv.hostname::TEXT,
        srv.location::TEXT,
        s.assigned_vpn_ip::TEXT
    FROM public.vpn_sessions s
    JOIN public.vpn_servers srv ON s.server_id = srv.server_id
    WHERE s.user_id = auth.uid()
    ORDER BY s.end_time DESC NULLS LAST
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
