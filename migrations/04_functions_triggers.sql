-- 4. Functions & Triggers
-- Logic for automating user profile creation and server selection

-- Automatically create public profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (user_id, username, email, role)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'username', new.email),
        new.email,
        'user'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run handle_new_user() after a new user is created in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Optimal server selection logic (chooses server with lowest load)
CREATE OR REPLACE FUNCTION get_optimal_server()
RETURNS TABLE(server_id UUID, hostname VARCHAR, current_load INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT s.server_id, s.hostname, s.current_load
    FROM public.vpn_servers s
    WHERE s.status = 'active'
    ORDER BY s.current_load ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;
