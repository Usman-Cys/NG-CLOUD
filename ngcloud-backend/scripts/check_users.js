require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function main() {
  await client.connect();
  const usersRes = await client.query('SELECT id, username, role FROM users');
  console.log('Current users in system:', usersRes.rows);
  await client.end();
}

main().catch(console.error);
