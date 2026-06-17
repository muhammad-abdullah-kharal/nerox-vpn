const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dorassgqhigcbohatnjr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcmFzc2dxaGlnY2JvaGF0bmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjI4NTksImV4cCI6MjA5MDYzODg1OX0.-fVFp1mm4Ra06AHH3y5eAGFopnTi5rqpGK4zSYfE6Wc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkServers() {
  console.log('Final Verification of vpn_servers...');
  const { data, error, count } = await supabase
    .from('vpn_servers')
    .select('*', { count: 'exact' });

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log(`Connection Pool Status: ${count} servers found.`);
  if (count > 0) {
    data.forEach(s => {
      console.log(`📍 ${s.hostname} (${s.country_code}) - Status: ${s.status}`);
    });
  } else {
    console.log('⚠️ WARNING: Table is still empty despite successful SQL execution!');
  }
}

checkServers();
