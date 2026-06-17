const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function dump() {
  const tables = ['subscription_plans', 'users', 'vpn_servers'];
  let sql = '';
  for (const table of tables) {
    const res = await pool.query('SELECT * FROM ' + table);
    if (res.rows.length === 0) continue;
    const columns = Object.keys(res.rows[0]);
    for (const row of res.rows) {
      const values = columns.map(c => {
        const val = row[c];
        if (val === null) return 'NULL';
        if (typeof val === 'string') return '\'' + val.replace(/'/g, "''") + '\'';
        if (typeof val === 'object') return '\'' + JSON.stringify(val).replace(/'/g, "''") + '\'';
        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
        return val;
      });
      sql += 'INSERT INTO ' + table + ' ("' + columns.join('", "') + '") VALUES (' + values.join(', ') + ');\n';
    }
  }
  fs.writeFileSync('dump.sql', sql);
  console.log('Dumped to dump.sql');
  pool.end();
}
dump();
