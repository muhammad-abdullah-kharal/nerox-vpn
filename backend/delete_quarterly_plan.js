const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function deleteQuarterlyPlan() {
  await pool.query("DELETE FROM subscription_plans WHERE name = 'Quarterly'");
  console.log('Quarterly plan removed from DB');
  await pool.end();
}

deleteQuarterlyPlan();
