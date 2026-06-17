const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkColumns() {
  const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
  console.log('Columns:', res.rows.map(r => r.column_name).join(', '));
  await pool.end();
}

checkColumns().catch(err => {
  console.error(err);
  process.exit(1);
});
