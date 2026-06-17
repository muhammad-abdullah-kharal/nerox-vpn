-- Migration: 62_fix_referral_rpc_logic.sql
-- Purpose: Fix apply_referral RPC to use correct column names and grant 7/3 day rewards.

CREATE OR REPLACE FUNCTION public.apply_referral(p_target_user_id UUID, p_code VARCHAR)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_referrer_id UUID;
    v_premium_plan_id UUID;
BEGIN
    -- 1. Find the referrer (case-insensitive and trimmed)
    SELECT user_id INTO v_referrer_id 
    FROM public.users 
    WHERE referral_code = UPPER(TRIM(p_code));
    
    IF v_referrer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid referral code');
    END IF;
    
    IF v_referrer_id = p_target_user_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'You cannot refer yourself');
    END IF;

    -- 2. Check if user already has a referrer or has already applied a code
    IF EXISTS (SELECT 1 FROM public.referrals WHERE referee_id = p_target_user_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Referral already applied for this user');
    END IF;

    -- 3. Get a Premium Plan ID to use for the reward
    SELECT plan_id INTO v_premium_plan_id 
    FROM public.subscription_plans 
    WHERE name ILIKE '%Premium%' 
    ORDER BY price_usd DESC -- Pick the highest tier premium if multiple exist
    LIMIT 1;

    -- 4. Record the referral (using correct column names: referee_id)
    INSERT INTO public.referrals (referrer_id, referee_id, reward_granted, reward_days)
    VALUES (v_referrer_id, p_target_user_id, TRUE, 7); -- Storing 7 as the primary reward days

    -- 5. Update the referred user's profile
    UPDATE public.users SET referred_by_id = v_referrer_id WHERE user_id = p_target_user_id;

    -- 6. GRANT REWARDS (7 days for referrer, 3 days for friend)
    IF v_premium_plan_id IS NOT NULL THEN
        -- Referrer Reward: +7 Days
        INSERT INTO public.subscriptions (user_id, plan_id, start_date, end_date, status, auto_renew)
        VALUES (v_referrer_id, v_premium_plan_id, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days', 'active', FALSE);

        -- Friend Reward: +3 Days
        INSERT INTO public.subscriptions (user_id, plan_id, start_date, end_date, status, auto_renew)
        VALUES (p_target_user_id, v_premium_plan_id, CURRENT_DATE, CURRENT_DATE + INTERVAL '3 days', 'active', FALSE);
        
        -- Also update valid_to for fallback checking
        UPDATE public.users 
        SET valid_to = GREATEST(COALESCE(valid_to, NOW()), NOW()) + INTERVAL '7 days'
        WHERE user_id = v_referrer_id;
        
        UPDATE public.users 
        SET valid_to = GREATEST(COALESCE(valid_to, NOW()), NOW()) + INTERVAL '3 days'
        WHERE user_id = p_target_user_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Referral applied! 7 days granted to referrer and 3 days to you.');
END;
$$;
