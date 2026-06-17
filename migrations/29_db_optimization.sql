-- Migration: 29_db_optimization.sql
-- Purpose: Performance indexing, data integrity checks, and RLS reinforcements.

-- 1. Performance Indexes
-- Users
CREATE INDEX IF NOT EXISTS idx_users_valid_to ON public.users(valid_to);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- VPN Sessions
CREATE INDEX IF NOT EXISTS idx_vpn_sessions_user_id ON public.vpn_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_vpn_sessions_server_id ON public.vpn_sessions(server_id);
CREATE INDEX IF NOT EXISTS idx_vpn_sessions_status ON public.vpn_sessions(status);
CREATE INDEX IF NOT EXISTS idx_vpn_sessions_start_time ON public.vpn_sessions(start_time DESC);

-- Subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON public.subscriptions(end_date);

-- Referrals
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee_id ON public.referrals(referee_id);
-- Note: referral_code is on public.users and is already indexed via UNIQUE constraint.

-- Feedback
CREATE INDEX IF NOT EXISTS idx_support_feedback_user_id ON public.support_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_support_feedback_status ON public.support_feedback(status);
CREATE INDEX IF NOT EXISTS idx_support_feedback_category ON public.support_feedback(category);

-- FAQSearch Optimization
-- Enable pg_trgm for fuzzy searching if not enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_faqs_question_trgm ON public.faqs USING GIN (question gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_faqs_category_id ON public.faqs(category_id);

-- 2. Data Integrity Constraints
ALTER TABLE public.subscriptions 
ADD CONSTRAINT check_subscription_dates CHECK (end_date >= start_date);

ALTER TABLE public.users
ADD CONSTRAINT check_valid_to_after_from CHECK (valid_to IS NULL OR valid_to >= valid_from);

-- 3. Security (RLS) Reinforcement
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- If audit log policy doesn't exist, allow users to only see logs they are associated with
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own audit logs') THEN
        CREATE POLICY "Users can view own audit logs" ON public.audit_logs
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

-- 4. Traffic Stats Partition Maintenance Function (Template)
-- This facilitates creating new partitions automatically (Simplified version)
CREATE OR REPLACE FUNCTION create_traffic_partition(p_start_date DATE)
RETURNS VOID AS $$
DECLARE
    v_table_name TEXT;
    v_end_date DATE;
BEGIN
    v_table_name := 'vpn_traffic_stats_' || to_char(p_start_date, 'YYYY_MM');
    v_end_date := p_start_date + INTERVAL '1 month';
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.vpn_traffic_stats 
        FOR VALUES FROM (%L) TO (%L)', v_table_name, p_start_date, v_end_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
