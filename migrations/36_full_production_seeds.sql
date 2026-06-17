-- Migration: 36_full_production_seeds.sql
-- Purpose: Populate every table with comprehensive data, starting with the core infrastructure (Servers) to enable all other reports.

-- 1. Seed VPN Servers (Infrastructure Foundation)
INSERT INTO public.vpn_servers (hostname, ip_address, location, country_code, data_center, protocol, status)
VALUES 
('us-west-1.neroxvpn.com', '104.24.1.5', 'San Francisco', 'US', 'AWS-US-West', 'WireGuard', 'active'),
('uk-north-1.neroxvpn.com', '45.12.5.88', 'London', 'GB', 'DigitalOcean-Lon', 'WireGuard', 'active'),
('sg-east-2.neroxvpn.com', '159.89.2.14', 'Singapore', 'SG', 'Equinix-SG', 'WireGuard', 'active')
ON CONFLICT (hostname) DO NOTHING;

-- 2. Seed Groups
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.groups WHERE group_name = 'Super Admins') THEN
        INSERT INTO public.groups (group_name, description, is_admin)
        VALUES ('Super Admins', 'Full access to all server configurations and user management.', TRUE);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM public.groups WHERE group_name = 'Support Team') THEN
        INSERT INTO public.groups (group_name, description, is_admin)
        VALUES ('Support Team', 'Access to feedback, FAQs, and basic user info for troubleshooting.', FALSE);
    END IF;
END $$;

-- 3. Seed Networks
INSERT INTO public.networks (cidr_range, description, is_internal)
VALUES 
('10.0.0.0/8', 'Primary VPN Internal Network', TRUE),
('172.16.0.0/12', 'Secondary Management Network', TRUE),
('10.8.0.0/24', 'WireGuard Dynamic Pool', TRUE)
ON CONFLICT (cidr_range) DO NOTHING;

-- 4. Seed Mock Users (For Testing Dashboard)
INSERT INTO public.users (user_id, username, display_name, email, role)
VALUES 
('00000000-0000-0000-0000-000000000001', 'demo_user_1', 'Demo User One', 'demo1@example.com', 'user'),
('00000000-0000-0000-0000-000000000002', 'demo_user_2', 'Demo User Two', 'demo2@example.com', 'user')
ON CONFLICT (user_id) DO NOTHING;

-- 5. Seed Transactional & Activity Data
DO $$ 
DECLARE
    v_user_1 UUID := '00000000-0000-0000-0000-000000000001';
    v_user_2 UUID := '00000000-0000-0000-0000-000000000002';
    v_plan_id UUID;
    v_sub_id UUID;
    v_server_id UUID;
    v_session_id UUID;
BEGIN
    -- Get valid IDs
    SELECT plan_id INTO v_plan_id FROM public.subscription_plans LIMIT 1;
    SELECT server_id INTO v_server_id FROM public.vpn_servers WHERE hostname = 'us-west-1.neroxvpn.com' LIMIT 1;

    -- A. Subscriptions & Payments
    IF v_plan_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = v_user_1) THEN
            INSERT INTO public.subscriptions (user_id, plan_id, start_date, end_date, status)
            VALUES (v_user_1, v_plan_id, CURRENT_DATE - 5, CURRENT_DATE + 25, 'active')
            RETURNING subscription_id INTO v_sub_id;

            INSERT INTO public.payment_transactions (subscription_id, amount, status, processed_at)
            VALUES (v_sub_id, 9.99, 'completed', NOW() - INTERVAL '5 days');
        END IF;
    END IF;

    -- B. VPN Sessions & Traffic Stats
    IF v_server_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.vpn_sessions WHERE user_id = v_user_1) THEN
        INSERT INTO public.vpn_sessions (user_id, server_id, client_ip, assigned_vpn_ip, status, start_time)
        VALUES (v_user_1, v_server_id, '192.168.1.100'::INET, '10.8.0.50'::INET, 'disconnected', NOW() - INTERVAL '2 hours')
        RETURNING session_id INTO v_session_id;

        INSERT INTO public.vpn_traffic_stats (session_id, bytes_sent, bytes_received, timestamp)
        VALUES (v_session_id, 1048576, 5242880, NOW() - INTERVAL '1 hour');

        INSERT INTO public.vpn_hourly_stats (session_id, total_bytes_sent, total_bytes_received, start_hour)
        VALUES (v_session_id, 1048576, 5242880, date_trunc('hour', NOW() - INTERVAL '1 hour'));
    END IF;

    -- C. Server Metrics Tracking
    IF v_server_id IS NOT NULL THEN
        INSERT INTO public.server_metrics (server_id, cpu_usage, avg_latency_ms, active_connections, recorded_at)
        VALUES (v_server_id, 45, 25, 128, NOW() - INTERVAL '5 minutes');
    END IF;

    -- D. Activity Tracking (Rate Limits, Support, Referrals)
    IF NOT EXISTS (SELECT 1 FROM public.rate_limits WHERE user_id = v_user_1 AND action_key = 'login_attempt') THEN
        INSERT INTO public.rate_limits (user_id, action_key, attempt_count, last_attempt, reset_at)
        VALUES (v_user_1, 'login_attempt', 2, NOW(), NOW() + INTERVAL '1 hour');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.support_feedback WHERE user_id = v_user_1) THEN
        INSERT INTO public.support_feedback (user_id, category, subject, message, status)
        VALUES (v_user_1, 'Connection', 'Slow speeds in London', 'I am experiencing some latency when connecting to the UK-1 server.', 'open');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.referrals WHERE referrer_id = v_user_1 AND referee_id = v_user_2) THEN
        INSERT INTO public.referrals (referrer_id, referee_id, reward_days, reward_granted)
        VALUES (v_user_1, v_user_2, 7, TRUE);
    END IF;

END $$;

-- 6. Seed Additional FAQs
DO $$ 
DECLARE
    v_cat_id UUID;
BEGIN
    SELECT id INTO v_cat_id FROM public.faq_categories WHERE name = 'Connection';
    
    IF v_cat_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.faqs WHERE question = 'How do I check my speed?') THEN
            INSERT INTO public.faqs (category_id, question, answer_text_1, sort_order)
            VALUES (v_cat_id, 'How do I check my speed?', 'You can use the built-in Speed Test tool in the settings menu.', 3);
        END IF;
    END IF;
END $$;
