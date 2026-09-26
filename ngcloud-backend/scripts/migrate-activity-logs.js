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

const migrationSQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_activity_logs_user_id;
DROP INDEX IF EXISTS idx_activity_logs_file_id;
DROP INDEX IF EXISTS idx_activity_logs_created_at;
DROP INDEX IF EXISTS idx_activity_logs_action;

-- Drop existing table
DROP TABLE IF EXISTS activity_logs;

-- Recreate table with exactly the requested columns
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_id UUID NULL REFERENCES files(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recreate requested indexes
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_file_id ON activity_logs(file_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
`;

async function runMigration() {
  try {
    console.log('📚 Connecting to PostgreSQL for activity logs migration...');
    await client.connect();
    console.log('✓ Connected successfully');
    console.log('📝 Migrating activity_logs table...');
    await client.query(migrationSQL);
    console.log('✓ Activity logs schema recreated successfully!');
  } catch (error) {
    console.error('❌ Migration Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
