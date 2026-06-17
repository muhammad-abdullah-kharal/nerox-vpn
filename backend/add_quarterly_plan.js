const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function addQuarterlyPlan() {
  try {
    const res = await pool.query(`
      INSERT INTO subscription_plans (name, price_usd, duration_months, max_devices, is_custom)
      VALUES ('Quarterly', 24.99, 3, 5, false)
      RETURNING *
    `);
    console.log('Added Plan:', res.rows[0] || 'Already exists');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

addQuarterlyPlan();
