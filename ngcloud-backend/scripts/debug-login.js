require('dotenv').config();
const pool = require('../src/config/db');
const { verifyPassword } = require('../src/utils/passwordHash');

async function main() {
  const username = 'UsmanFazal';
  const password = 'Usman123!';

  try {
    console.log('Querying database for user:', username);
    const result = await pool.query(
      `SELECT
         id,
         username,
         password_hash,
         role,
         public_key_pqc,
         kyber_public_key,
         created_at,
         is_active
       FROM users
       WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      console.log('User not found.');
      return;
    }

    const user = result.rows[0];
    console.log('Found user:', user.username);
    console.log('Stored hash:', user.password_hash);

    console.log('Verifying password...');
    const { valid, needsRehash } = await verifyPassword(password, user.password_hash);
    console.log('Verification result:', { valid, needsRehash });

  } catch (err) {
    console.error('CRASHED WITH ERROR:', err);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
