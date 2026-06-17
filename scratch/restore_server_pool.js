const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dorassgqhigcbohatnjr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcmFzc2dxaGlnY2JvaGF0bmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjI4NTksImV4cCI6MjA5MDYzODg1OX0.-fVFp1mm4Ra06AHH3y5eAGFopnTi5rqpGK4zSYfE6Wc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const DEFAULT_SERVERS = [
  {
    hostname: 'us-west-1.neroxvpn.com',
    ip_address: '104.24.1.5',
    location: 'San Francisco, US',
    city: 'San Francisco',
    country: 'USA',
    country_code: 'US',
    data_center: 'AWS-US-West',
    protocol: 'WireGuard',
    supported_protocols: ['WireGuard', 'OpenVPN'],
    status: 'active',
    is_premium: false,
    current_load: 12
  },
  {
    hostname: 'uk-north-1.neroxvpn.com',
    ip_address: '45.12.5.88',
    location: 'London, UK',
    city: 'London',
    country: 'United Kingdom',
    country_code: 'GB',
    data_center: 'DigitalOcean-Lon',
    protocol: 'WireGuard',
    supported_protocols: ['WireGuard', 'OpenVPN'],
    status: 'active',
    is_premium: true,
    current_load: 45
  },
  {
    hostname: 'sg-east-2.neroxvpn.com',
    ip_address: '159.89.2.14',
    location: 'Singapore, SG',
    city: 'Singapore',
    country: 'Singapore',
    country_code: 'SG',
    data_center: 'Equinix-SG',
    protocol: 'WireGuard',
    supported_protocols: ['WireGuard', 'OpenVPN'],
    status: 'active',
    is_premium: true,
    current_load: 22
  }
];

async function restoreServers() {
  console.log('📦 Starting server pool restoration...');
  
  for (const server of DEFAULT_SERVERS) {
    console.log(`Inserting: ${server.hostname}...`);
    const { error } = await supabase
      .from('vpn_servers')
      .upsert(server, { onConflict: 'hostname' });

    if (error) {
      console.error(`❌ Failed to insert ${server.hostname}:`, error.message);
    } else {
      console.log(`✅ ${server.hostname} restored successfully.`);
    }
  }

  console.log('🚀 Server pool restoration complete!');
}

restoreServers();
