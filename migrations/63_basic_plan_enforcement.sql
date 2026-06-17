-- 1. DROP EXISTING FUNCTIONS TO AVOID RETURN TYPE CONFLICTS
DROP FUNCTION IF EXISTS is_user_premium(uuid);
DROP FUNCTION IF EXISTS get_smart_servers(integer, vpn_protocol);
DROP FUNCTION IF EXISTS get_smart_servers(integer, text);
DROP FUNCTION IF EXISTS report_vpn_traffic(uuid, bigint, bigint);

-- 2. Enhanced Premium Check (Checks both profile and subscriptions)
CREATE OR REPLACE FUNCTION is_user_premium(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE user_id = p_user_id 
        AND plan_type = 'premium' 
        AND (subscription_end_date >= NOW() OR subscription_end_date IS NULL)
    ) OR EXISTS (
        SELECT 1 FROM public.subscriptions s
        JOIN public.subscription_plans p ON s.plan_id = p.plan_id
        WHERE s.user_id = p_user_id AND s.status = 'active' AND s.end_date >= CURRENT_DATE AND p.price_usd > 0
    );
END;
$$;

-- 3. Ensure Columns Exist & Heal Data
ALTER TABLE public.vpn_servers ADD COLUMN IF NOT EXISTS is_streaming_optimized BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS daily_data_limit_bytes BIGINT DEFAULT 524288000; 
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS daily_data_used_bytes BIGINT DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_data_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS authorized_regions TEXT[] DEFAULT ARRAY['Global'];
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) DEFAULT 'free';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS max_devices INTEGER DEFAULT 1;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE;

-- HEAL: Ensure all existing users have Global access if NULL
UPDATE public.users SET authorized_regions = ARRAY['Global'] WHERE authorized_regions IS NULL;
UPDATE public.users SET plan_type = 'free' WHERE plan_type IS NULL;

-- 4. Force Enable RLS and Open Permissions
ALTER TABLE public.vpn_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vpn_traffic_stats ENABLE ROW LEVEL SECURITY;

-- CLEAR ALL EXISTING POLICIES TO PREVENT CONFLICTS
DROP POLICY IF EXISTS "Allow public server visibility" ON public.vpn_servers;
DROP POLICY IF EXISTS "Allow users to see servers" ON public.vpn_servers;
DROP POLICY IF EXISTS "Servers are visible to all" ON public.vpn_servers;
DROP POLICY IF EXISTS "Public Server Visibility" ON public.vpn_servers;

-- CREATE FOOLPROOF PUBLIC POLICY
CREATE POLICY "Public Server Visibility" ON public.vpn_servers
    FOR SELECT TO public USING (true);

-- 5. Security Policies for Traffic Reporting
DROP POLICY IF EXISTS "Allow users to report their own traffic" ON public.vpn_traffic_stats;
CREATE POLICY "Allow users to report their own traffic" ON public.vpn_traffic_stats
    FOR INSERT WITH CHECK (true);

-- 6. Consolidated get_smart_servers with fallback and regional access
CREATE OR REPLACE FUNCTION get_smart_servers(p_amount INT, p_protocol TEXT DEFAULT 'Auto')
RETURNS TABLE (
    server_id UUID, hostname VARCHAR, ip_address INET, city VARCHAR, country VARCHAR, 
    country_code CHAR, current_load INTEGER, latency_ms INTEGER, supported_protocols vpn_protocol[], 
    is_premium BOOLEAN, is_streaming_optimized BOOLEAN, status vpn_status
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
    v_is_premium BOOLEAN;
    v_is_trial BOOLEAN;
    v_regions TEXT[];
BEGIN
    v_user_id := auth.uid();
    v_is_premium := is_user_premium(v_user_id);
    v_is_trial := is_user_in_trial(v_user_id);
    
    SELECT COALESCE(authorized_regions, ARRAY['Global']) INTO v_regions FROM public.users WHERE user_id = v_user_id;

    RETURN QUERY
    SELECT 
        s.server_id, s.hostname, s.ip_address, s.city, s.country, 
        s.country_code, COALESCE(s.current_load, 0) as current_load, s.latency_ms, s.supported_protocols, 
        s.is_premium, s.is_streaming_optimized, s.status
    FROM public.vpn_servers s
    WHERE LOWER(s.status::text) = 'active'
    AND COALESCE(s.current_load, 0) < 100 
    -- Access Logic:
    AND (
        (v_is_premium AND (v_regions @> ARRAY['Global'] OR s.country_code = ANY(v_regions)))
        OR 
        (
          s.is_premium = FALSE 
          AND s.is_streaming_optimized = FALSE
          AND (
            TRIM(s.country_code) IN ('US', 'GB', 'DE', 'SG', 'CA', 'FR')
            OR NOT EXISTS (
                SELECT 1 FROM public.vpn_servers fs 
                WHERE fs.status = 'active' AND fs.is_premium = FALSE 
                AND TRIM(fs.country_code) IN ('US', 'GB', 'DE', 'SG', 'CA', 'FR')
            )
          )
        )
    )
    ORDER BY s.is_premium DESC, COALESCE(s.current_load, 0) ASC
    LIMIT p_amount;
END;
$$;

-- 7. Consolidated report_vpn_traffic with usage tracking
CREATE OR REPLACE FUNCTION report_vpn_traffic(
    p_session_id UUID,
    p_bytes_sent BIGINT,
    p_bytes_received BIGINT
)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
    v_total_bytes BIGINT;
BEGIN
    -- Get user_id from session (fallback to auth.uid())
    SELECT user_id INTO v_user_id FROM public.vpn_sessions WHERE session_id = p_session_id;
    IF v_user_id IS NULL THEN v_user_id := auth.uid(); END IF;
    IF v_user_id IS NULL THEN RETURN; END IF;

    v_total_bytes := p_bytes_sent + p_bytes_received;

    -- Update User's Daily Cap (Atomic)
    UPDATE public.users 
    SET daily_data_used_bytes = COALESCE(daily_data_used_bytes, 0) + v_total_bytes
    WHERE user_id = v_user_id;

    -- Update Session Real-Time Stats
    UPDATE public.vpn_sessions 
    SET 
        total_bytes_sent = COALESCE(total_bytes_sent, 0) + p_bytes_sent,
        total_bytes_received = COALESCE(total_bytes_received, 0) + p_bytes_received,
        last_active_at = NOW()
    WHERE session_id = p_session_id;

    -- Log Granular Traffic Stats
    INSERT INTO public.vpn_traffic_stats (session_id, bytes_sent, bytes_received, packets_sent, packets_received)
    VALUES (p_session_id, p_bytes_sent, p_bytes_received, p_bytes_sent / 1500, p_bytes_received / 1500);

    -- Update Hourly History for Analytics
    INSERT INTO public.vpn_hourly_stats (session_id, total_bytes_sent, total_bytes_received, start_hour)
    VALUES (p_session_id, p_bytes_sent, p_bytes_received, date_trunc('hour', NOW()))
    ON CONFLICT (session_id, start_hour) 
    DO UPDATE SET 
        total_bytes_sent = vpn_hourly_stats.total_bytes_sent + EXCLUDED.total_bytes_sent,
        total_bytes_received = vpn_hourly_stats.total_bytes_received + EXCLUDED.total_bytes_received;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Ensure users can see their own profile data (for usage tracking)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
