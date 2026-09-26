require('dotenv').config();
const { Client } = require('pg');
const { verifyPassword } = require('../src/utils/passwordHash');

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  await client.connect();

  const res = await client.query("SELECT id, username, password_hash FROM users WHERE username = 'Dua01'");
  if (res.rows.length === 0) {
    console.log('Dua01 not found.');
    await client.end();
    return;
  }

  const user = res.rows[0];
  console.log('Dua01 ID:', user.id);
  console.log('Dua01 Hash:', user.password_hash);

  // Test some common passwords
  const candidates = ['Admin@!', 'Password@1', 'Password123', 'dua01', 'Dua01', '12345678', 'password', 'StandardPassword123!', 'Admin123!', 'StandardPassword123', 'Admin123'];
  for (const cand of candidates) {
    const check = await verifyPassword(cand, user.password_hash);
    if (check.valid) {
      console.log(`>>> FOUND VALID PASSWORD: "${cand}"`);
    }
  }

  await client.end();
}

main().catch(console.error);
