#!/usr/bin/env node
/**
 * Purge all user data, admin data, files, and related records from the database.
 * This script is used during KT-QHF migration to provide a clean slate.
 *
 * WARNING: This permanently deletes ALL data. Use with caution.
 */

require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function purge() {
  console.log('🗑️  Purging all NGCloud data for KT-QHF migration...');
  await client.connect();

  // Delete in dependency order to avoid FK violations
  const tables = [
    'activity_logs',
    'audit_logs',
    'file_locks',
    'file_shares',
    'shared_access',
    'file_keys',
    'file_chunks',
    'files',
    'admins',
    'users',
  ];

  for (const table of tables) {
    const result = await client.query(`DELETE FROM ${table}`);
    console.log(`   ✓ ${table}: ${result.rowCount} row(s) deleted`);
  }

  console.log('✓ All data purged successfully.');
  await client.end();
}

purge().catch(async (err) => {
  console.error('❌ Purge failed:', err);
  try { await client.end(); } catch (_) {}
  process.exit(1);
});
