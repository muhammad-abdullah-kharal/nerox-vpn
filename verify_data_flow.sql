-- Verification Script: verify_data_flow.sql
-- Run this in your Supabase SQL Editor to verify and test the new auditing system.

-- 1. Create a dummy user in auth.users (if possible, but usually easier to just trigger handle_new_user manually)
-- Since we can't easily mock auth.users insert without being superuser, we will test the public trigger directly.

DO $$
DECLARE
    v_test_id UUID := gen_random_uuid();
BEGIN
    RAISE NOTICE 'Starting verification...';

    -- A. Test User Profile & Audit Trigger
    INSERT INTO public.users (user_id, username, display_name, email, role)
    VALUES (v_test_id, 'test_auditor', 'Test Auditor', 'audit@test.com', 'user');

    -- B. Verify Audit Log was created
    IF EXISTS (SELECT 1 FROM public.audit_logs WHERE entity_id = v_test_id AND entity_type = 'users' AND action = 'CREATE') THEN
        RAISE NOTICE 'SUCCESS: Audit log created for user insertion.';
    ELSE
        RAISE EXCEPTION 'FAILURE: Audit log NOT created for user insertion.';
    END IF;

    -- C. Test Update Auditing
    UPDATE public.users SET display_name = 'Auditor Updated' WHERE user_id = v_test_id;

    IF EXISTS (SELECT 1 FROM public.audit_logs WHERE entity_id = v_test_id AND action = 'UPDATE' AND new_values->>'display_name' = 'Auditor Updated') THEN
        RAISE NOTICE 'SUCCESS: Audit log created for user update with correct values.';
    ELSE
        RAISE EXCEPTION 'FAILURE: Audit log NOT created for user update.';
    END IF;

    -- D. Test Session Auditing
    -- Note: This requires a valid server_id. Let's pick one from the seed data.
    DECLARE
        v_server_id UUID;
    BEGIN
        SELECT server_id INTO v_server_id FROM public.vpn_servers LIMIT 1;
        
        IF v_server_id IS NOT NULL THEN
            INSERT INTO public.vpn_sessions (user_id, server_id, client_ip, assigned_vpn_ip, status)
            VALUES (v_test_id, v_server_id, '127.0.0.1'::INET, '10.0.0.1'::INET, 'active');

            IF EXISTS (SELECT 1 FROM public.audit_logs WHERE entity_type = 'vpn_sessions' AND action = 'CREATE' AND user_id = v_test_id) THEN
                RAISE NOTICE 'SUCCESS: Session audit log created.';
            ELSE
                 RAISE NOTICE 'WARNING: Session audit log NOT created (check if vpn_sessions table has the trigger).';
            END IF;
        END IF;
    END;

    -- Cleanup
    DELETE FROM public.users WHERE user_id = v_test_id;
    -- Audit logs for cleanup will remain, which is good!

    RAISE NOTICE 'Verification complete. Check public.audit_logs to see the history.';
END $$;
