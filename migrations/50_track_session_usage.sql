-- Migration: 50_track_session_usage.sql
-- Purpose: Record data usage when a VPN session ends

CREATE OR REPLACE FUNCTION stop_vpn_session(p_session_id UUID, p_bytes_sent BIGINT, p_bytes_received BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_total_bytes BIGINT;
BEGIN
    v_user_id := auth.uid();
    v_total_bytes := p_bytes_sent + p_bytes_received;

    -- 1. Update the session record
    UPDATE public.vpn_sessions 
    SET end_time = NOW(),
        status = 'completed',
        bytes_sent = p_bytes_sent,
        bytes_received = p_bytes_received
    WHERE session_id = p_session_id AND user_id = v_user_id;

    -- 2. Add the usage to the user's daily total
    UPDATE public.users
    SET daily_data_used_bytes = daily_data_used_bytes + v_total_bytes
    WHERE user_id = v_user_id;

    RETURN jsonb_build_object('success', true, 'data_recorded', v_total_bytes);
END;
$$;
