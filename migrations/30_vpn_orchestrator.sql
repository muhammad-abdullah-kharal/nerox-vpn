-- Migration: 30_vpn_orchestrator.sql
-- Purpose: Advanced server monitoring, metrics tracking, and intelligent selection logic.

-- 1. Upgrade vpn_servers table
ALTER TABLE public.vpn_servers 
ADD COLUMN IF NOT EXISTS cpu_usage INTEGER DEFAULT 0 CHECK (cpu_usage >= 0 AND cpu_usage <= 100),
ADD COLUMN IF NOT EXISTS avg_latency_ms INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_status_change TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Create Server Metrics History Table
CREATE TABLE IF NOT EXISTS public.server_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID REFERENCES public.vpn_servers(server_id) ON DELETE CASCADE,
    cpu_usage INTEGER,
    avg_latency_ms INTEGER,
    active_connections INTEGER,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Security (RLS)
ALTER TABLE public.server_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Metrics are viewable by admins" ON public.server_metrics
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
    );

-- 4. Intelligent Selection RPC
-- Logic: Scores servers based on Load, CPU, and Latency.
-- Lower score is better.
CREATE OR REPLACE FUNCTION get_optimal_network_node()
RETURNS TABLE(
    server_id UUID, 
    hostname VARCHAR, 
    ip_address INET,
    location VARCHAR,
    score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.server_id, 
        s.hostname, 
        s.ip_address,
        s.location,
        (
            (s.current_load::FLOAT / s.max_connections::FLOAT * 40.0) +  -- 40% weight on connection load
            (s.cpu_usage::FLOAT * 0.3) +                                 -- 30% weight on CPU usage
            (LEAST(s.avg_latency_ms, 500)::FLOAT / 5.0 * 0.3)            -- 30% weight on latency (capped at 500ms)
        ) as calculated_score
    FROM public.vpn_servers s
    WHERE s.status = 'active'
    ORDER BY calculated_score ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Helper Function to record metrics
CREATE OR REPLACE FUNCTION record_server_health(
    p_server_id UUID,
    p_cpu INTEGER,
    p_latency INTEGER,
    p_connections INTEGER
) RETURNS VOID AS $$
BEGIN
    -- Update the main server record
    UPDATE public.vpn_servers
    SET 
        cpu_usage = p_cpu,
        avg_latency_ms = p_latency,
        current_load = p_connections,
        last_health_check = NOW()
    WHERE server_id = p_server_id;

    -- Record history
    INSERT INTO public.server_metrics (server_id, cpu_usage, avg_latency_ms, active_connections)
    VALUES (p_server_id, p_cpu, p_latency, p_connections);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
