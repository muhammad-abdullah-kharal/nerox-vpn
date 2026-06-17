-- Migration: 32_security_rpc_integration.sql
-- Purpose: Integrate rate limiting into sensitive RPC functions.

-- 1. Update submit_feedback with rate limiting
CREATE OR REPLACE FUNCTION submit_feedback(p_user_id UUID, p_category TEXT, p_subject TEXT, p_message TEXT)
RETURNS JSONB AS $$
BEGIN
    -- Check rate limit: Max 3 feedbacks per 10 minutes
    IF NOT check_and_update_rate_limit(p_user_id, 'submit_feedback', 3, 10) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Too many feedback submissions. Please wait a few minutes.');
    END IF;

    INSERT INTO public.support_feedback (user_id, category, subject, message)
    VALUES (p_user_id, p_category, p_subject, p_message);
    
    RETURN jsonb_build_object('success', true, 'message', 'Feedback submitted successfully.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update apply_referral_reward with rate limiting
-- Replaces previous implementation from migration 26
CREATE OR REPLACE FUNCTION apply_referral_reward(p_code TEXT, p_referee_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_referrer_id UUID;
    v_reward_days INTEGER := 3;
BEGIN
    -- Check rate limit: Max 5 referral attempts per 10 minutes per IP/User
    IF NOT check_and_update_rate_limit(p_referee_id, 'apply_referral', 5, 10) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Too many referral attempts. Please try again later.');
    END IF;

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

    IF EXISTS (SELECT 1 FROM public.referrals WHERE referee_id = p_referee_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Referral already applied');
    END IF;

    -- C. Record Referral
    INSERT INTO public.referrals (referrer_id, referee_id, reward_days, reward_granted)
    VALUES (v_referrer_id, p_referee_id, v_reward_days, TRUE);

    -- D. Issue Reward
    UPDATE public.users
    SET valid_to = GREATEST(COALESCE(valid_to, NOW()), NOW()) + (v_reward_days || ' days')::INTERVAL
    WHERE user_id = v_referrer_id;

    UPDATE public.subscriptions
    SET end_date = end_date + (v_reward_days || ' days')::INTERVAL
    WHERE user_id = v_referrer_id AND status = 'active';

    RETURN jsonb_build_object('success', true, 'message', 'Success! Referrer rewarded.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
