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

  console.log('--- FILE KEYS (FILTERED) ---');
  const fileKeysRes = await client.query(`
    SELECT fk.id, f.filename, u.username as user, fk.wrapped_key, f.algorithm
    FROM file_keys fk
    JOIN files f ON fk.file_id = f.id
    JOIN users u ON fk.user_id = u.id
  `);
  for (const row of fileKeysRes.rows) {
    let pkg = null;
    try {
      pkg = JSON.parse(Buffer.from(row.wrapped_key, 'base64').toString('utf8'));
    } catch (e) {
      pkg = 'invalid base64/json';
    }
    if (pkg && pkg.nonce && pkg.nonce.includes('AAAAAA')) {
      continue; // Skip dummy mock files
    }
    console.log({
      id: row.id,
      filename: row.filename,
      user: row.user,
      algorithm: row.algorithm,
      package: pkg
    });
  }

  console.log('\n--- FILE SHARES (FILTERED) ---');
  const sharesRes = await client.query(`
    SELECT fs.id, f.filename, u_owner.username as owner, u_recip.username as recipient, fs.recipient_wrapped_key
    FROM file_shares fs
    JOIN files f ON fs.file_id = f.id
    JOIN users u_owner ON fs.owner_id = u_owner.id
    JOIN users u_recip ON fs.recipient_id = u_recip.id
  `);
  for (const row of sharesRes.rows) {
    let pkg = null;
    try {
      pkg = JSON.parse(Buffer.from(row.recipient_wrapped_key, 'base64').toString('utf8'));
    } catch (e) {
      pkg = 'invalid base64/json';
    }
    if (pkg && pkg.nonce && pkg.nonce.includes('AAAAAA')) {
      continue; // Skip dummy mock files
    }
    console.log({
      id: row.id,
      filename: row.filename,
      owner: row.owner,
      recipient: row.recipient,
      package: pkg
    });
  }

  await client.end();
}

main().catch(console.error);
