import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const initDb = async () => {
  try {
    console.log('Initializing database...');
    const schemaSql = fs.readFileSync(path.join(__dirname, '../../schema.sql'), 'utf8');
    const seedSql = fs.readFileSync(path.join(__dirname, '../../seed_data.sql'), 'utf8');

    await pool.query(schemaSql);
    console.log('Schema applied successfully.');

    await pool.query(seedSql);
    console.log('Seed data applied successfully.');

    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
};

initDb();
