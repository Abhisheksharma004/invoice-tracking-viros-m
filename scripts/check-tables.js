const mysql = require('mysql2/promise');

async function check(port, password) {
  try {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      port: port,
      user: 'root',
      password: password,
    });
    console.log(`\n=== Port ${port} (pwd: "${password}") ===`);
    const [dbs] = await conn.query('SHOW DATABASES;');
    console.log('Databases:', dbs.map(d => Object.values(d)[0]));
    
    try {
      await conn.query('USE invoice_erp;');
      const [tables] = await conn.query('SHOW TABLES;');
      console.log('Tables in invoice_erp:', tables.map(t => Object.values(t)[0]));
    } catch (err) {
      console.log('Could not USE invoice_erp:', err.message);
    }

    try {
      await conn.query('USE viros_gst_new;');
      const [tables] = await conn.query('SHOW TABLES;');
      console.log('Tables in viros_gst_new:', tables.map(t => Object.values(t)[0]));
    } catch (err) {
      console.log('Could not USE viros_gst_new:', err.message);
    }

    await conn.end();
  } catch (err) {
    console.log(`Port ${port} failed: ${err.message}`);
  }
}

async function main() {
  await check(3306, '');
  await check(3306, 'StrongPassword@123');
  await check(3307, '');
  await check(3307, 'StrongPassword@123');
}

main();
