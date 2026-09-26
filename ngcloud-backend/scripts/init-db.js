#!/usr/bin/env node
require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const initSQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  public_key_pqc TEXT,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  status VARCHAR(20) DEFAULT 'active',
  last_login_at TIMESTAMP NULL,
  storage_quota_bytes BIGINT DEFAULT 524288000,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS public_key_pqc TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ALTER COLUMN storage_quota_bytes SET DEFAULT 524288000;
UPDATE users SET storage_quota_bytes = 524288000 WHERE storage_quota_bytes = 1073741824 OR storage_quota_bytes IS NULL;

CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  total_chunks INTEGER NOT NULL DEFAULT 1,
  minio_path TEXT,
  chunk_map JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  file_hash TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE files ADD COLUMN IF NOT EXISTS total_chunks INTEGER NOT NULL DEFAULT 1;
ALTER TABLE files ADD COLUMN IF NOT EXISTS minio_path TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS chunk_map JSONB;
ALTER TABLE files ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE files ADD COLUMN IF NOT EXISTS size_bytes BIGINT NOT NULL DEFAULT 0;
ALTER TABLE files ADD COLUMN IF NOT EXISTS file_hash TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS file_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  minio_path TEXT NOT NULL,
  chunk_hash TEXT NOT NULL,
  chunk_size BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(file_id, chunk_index)
);

ALTER TABLE file_chunks ADD COLUMN IF NOT EXISTS chunk_size BIGINT NOT NULL DEFAULT 0;
DELETE FROM file_chunks a USING file_chunks b
WHERE a.id < b.id AND a.file_id = b.file_id AND a.chunk_index = b.chunk_index;
ALTER TABLE file_chunks DROP CONSTRAINT IF EXISTS file_chunks_file_id_chunk_index_key;
ALTER TABLE file_chunks ADD CONSTRAINT file_chunks_file_id_chunk_index_key UNIQUE (file_id, chunk_index);

CREATE TABLE IF NOT EXISTS file_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wrapped_key TEXT NOT NULL,
  algorithm VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(file_id, user_id)
);

CREATE TABLE IF NOT EXISTS shared_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(20) NOT NULL DEFAULT 'read',
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(file_id, shared_with_user_id)
);

CREATE TABLE IF NOT EXISTS file_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_wrapped_key TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'read',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(file_id, recipient_id)
);

CREATE TABLE IF NOT EXISTS file_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  locked_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lock_reason TEXT DEFAULT 'editing',
  locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) DEFAULT 'admin',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS kyber_public_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  admin_id UUID,
  action VARCHAR(100) NOT NULL,
  status VARCHAR(30) NOT NULL,
  ip_address VARCHAR(100),
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_files_owner_id ON files(owner_id);
CREATE INDEX IF NOT EXISTS idx_file_chunks_file_id ON file_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_file_keys_file_id ON file_keys(file_id);
CREATE INDEX IF NOT EXISTS idx_file_keys_user_id ON file_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_access_file_id ON shared_access(file_id);
CREATE INDEX IF NOT EXISTS idx_shared_access_shared_with ON shared_access(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_file_shares_file_id ON file_shares(file_id);
CREATE INDEX IF NOT EXISTS idx_file_shares_recipient_id ON file_shares(recipient_id);
CREATE INDEX IF NOT EXISTS idx_file_locks_file_id ON file_locks(file_id);
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_id UUID NULL REFERENCES files(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_file_id ON activity_logs(file_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- KT-QHF migration: widen password_hash columns to TEXT
ALTER TABLE users ALTER COLUMN password_hash TYPE TEXT;
ALTER TABLE admins ALTER COLUMN password_hash TYPE TEXT;
`;

async function init() {
  try {
    console.log('📚 Connecting to PostgreSQL...');
    console.log(`   Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    console.log(`   User: ${process.env.DB_USER}`);
    console.log(`   Database: ${process.env.DB_NAME}`);
    await client.connect();
    console.log('✓ Connected successfully');
    console.log('📝 Creating/updating NGCloud schema...');
    await client.query(initSQL);
    console.log('✓ NGCloud schema is ready');
  } catch (error) {
    console.error('❌ DB Init Error:', error.code || error.message);
    console.error('   Details:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

init();
