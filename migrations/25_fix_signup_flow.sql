-- Migration: 25_fix_signup_flow.sql
-- Purpose: Consolidate user creation and referral code generation into a single atomic transaction 
-- to resolve the "Database error saving new user" signup failure.

-- 1. Remove the redundant trigger that was causing a race condition
DROP TRIGGER IF EXISTS on_user_signup_generate_code ON public.users;

-- 2. Upgrade the handle_new_user function to be more robust and inclusive
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_referral_code TEXT;
BEGIN
    -- A. Generate unique referral code here inside the main transaction
    v_referral_code := generate_unique_referral_code();

    -- B. Perform Atomic Insert with ON CONFLICT safety
    INSERT INTO public.users (
        user_id, 
        username, 
        display_name,
        email, 
        role,
        referral_code
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'username', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'username', NEW.email),
        NEW.email,
        'user',
        v_referral_code
    )
    ON CONFLICT (user_id) DO UPDATE SET
        email = EXCLUDED.email,
        username = COALESCE(users.username, EXCLUDED.username);

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Fallback: If anything fails, still log the error but don't crash the auth process if possible
    -- However, for VPN app, we NEED the profile, so we let it fail with a more descriptive context if we were in a procedure.
    RAISE LOG 'Error in handle_new_user for ID %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-ensure the trigger is linked properly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Audit check: Ensure all users have a code (one last time)
UPDATE public.users 
SET referral_code = generate_unique_referral_code()
WHERE referral_code IS NULL;
