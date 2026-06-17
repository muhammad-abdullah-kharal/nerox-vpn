const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  const find = await pool.query("SELECT user_id, email, is_verified FROM users WHERE LOWER(email) = LOWER('ayancoder8@gmail.com')");
  console.log('Found:', JSON.stringify(find.rows));
  const del = await pool.query("DELETE FROM users WHERE LOWER(email) = LOWER('ayancoder8@gmail.com')");
  console.log('Deleted count:', del.rowCount);
  await pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });
