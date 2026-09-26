require('dotenv').config();
const pool = require('../src/config/db');
const { hashPassword } = require('../src/utils/passwordHash');

async function bootstrap() {
  try {
    console.log('🛡️  Checking admin bootstrap configuration...');
    
    // Check if any admin exists
    const result = await pool.query('SELECT COUNT(*)::int AS count FROM admins');
    const adminCount = result.rows[0].count;

    if (adminCount > 0) {
      console.log(`🛡️  Admin bootstrap skipped: ${adminCount} admin(s) already exist.`);
      return;
    }

    const username = process.env.BOOTSTRAP_ADMIN_USERNAME || 'admin';
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@ngcloud.local';
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

    if (!password) {
      console.warn('🛡️  Admin bootstrap skipped: BOOTSTRAP_ADMIN_PASSWORD not set in environment.');
      return;
    }

    console.log(`🛡️  No admins found. Bootstrapping initial admin: "${username}" (${email})...`);
    const passwordHash = await hashPassword(password);

    await pool.query(
      `INSERT INTO admins (username, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'admin', true)`,
      [username, email, passwordHash]
    );

    console.log(`🛡️  Admin "${username}" successfully bootstrapped with KT-QHF hash.`);
  } catch (err) {
    console.error('❌ Admin bootstrap error:', err);
    throw err;
  }
}

if (require.main === module) {
  bootstrap()
    .then(() => {
      console.log('✓ Bootstrap script finished');
      pool.end();
    })
    .catch((err) => {
      console.error('❌ Bootstrap script failed');
      pool.end();
      process.exit(1);
    });
}

module.exports = { bootstrap };
