-- Migration: 24_referral_system.sql
-- Purpose: Implementation of a viral referral system with secure rewards and anti-abuse logic.

-- 1. Add referral_code to public.users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;

-- 2. Create Referrals Tracking Table
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE,
    referee_id UUID UNIQUE REFERENCES public.users(user_id) ON DELETE CASCADE,
    reward_days INTEGER DEFAULT 3,
    reward_granted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Function to Generate Unique Referral Code
CREATE OR REPLACE FUNCTION generate_unique_referral_code() 
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    done BOOLEAN := FALSE;
BEGIN
    WHILE NOT done LOOP
        -- Generate Nerox-XXXX format
        new_code := 'NEROX-' || UPPER(substring(md5(random()::text) from 1 for 4));
        
        -- Check for collision
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE referral_code = new_code) THEN
            done := TRUE;
        END IF;
    END LOOP;
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger to assign referral code to new users
CREATE OR REPLACE FUNCTION trg_assign_referral_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referral_code IS NULL THEN
        NEW.referral_code := generate_unique_referral_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_user_signup_generate_code ON public.users;
CREATE TRIGGER on_user_signup_generate_code
BEFORE INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION trg_assign_referral_code();

-- 5. RPC to Apply Referral (Atomic Reward Issuance)
CREATE OR REPLACE FUNCTION apply_referral_reward(p_code TEXT, p_referee_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_referrer_id UUID;
    v_reward_days INTEGER := 3;
BEGIN
    -- A. Find Referrer
    SELECT user_id INTO v_referrer_id 
    FROM public.users 
    WHERE referral_code = UPPER(TRIM(p_code));

    -- B. Validation
    IF v_referrer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid referral code');
    END IF;

    IF v_referrer_id = p_referee_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'You cannot refer yourself');
    END IF;

    -- Check if referee already has a referral entry
    IF EXISTS (SELECT 1 FROM public.referrals WHERE referee_id = p_referee_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Referral already applied');
    END IF;

    -- C. Record Referral
    INSERT INTO public.referrals (referrer_id, referee_id, reward_days, reward_granted)
    VALUES (v_referrer_id, p_referee_id, v_reward_days, TRUE);

    -- D. Issue Reward (Bonus Subscription Time)
    -- If user has a subscription, extend it. Otherwise, extend their base valid_to (Trial).
    UPDATE public.users
    SET valid_to = COALESCE(valid_to, NOW() + INTERVAL '7 days') + (v_reward_days || ' days')::INTERVAL
    WHERE user_id = v_referrer_id;

    -- Also update any active subscription end_date for User A
    UPDATE public.subscriptions
    SET end_date = end_date + (v_reward_days || ' days')::INTERVAL
    WHERE user_id = v_referrer_id AND status = 'active';

    RETURN jsonb_build_object('success', true, 'message', 'Success! Referrer rewarded with +3 days.');
END;
$$ LANGUAGE plpgsql;

-- 6. Retroactively assign codes to existing users who don't have one
UPDATE public.users 
SET referral_code = 'NEROX-' || UPPER(substring(md5(user_id::text) from 1 for 4))
WHERE referral_code IS NULL;
