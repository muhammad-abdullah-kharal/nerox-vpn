-- 1. Enable RLS (Ensure it's active on parent and all partitions)
ALTER TABLE public.vpn_traffic_stats ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Users can insert own traffic stats" ON public.vpn_traffic_stats;

-- 3. Create the INSERT policy
-- This allows a user to insert into vpn_traffic_stats ONLY IF the session_id belongs to them.
CREATE POLICY "Users can insert own traffic stats" ON public.vpn_traffic_stats
FOR INSERT 
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.vpn_sessions 
        WHERE session_id = vpn_traffic_stats.session_id 
        AND user_id = auth.uid()
    )
);

-- 4. Ensure child partitions inherit or have RLS enabled
-- This is critical for partitioned tables in some Postgres versions
ALTER TABLE IF EXISTS public.vpn_traffic_stats_2026_05 ENABLE ROW LEVEL SECURITY;

-- 5. Grant necessary permissions to the authenticated role
GRANT INSERT, SELECT ON public.vpn_traffic_stats TO authenticated;
GRANT INSERT, SELECT ON public.vpn_traffic_stats_2026_05 TO authenticated;

-- 6. Verify policies
-- SELECT * FROM pg_policies WHERE tablename = 'vpn_traffic_stats';
