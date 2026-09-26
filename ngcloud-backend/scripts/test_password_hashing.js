#!/usr/bin/env node
/**
 * Test script: Verify KT-QHF password hashing round-trip and bcrypt fallback.
 */

require('dotenv').config();
const { hashPassword, verifyPassword, isKtqhfHash, isBcryptHash, needsRehash } = require('../src/utils/passwordHash');

async function main() {
  console.log('🔐 KT-QHF Password Hashing Test Suite');
  console.log('═'.repeat(60));

  // ── Test 1: Hash and verify ────────────────────────────
  console.log('\n📌 Test 1: Hash + Verify round-trip');
  const password = 'Admin@!';
  const hash = await hashPassword(password);
  console.log(`   Password:  ${password}`);
  console.log(`   Hash:      ${hash}`);
  console.log(`   Format:    ${hash.split('$').length === 5 ? '✅ 5-part KT-QHF' : '❌ unexpected format'}`);
  console.log(`   isKtqhf:   ${isKtqhfHash(hash) ? '✅' : '❌'}`);
  console.log(`   isBcrypt:  ${!isBcryptHash(hash) ? '✅ (correctly false)' : '❌'}`);
  console.log(`   needsRe:   ${!needsRehash(hash) ? '✅ (correctly false)' : '❌'}`);

  const result1 = await verifyPassword(password, hash);
  console.log(`   Verify OK: ${result1.valid ? '✅' : '❌'}`);
  console.log(`   Rehash?:   ${!result1.needsRehash ? '✅ (correctly false)' : '❌'}`);

  // ── Test 2: Wrong password ─────────────────────────────
  console.log('\n📌 Test 2: Wrong password rejection');
  const result2 = await verifyPassword('WrongPassword!', hash);
  console.log(`   Verify:    ${!result2.valid ? '✅ (correctly rejected)' : '❌'}`);

  // ── Test 3: bcrypt fallback ────────────────────────────
  console.log('\n📌 Test 3: Bcrypt legacy fallback');
  try {
    const bcrypt = require('bcrypt');
    const bcryptHash = await bcrypt.hash('LegacyPassword', 12);
    console.log(`   BcryptHash: ${bcryptHash.substring(0, 30)}...`);
    console.log(`   isBcrypt:   ${isBcryptHash(bcryptHash) ? '✅' : '❌'}`);
    console.log(`   needsRe:    ${needsRehash(bcryptHash) ? '✅ (correctly true)' : '❌'}`);

    const result3 = await verifyPassword('LegacyPassword', bcryptHash);
    console.log(`   Verify OK:  ${result3.valid ? '✅' : '❌'}`);
    console.log(`   Rehash?:    ${result3.needsRehash ? '✅ (correctly true)' : '❌'}`);

    const result3b = await verifyPassword('WrongLegacy', bcryptHash);
    console.log(`   Wrong pwd:  ${!result3b.valid ? '✅ (correctly rejected)' : '❌'}`);
  } catch (err) {
    console.log(`   ⚠️ Bcrypt not available (${err.message}), skipping legacy test`);
  }

  // ── Test 4: Verify admin hash from database ────────────
  console.log('\n📌 Test 4: Verify admin from database');
  const pool = require('../src/config/db');
  const dbResult = await pool.query('SELECT username, password_hash FROM admins WHERE username = $1', ['admin']);
  if (dbResult.rows.length > 0) {
    const adminRow = dbResult.rows[0];
    console.log(`   Username:   ${adminRow.username}`);
    console.log(`   Hash:       ${adminRow.password_hash.substring(0, 50)}...`);
    console.log(`   isKtqhf:    ${isKtqhfHash(adminRow.password_hash) ? '✅' : '❌'}`);

    const result4 = await verifyPassword('Admin@!', adminRow.password_hash);
    console.log(`   Verify OK:  ${result4.valid ? '✅' : '❌'}`);
    console.log(`   Rehash?:    ${!result4.needsRehash ? '✅ (correctly false)' : '❌'}`);
  } else {
    console.log('   ⚠️ No admin found in database');
  }

  await pool.end();
  console.log('\n' + '═'.repeat(60));
  console.log('✓ All tests completed');
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
