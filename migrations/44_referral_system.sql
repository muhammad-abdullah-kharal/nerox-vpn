-- Migration: 44_referral_system.sql
-- Purpose: Implement a Viral Referral System with automated rewards

-- 1. Add referral_code to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referred_by_id UUID REFERENCES public.users(user_id);

-- 2. Create Referrals tracking table
CREATE TABLE IF NOT EXISTS public.referrals (
    referral_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE,
    referred_user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE,
    reward_granted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(referred_user_id) -- One referral per new user
);

-- 3. Function to generate a unique referral code
DROP FUNCTION IF EXISTS generate_unique_referral_code();
CREATE OR REPLACE FUNCTION generate_unique_referral_code() 
RETURNS VARCHAR AS $$
DECLARE
    v_code VARCHAR(10);
    v_exists BOOLEAN;
BEGIN
    LOOP
        v_code := 'NX-' || upper(substring(replace(uuid_generate_v4()::text, '-', ''), 1, 6));
        SELECT EXISTS (SELECT 1 FROM public.users WHERE referral_code = v_code) INTO v_exists;
        IF NOT v_exists THEN
            RETURN v_code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4. Generate codes for existing users who don't have one
UPDATE public.users SET referral_code = generate_unique_referral_code() WHERE referral_code IS NULL;

-- 5. Trigger to assign referral code to new users
CREATE OR REPLACE FUNCTION handle_referral_code_assignment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referral_code IS NULL THEN
        NEW.referral_code := generate_unique_referral_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_assign_referral_code ON public.users;
CREATE TRIGGER tr_assign_referral_code
    BEFORE INSERT ON public.users
    FOR EACH ROW EXECUTE FUNCTION handle_referral_code_assignment();

-- 6. Function to apply referral reward
CREATE OR REPLACE FUNCTION apply_referral(p_target_user_id UUID, p_code VARCHAR)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_referrer_id UUID;
    v_premium_plan_id UUID;
BEGIN
    -- 1. Find the referrer
    SELECT user_id INTO v_referrer_id FROM public.users WHERE referral_code = p_code;
    
    IF v_referrer_id IS NULL THEN
        RAISE EXCEPTION 'Invalid referral code';
    END IF;
    
    IF v_referrer_id = p_target_user_id THEN
        RAISE EXCEPTION 'You cannot refer yourself';
    END IF;

    -- 2. Check if user already has a referrer
    IF EXISTS (SELECT 1 FROM public.users WHERE user_id = p_target_user_id AND referred_by_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Referral already applied for this user';
    END IF;

    -- 3. Get a Premium Plan ID to use for the reward
    SELECT plan_id INTO v_premium_plan_id FROM public.subscription_plans WHERE name LIKE 'Premium%' LIMIT 1;

    -- 4. Record the referral
    INSERT INTO public.referrals (referrer_id, referred_user_id, reward_granted)
    VALUES (v_referrer_id, p_target_user_id, TRUE);

    -- 5. Update the referred user
    UPDATE public.users SET referred_by_id = v_referrer_id WHERE user_id = p_target_user_id;

    -- 6. GRANT REWARDS (7 days for referrer, 3 days for friend)
    IF v_premium_plan_id IS NOT NULL THEN
        -- Referrer Reward
        INSERT INTO public.subscriptions (user_id, plan_id, start_date, end_date, status, auto_renew)
        VALUES (v_referrer_id, v_premium_plan_id, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days', 'active', FALSE);

        -- Friend Reward
        INSERT INTO public.subscriptions (user_id, plan_id, start_date, end_date, status, auto_renew)
        VALUES (p_target_user_id, v_premium_plan_id, CURRENT_DATE, CURRENT_DATE + INTERVAL '3 days', 'active', FALSE);
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Referral applied! Rewards granted.');
END;
$$;
