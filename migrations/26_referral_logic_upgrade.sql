-- Migration: 26_referral_logic_upgrade.sql
-- Purpose: Enhance the referral system with dual rewards and device-level abuse prevention.

-- 1. Create a function to extract a device fingerprint from JSONB
CREATE OR REPLACE FUNCTION get_device_fingerprint(p_info JSONB)
RETURNS TEXT AS $$
BEGIN
    -- Use brand + model + os as a composite fingerprint
    RETURN COALESCE(p_info->>'brand', 'unknown') || '-' || 
           COALESCE(p_info->>'model', 'unknown') || '-' || 
           COALESCE(p_info->>'os', 'unknown');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Upgrade apply_referral_reward function
CREATE OR REPLACE FUNCTION apply_referral_reward(p_code TEXT, p_referee_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_referrer_uuid UUID;
    v_reward_intervals INTERVAL := '3 days'::INTERVAL;
    v_referee_device JSONB;
    v_referee_fp TEXT;
BEGIN
    -- A. Find Referrer
    SELECT user_id INTO v_referrer_uuid 
    FROM public.users 
    WHERE referral_code = UPPER(TRIM(p_code));

    -- B. Validation
    IF v_referrer_uuid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid referral code');
    END IF;

    IF v_referrer_uuid = p_referee_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'You cannot refer yourself');
    END IF;

    -- Check if referee already has a referral entry
    IF EXISTS (SELECT 1 FROM public.referrals WHERE referee_id = p_referee_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Referral already applied');
    END IF;

    -- C. Anti-Abuse (Device Fingerprint Check)
    SELECT last_device_info INTO v_referee_device FROM public.users WHERE user_id = p_referee_id;
    v_referee_fp := get_device_fingerprint(v_referee_device);

    -- Check if this device fingerprint has already been used for a referral
    IF EXISTS (
        SELECT 1 
        FROM public.referrals r
        JOIN public.users u ON r.referee_id = u.user_id
        WHERE get_device_fingerprint(u.last_device_info) = v_referee_fp
        AND v_referee_fp != 'unknown-unknown-unknown'
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Multi-account referral detected on this device');
    END IF;

    -- D. Record Referral
    INSERT INTO public.referrals (referrer_id, referee_id, reward_days, reward_granted)
    VALUES (v_referrer_uuid, p_referee_id, 3, TRUE);

    -- E. Issue Reward to REFERRER
    UPDATE public.users
    SET valid_to = GREATEST(COALESCE(valid_to, NOW()), NOW()) + v_reward_intervals
    WHERE user_id = v_referrer_uuid;

    UPDATE public.subscriptions
    SET end_date = (GREATEST(end_date, CURRENT_DATE) + v_reward_intervals)::DATE
    WHERE user_id = v_referrer_uuid AND status = 'active';

    -- F. Issue Reward to REFEREE
    UPDATE public.users
    SET valid_to = GREATEST(COALESCE(valid_to, NOW()), NOW()) + v_reward_intervals
    WHERE user_id = p_referee_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Success! Both you and your friend received +3 days of premium access.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
