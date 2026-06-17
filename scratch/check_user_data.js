const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dorassgqhigcbohatnjr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcmFzc2dxaGlnY2JvaGF0bmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjI4NTksImV4cCI6MjA5MDYzODg1OX0.-fVFp1mm4Ra06AHH3y5eAGFopnTi5rqpGK4zSYfE6Wc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', 'a@gmail.com');
    
    if (error) {
        console.error('Error fetching user:', error);
        return;
    }
    
    console.log('--- User Info (public.users) ---');
    console.table(users);

    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    // Note: service role key is needed for admin.listUsers.
    // I don't have it, so I'll try to get it from auth.users if I can? No, standard key can't.
    // But I can check if the user exists in public.users.
}

checkUser();
