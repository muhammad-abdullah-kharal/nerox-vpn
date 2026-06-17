-- 5. Row Level Security (RLS) policies
-- Security layer to ensure users can only access their own data

-- Enable RLS on all sensitive tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vpn_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vpn_traffic_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vpn_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Users Policy: Can only see/edit their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = user_id);

-- Sessions Policy: Can only see/manage their own sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON public.vpn_sessions;
CREATE POLICY "Users can view own sessions" ON public.vpn_sessions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sessions" ON public.vpn_sessions;
CREATE POLICY "Users can insert own sessions" ON public.vpn_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON public.vpn_sessions;
CREATE POLICY "Users can update own sessions" ON public.vpn_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Subscriptions Policy: Can only see their own subscriptions
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Traffic Stats Policy: Can only see stats for sessions they own
DROP POLICY IF EXISTS "Users can view own traffic stats" ON public.vpn_traffic_stats;
CREATE POLICY "Users can view own traffic stats" ON public.vpn_traffic_stats FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.vpn_sessions WHERE session_id = vpn_traffic_stats.session_id AND user_id = auth.uid())
);

-- Servers Policy: All authenticated users can view active servers
DROP POLICY IF EXISTS "Any authenticated user can view servers" ON public.vpn_servers;
CREATE POLICY "Any authenticated user can view servers" ON public.vpn_servers FOR SELECT USING (auth.role() = 'authenticated');

-- Subscription Plans: Publicly viewable for active plans
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.subscription_plans;
CREATE POLICY "Anyone can view active plans" ON public.subscription_plans FOR SELECT USING (is_active = TRUE);
