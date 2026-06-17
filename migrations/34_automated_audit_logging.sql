-- Migration: 34_automated_audit_logging.sql
-- Purpose: Implement a robust, automated auditing system using database triggers.

-- 0. Drop strict FK constraint to ensure logs can persist for all actors
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

-- 1. Create the Audit Function
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_action TEXT;
    v_entity_type TEXT := TG_TABLE_NAME;
    v_entity_id UUID;
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
BEGIN
    -- Determine the User ID
    -- If auth.uid() is available (from client app), use it.
    -- Otherwise, try to infer it from the record if possible, or leave NULL.
    v_user_id := auth.uid();

    IF (TG_OP = 'INSERT') THEN
        v_action := 'CREATE';
        v_new_data := to_jsonb(NEW);
        -- Common ID fields (Safely extracted via JSONB)
        v_entity_id := CASE 
            WHEN TG_TABLE_NAME = 'users' THEN (v_new_data->>'user_id')::UUID
            WHEN TG_TABLE_NAME = 'vpn_sessions' THEN (v_new_data->>'session_id')::UUID
            WHEN TG_TABLE_NAME = 'subscriptions' THEN (v_new_data->>'subscription_id')::UUID
            WHEN TG_TABLE_NAME = 'referrals' THEN (v_new_data->>'id')::UUID
            ELSE NULL 
        END;
    ELSIF (TG_OP = 'UPDATE') THEN
        v_action := 'UPDATE';
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_entity_id := CASE 
            WHEN TG_TABLE_NAME = 'users' THEN (v_new_data->>'user_id')::UUID
            WHEN TG_TABLE_NAME = 'vpn_sessions' THEN (v_new_data->>'session_id')::UUID
            WHEN TG_TABLE_NAME = 'subscriptions' THEN (v_new_data->>'subscription_id')::UUID
            WHEN TG_TABLE_NAME = 'referrals' THEN (v_new_data->>'id')::UUID
            ELSE NULL 
        END;
    ELSIF (TG_OP = 'DELETE') THEN
        v_action := 'DELETE';
        v_old_data := to_jsonb(OLD);
        v_entity_id := CASE 
            WHEN TG_TABLE_NAME = 'users' THEN (v_old_data->>'user_id')::UUID
            WHEN TG_TABLE_NAME = 'vpn_sessions' THEN (v_old_data->>'session_id')::UUID
            WHEN TG_TABLE_NAME = 'subscriptions' THEN (v_old_data->>'subscription_id')::UUID
            WHEN TG_TABLE_NAME = 'referrals' THEN (v_old_data->>'id')::UUID
            ELSE NULL 
        END;
    END IF;

    -- Special case for users table to capture user_id even if auth.uid() is null (e.g. trigger during signup)
    IF v_user_id IS NULL AND TG_TABLE_NAME = 'users' THEN
        v_user_id := COALESCE(NEW.user_id, OLD.user_id);
    END IF;

    -- Insert into audit_logs
    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values
    ) VALUES (
        v_user_id,
        v_action,
        v_entity_type,
        v_entity_id,
        v_old_data,
        v_new_data
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach Triggers to Core Tables

-- Function to handle After (Insert/Update)
DROP TRIGGER IF EXISTS trg_audit_users_after ON public.users;
CREATE TRIGGER trg_audit_users_after
    AFTER INSERT OR UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Function to handle Before (Delete)
DROP TRIGGER IF EXISTS trg_audit_users_before ON public.users;
CREATE TRIGGER trg_audit_users_before
    BEFORE DELETE ON public.users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- VPN Sessions
DROP TRIGGER IF EXISTS trg_audit_vpn_sessions_after ON public.vpn_sessions;
CREATE TRIGGER trg_audit_vpn_sessions_after
    AFTER INSERT OR UPDATE ON public.vpn_sessions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS trg_audit_vpn_sessions_before ON public.vpn_sessions;
CREATE TRIGGER trg_audit_vpn_sessions_before
    BEFORE DELETE ON public.vpn_sessions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Subscriptions
DROP TRIGGER IF EXISTS trg_audit_subscriptions_after ON public.subscriptions;
CREATE TRIGGER trg_audit_subscriptions_after
    AFTER INSERT OR UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS trg_audit_subscriptions_before ON public.subscriptions;
CREATE TRIGGER trg_audit_subscriptions_before
    BEFORE DELETE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Referrals
DROP TRIGGER IF EXISTS trg_audit_referrals_after ON public.referrals;
CREATE TRIGGER trg_audit_referrals_after
    AFTER INSERT OR UPDATE ON public.referrals
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS trg_audit_referrals_before ON public.referrals;
CREATE TRIGGER trg_audit_referrals_before
    BEFORE DELETE ON public.referrals
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- 3. Security: Ensure the Authenticated role can see their own logs (already in migration 29)
-- But we add INSERT permission to the service role / authenticated role if they log manually (optional)
GRANT INSERT ON public.audit_logs TO authenticated;
GRANT INSERT ON public.audit_logs TO service_role;

-- 4. Policy: Allow insertion if triggered by the user's action
-- Note: Trigger runs as SECURITY DEFINER, so it can write even if RLS is strict.
-- But if the app wants to log manually, we need an INSERT policy.
DROP POLICY IF EXISTS "Users can insert own audit logs" ON public.audit_logs;
CREATE POLICY "Users can insert own audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
