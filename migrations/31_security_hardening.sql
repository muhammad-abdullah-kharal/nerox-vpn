-- Migration: 31_security_hardening.sql
-- Purpose: Implementation of No-Log policy details, rate limiting, and session abuse detection.

-- 1. Rate Limiting System
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE,
    action_key TEXT NOT NULL,
    attempt_count INTEGER DEFAULT 1,
    last_attempt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reset_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(user_id, action_key)
);

-- Trigger to check/update rate limits
CREATE OR REPLACE FUNCTION check_and_update_rate_limit(
    p_user_id UUID,
    p_action TEXT,
    p_limit INTEGER,
    p_window_minutes INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
    v_reset TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Cleanup expired limits
    DELETE FROM public.rate_limits WHERE reset_at < NOW();

    INSERT INTO public.rate_limits (user_id, action_key, reset_at)
    VALUES (p_user_id, p_action, NOW() + (p_window_minutes || ' minutes')::INTERVAL)
    ON CONFLICT (user_id, action_key) DO UPDATE
    SET 
        attempt_count = rate_limits.attempt_count + 1,
        last_attempt = NOW()
    RETURNING attempt_count, reset_at INTO v_count, v_reset;

    IF v_count > p_limit THEN
        RETURN FALSE; -- Limit exceeded
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Privacy: IP Anonymization Trigger
-- Scrubber for vpn_sessions
CREATE OR REPLACE FUNCTION scrub_session_ip()
RETURNS TRIGGER AS $$
BEGIN
    -- When a session is marked as disconnected or expired, anonymize the IP
    IF (NEW.status IN ('disconnected', 'expired')) AND (OLD.status = 'active') THEN
        NEW.client_ip := '0.0.0.0'::INET; -- Scrub PII
        -- Alternatively, use a hash if tracking is needed for debugging without PII
        -- NEW.client_ip := digest(NEW.client_ip::text, 'sha256')::text::inet; 
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_scrub_ip_on_disconnect ON public.vpn_sessions;
CREATE TRIGGER trg_scrub_ip_on_disconnect
    BEFORE UPDATE ON public.vpn_sessions
    FOR EACH ROW
    WHEN (NEW.status IS DISTINCT FROM OLD.status)
    EXECUTE FUNCTION scrub_session_ip();

-- 3. Detection: Concurrent Session Protection
CREATE OR REPLACE FUNCTION check_concurrent_sessions()
RETURNS TRIGGER AS $$
DECLARE
    v_max_sessions INTEGER := 3; -- Default limit
    v_active_count INTEGER;
BEGIN
    -- Only check on INSERT of a new active session
    IF (NEW.status = 'active') THEN
        -- Get user's plan limit if exists, else use default
        SELECT COALESCE(max_devices, 3) INTO v_max_sessions
        FROM public.subscriptions s
        JOIN public.subscription_plans p ON s.plan_id = p.plan_id
        WHERE s.user_id = NEW.user_id AND s.status = 'active'
        LIMIT 1;

        SELECT COUNT(*) INTO v_active_count
        FROM public.vpn_sessions
        WHERE user_id = NEW.user_id AND status = 'active';

        IF v_active_count >= v_max_sessions THEN
            RAISE EXCEPTION 'Maximum concurrent sessions reached for your plan (%)', v_max_sessions;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_limit_concurrent_sessions ON public.vpn_sessions;
CREATE TRIGGER trg_limit_concurrent_sessions
    BEFORE INSERT ON public.vpn_sessions
    FOR EACH ROW
    EXECUTE FUNCTION check_concurrent_sessions();

-- 4. Maintenance: Automated Log Purging
CREATE OR REPLACE FUNCTION purge_security_data()
RETURNS VOID AS $$
BEGIN
    -- 1. Delete audit logs older than 30 days
    DELETE FROM public.audit_logs WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- 2. Delete traffic stats older than 90 days (standard retention)
    DELETE FROM public.vpn_traffic_stats WHERE timestamp < NOW() - INTERVAL '90 days';
    
    -- 3. Delete old rate limit records
    DELETE FROM public.rate_limits WHERE reset_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
