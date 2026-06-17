-- 15. Protocol Management - Part 2: Logic
-- Run this AFTER the enums migration (Part 1) has been successfully run.

-- 1. Add preferred_protocol to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS preferred_protocol vpn_protocol DEFAULT 'Auto';

-- 2. Update handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (user_id, username, email, role, preferred_protocol)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'username', new.email),
        new.email,
        'user',
        'Auto'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update Smart Selection RPC
CREATE OR REPLACE FUNCTION get_smart_servers(p_amount INTEGER DEFAULT 5, p_protocol vpn_protocol DEFAULT 'Auto')
RETURNS TABLE (
    server_id UUID,
    hostname VARCHAR,
    city VARCHAR,
    country VARCHAR,
    country_code CHAR(2),
    current_load INTEGER,
    latency_ms INTEGER,
    is_premium BOOLEAN,
    smart_score NUMERIC,
    protocol vpn_protocol
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
        ((s.latency_ms * 0.7) + (s.current_load * 0.3))::NUMERIC as smart_score,
        s.protocol
    FROM public.vpn_servers s
    WHERE s.status = 'active'
    AND s.current_load < 100 -- Exclude overloaded
    AND (s.last_health_check > NOW() - INTERVAL '5 minutes' OR s.last_health_check IS NULL)
    AND (v_is_premium_user OR s.is_premium = FALSE)
    -- Protocol Filtering logic
    AND (p_protocol = 'Auto' OR s.protocol = p_protocol)
    ORDER BY smart_score ASC
    LIMIT p_amount;
END;
$$;
