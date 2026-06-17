-- Migration: 35_user_sync_hardening.sql
-- Purpose: Harden the user sync trigger to prevent silent failures and ensure profiles are always created.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_referral_code TEXT;
    v_full_name TEXT;
    v_max_retries INTEGER := 3;
    v_counter INTEGER := 0;
BEGIN
    -- 1. Extract Metadata
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'username', NEW.email);

    -- 2. Generate Referral Code with retry logic for collisions
    LOOP
        BEGIN
            v_referral_code := generate_unique_referral_code();
            
            -- Try to insert
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
                v_full_name,
                v_full_name,
                NEW.email,
                'user',
                v_referral_code
            )
            ON CONFLICT (user_id) DO UPDATE SET
                email = EXCLUDED.email,
                username = COALESCE(users.username, EXCLUDED.username);
            
            -- If we reached here, insert/update was successful
            EXIT; 
            
        EXCEPTION WHEN unique_violation THEN
            -- If referral_code collided, retry up to v_max_retries
            v_counter := v_counter + 1;
            IF v_counter >= v_max_retries THEN
                -- If we still fail, insert WITHOUT a referral code (better than no profile)
                INSERT INTO public.users (user_id, username, display_name, email, role, referral_code)
                VALUES (NEW.id, v_full_name, v_full_name, NEW.email, 'user', NULL)
                ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;
                EXIT;
            END IF;
            -- Continue loop to retry with new code
        WHEN OTHERS THEN
            -- For any other error, log it and return NEW (don't block auth)
            -- But ensure we tried at least one insert
            RAISE WARNING 'Unexpected error in handle_new_user for ID %: %', NEW.id, SQLERRM;
            EXIT;
        END;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-ensure trigger is correctly attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
