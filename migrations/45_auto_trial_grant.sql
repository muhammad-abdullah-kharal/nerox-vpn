-- Migration: 45_auto_trial_grant.sql
-- Purpose: Automatically grant a 7-day free trial on signup

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS \$\$
DECLARE
    v_plan_id UUID;
BEGIN
    -- 1. Create the public user profile
    INSERT INTO public.users (user_id, username, email, role, created_at)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'username', new.email),
        new.email,
        'user',
        NOW()
    );

    -- 2. Find a basic plan to use for the trial
    SELECT plan_id INTO v_plan_id FROM public.subscription_plans WHERE is_active = TRUE LIMIT 1;

    -- 3. Grant the 7-day trial subscription explicitly
    IF v_plan_id IS NOT NULL THEN
        INSERT INTO public.subscriptions (user_id, plan_id, start_date, end_date, status, auto_renew)
        VALUES (
            new.id,
            v_plan_id,
            CURRENT_DATE,
            CURRENT_DATE + INTERVAL '7 days',
            'active',
            FALSE
        );
    END IF;

    RETURN new;
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;
