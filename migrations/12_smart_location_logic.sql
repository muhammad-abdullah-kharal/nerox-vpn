-- 12. Smart Location System Logic
-- Enhances optimal server selection with weighted scoring (Latency + Load)
-- and returns multiple results to support client-side fallback.

-- First, drop the old single-server function variants
DROP FUNCTION IF EXISTS get_optimal_server();
DROP FUNCTION IF EXISTS get_optimal_server(BOOLEAN);

-- Create the new Smart Selection RPC
CREATE OR REPLACE FUNCTION get_optimal_server(p_limit INTEGER DEFAULT 5)
RETURNS TABLE (
    server_id UUID,
    hostname VARCHAR,
    city VARCHAR,
    country VARCHAR,
    country_code CHAR(2),
    current_load INTEGER,
    latency_ms INTEGER,
    is_premium BOOLEAN,
    smart_score NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
    v_is_premium_user BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    -- 1. Check if user is premium
    IF v_user_id IS NULL THEN
        v_is_premium_user := FALSE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.subscriptions 
            WHERE user_id = v_user_id AND status = 'active' AND end_date >= CURRENT_DATE
        ) INTO v_is_premium_user;
    END IF;

    -- 2. Return Ranked List
    RETURN QUERY
    SELECT 
        s.server_id, s.hostname, s.city, s.country, s.country_code, 
        s.current_load, s.latency_ms, s.is_premium,
        -- Smart Score Formula: (70% Latency + 30% Load)
        -- Lower score is better.
        ((s.latency_ms * 0.7) + (s.current_load * 0.3))::NUMERIC as smart_score
    FROM public.vpn_servers s
    WHERE s.status = 'active'
    AND s.current_load < 100 -- Exclude overloaded
    -- Freshness check (from migration 11)
    AND (s.last_health_check > NOW() - INTERVAL '5 minutes' OR s.last_health_check IS NULL)
    -- Tier restriction
    AND (v_is_premium_user OR s.is_premium = FALSE)
    ORDER BY smart_score ASC
    LIMIT p_limit;
END;
$$;
