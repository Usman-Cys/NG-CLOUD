require('dotenv').config();
const { Client } = require('pg');
const { hashPassword } = require('../src/utils/passwordHash');

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function main() {
  console.log('📚 Starting Module 3 Admin Connectivity Migrations...');
  await client.connect();

  // 1. Add status, last_login_at, storage_quota_bytes to users table
  console.log('📝 Updating users table columns...');
  await client.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS storage_quota_bytes BIGINT DEFAULT 524288000;
  `);

  // 2. Create activity_logs table
  console.log('📝 Creating activity_logs table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(80) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'success',
      ip_address TEXT,
      user_agent TEXT,
      file_id UUID REFERENCES files(id) ON DELETE SET NULL,
      details JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_file_id ON activity_logs(file_id);
  `);

  // 3. Seed admin user in users table
  console.log('📝 Seeding admin user in users table...');
  const passwordHash = await hashPassword('Admin123!');
  await client.query(`
    INSERT INTO users (username, password_hash, role, status)
    VALUES ('admin', $1, 'admin', 'active')
    ON CONFLICT (username) DO UPDATE SET role = 'admin', status = 'active';
  `, [passwordHash]);

  console.log('✓ Database migrated and admin seeded successfully.');
  await client.end();
}

main().catch(async (err) => {
  console.error('❌ Migration failed:', err);
  await client.end();
  process.exit(1);
});
