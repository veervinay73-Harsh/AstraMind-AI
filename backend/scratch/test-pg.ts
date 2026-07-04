import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

console.log('Raw DATABASE_URL:', process.env.DATABASE_URL);
const cleanUrl = process.env.DATABASE_URL?.replace(/^"|"$/g, '');
console.log('Cleaned DATABASE_URL:', cleanUrl);

const pool = new pg.Pool({
  connectionString: cleanUrl,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Pool connection failed:', err.message || err);
    return;
  }
  console.log('✅ Pool connection successful!');
  if (client) {
    client.query('SELECT 1', (queryErr, result) => {
      release();
      if (queryErr) {
        console.error('❌ Query failed:', queryErr.message || queryErr);
      } else {
        console.log('✅ Query succeeded. Rows:', result.rows);
      }
      pool.end();
    });
  }
});
