-- Migration: 17_account_analytics.sql
-- Purpose: Implement RPCs for user usage statistics and connection reporting

-- 1. Function to get lifetime usage stats for a user
CREATE OR REPLACE FUNCTION get_user_usage_stats()
RETURNS TABLE(total_upload BIGINT, total_download BIGINT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    RETURN QUERY
    SELECT 
        COALESCE(SUM(ts.bytes_sent), 0)::BIGINT as total_upload,
        COALESCE(SUM(ts.bytes_received), 0)::BIGINT as total_download
    FROM public.vpn_traffic_stats ts
    JOIN public.vpn_sessions s ON ts.session_id = s.session_id
    WHERE s.user_id = v_user_id;
END;
$$;

-- 2. Function to get the last session report
DROP FUNCTION IF EXISTS get_last_session_report();
CREATE OR REPLACE FUNCTION get_last_session_report()
RETURNS TABLE(
    session_id UUID,
    location VARCHAR,
    assigned_vpn_ip INET,
    duration_seconds INTEGER,
    bytes_sent BIGINT,
    bytes_received BIGINT,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    RETURN QUERY
    SELECT 
        s.session_id,
        srv.location,
        s.assigned_vpn_ip,
        EXTRACT(EPOCH FROM (COALESCE(s.end_time, NOW()) - s.start_time))::INTEGER as duration_seconds,
        COALESCE(SUM(ts.bytes_sent), 0)::BIGINT as bytes_sent,
        COALESCE(SUM(ts.bytes_received), 0)::BIGINT as bytes_received,
        s.start_time::TIMESTAMPTZ,
        s.end_time::TIMESTAMPTZ
    FROM public.vpn_sessions s
    JOIN public.vpn_servers srv ON s.server_id = srv.server_id
    LEFT JOIN public.vpn_traffic_stats ts ON s.session_id = ts.session_id
    WHERE s.user_id = v_user_id
    GROUP BY s.session_id, srv.location, s.assigned_vpn_ip, s.start_time, s.end_time
    ORDER BY s.start_time DESC
    LIMIT 1;
END;
$$;
