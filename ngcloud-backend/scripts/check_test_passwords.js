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

  const users = ['Ali_2002', 'hassan.14', 'Ali_Hassan.20', 'Dua01'];
  const candidates = ['TestPassword123!', 'Password123!'];

  for (const username of users) {
    const res = await client.query("SELECT id, username, password_hash FROM users WHERE username = $1", [username]);
    if (res.rows.length === 0) continue;
    const user = res.rows[0];
    console.log(`Checking ${user.username}...`);
    for (const cand of candidates) {
      const check = await verifyPassword(cand, user.password_hash);
      if (check.valid) {
        console.log(`>>> FOUND PASSWORD FOR ${username}: "${cand}"`);
      }
    }
  }

  await client.end();
}

main().catch(console.error);
