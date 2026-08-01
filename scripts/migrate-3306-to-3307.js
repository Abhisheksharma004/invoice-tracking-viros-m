const mysql = require('mysql2/promise');

async function migrate() {
  try {
    const src = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: '', database: 'invoice_erp' });
    const dst = await mysql.createConnection({ host: '127.0.0.1', port: 3307, user: 'root', password: 'StrongPassword@123', database: 'invoice_erp' });

    const tables = ['users', 'clients', 'salesmen', 'invoices', 'commission_payments', 'sales_commission_payments', 'office_expenses'];

    for (const table of tables) {
      try {
        const [rows] = await src.query(`SELECT * FROM \`${table}\``);
        console.log(`Copying ${rows.length} rows from table '${table}'...`);
        for (const row of rows) {
          const keys = Object.keys(row);
          const values = Object.values(row);
          const placeholders = keys.map(() => '?').join(', ');
          const columns = keys.map(k => `\`${k}\``).join(', ');
          const sql = `INSERT IGNORE INTO \`${table}\` (${columns}) VALUES (${placeholders})`;
          await dst.query(sql, values);
        }
      } catch (e) {
        console.log(`Table ${table} error:`, e.message);
      }
    }

    console.log('Migration complete!');
    await src.end();
    await dst.end();
  } catch (err) {
    console.error('Migration failed:', err.message);
  }
}

migrate();
