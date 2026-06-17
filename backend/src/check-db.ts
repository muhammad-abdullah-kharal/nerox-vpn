import pool from './config/db';

async function checkConnection() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful:', res.rows[0].now);
    
    const dbRes = await pool.query("SELECT datname FROM pg_database WHERE datname = 'nerox_vpn'");
    if (dbRes.rows.length > 0) {
      console.log('✅ Database "nerox_vpn" exists.');
    } else {
      console.log('❌ Database "nerox_vpn" NOT found.');
    }
    
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }
}

checkConnection();
