const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkPlans() {
  const res = await pool.query("SELECT plan_id, name, price_usd, duration_months, is_custom FROM subscription_plans");
  console.log('Plans:', JSON.stringify(res.rows, null, 2));
  await pool.end();
}

checkPlans().catch(err => {
  console.error(err);
  process.exit(1);
});
