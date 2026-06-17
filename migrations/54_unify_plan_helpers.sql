-- Migration: 54_unify_plan_helpers.sql
-- Purpose: Unify helper functions to use the users table as the source of truth

-- 1. Updated is_user_premium to use the users table
CREATE OR REPLACE FUNCTION public.is_user_premium(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE user_id = p_user_id 
        AND plan_type = 'premium' 
        AND (subscription_end_date IS NULL OR subscription_end_date > NOW())
    );
END;
$$;

-- 2. Updated is_user_in_trial to use the users table
CREATE OR REPLACE FUNCTION public.is_user_in_trial(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE user_id = p_user_id 
        AND plan_type = 'trial' 
        AND trial_ends_at > NOW()
    );
END;
$$;
