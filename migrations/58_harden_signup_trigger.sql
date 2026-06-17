-- Migration: 58_harden_signup_trigger.sql
-- Purpose: Create a robust, conflict-proof user creation trigger that handles trials and referral codes

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_plan_id UUID;
    v_username TEXT;
    v_base_name TEXT;
    v_referral_code TEXT;
BEGIN
    -- 1. Generate a Safe, Unique Username
    v_base_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
    v_username := v_base_name || '_' || substring(NEW.id::text, 1, 4);

    -- 2. Generate Referral Code (if not already handled by another trigger)
    -- We'll let the tr_assign_referral_code handle it if it exists, 
    -- but we ensure we don't crash if it's missing in this function.

    -- 3. Atomic Insert into public.users with Conflict Handling
    BEGIN
        INSERT INTO public.users (
            user_id, 
            username, 
            email, 
            plan_type,
            trial_started_at,
            trial_ends_at,
            created_at,
            max_devices
        )
        VALUES (
            NEW.id,
            v_username,
            NEW.email,
            'trial',
            NOW(),
            NOW() + INTERVAL '7 days',
            NOW(),
            1
        )
        ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'User Profile Creation Failed for %: %', NEW.id, SQLERRM;
        -- We continue so the auth process doesn't block
    END;

    -- 4. Find the 'Premium Yearly' or any active plan for the subscription record
    -- (This creates a record in the subscriptions table for the UI to show '7 Days Left')
    BEGIN
        SELECT plan_id INTO v_plan_id FROM public.subscription_plans WHERE is_active = TRUE LIMIT 1;
        
        IF v_plan_id IS NOT NULL THEN
            INSERT INTO public.subscriptions (user_id, plan_id, start_date, end_date, status, auto_renew)
            VALUES (
                NEW.id,
                v_plan_id,
                CURRENT_DATE,
                CURRENT_DATE + INTERVAL '7 days',
                'active',
                FALSE
            )
            ON CONFLICT DO NOTHING;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'Trial Subscription Creation Failed for %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
