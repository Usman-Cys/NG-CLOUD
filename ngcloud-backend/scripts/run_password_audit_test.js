require('dotenv').config();
const pool = require('../src/config/db');
const { hashPassword, verifyPassword } = require('../src/utils/passwordHash');

async function runAudit() {
  console.log('============================================================');
  console.log('       PASSWORD HASHING SECURITY AUDIT ROUND-TRIP TEST       ');
  console.log('============================================================');

  const usernameA = 'viva_test_a';
  const usernameB = 'viva_test_b';
  const testPassword = 'VivaPassword123!';

  try {
    // 1. Clean up potential old test users
    await pool.query('DELETE FROM users WHERE username IN ($1, $2)', [usernameA, usernameB]);

    // 2. Hash and Register User A
    const hashA = await hashPassword(testPassword);
    await pool.query(
      `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'user')`,
      [usernameA, hashA]
    );
    console.log(`✓ User "${usernameA}" registered successfully.`);

    // 3. Hash and Register User B
    const hashB = await hashPassword(testPassword);
    await pool.query(
      `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'user')`,
      [usernameB, hashB]
    );
    console.log(`✓ User "${usernameB}" registered successfully.`);

    // 4. Retrieve rows from PostgreSQL
    const dbRes = await pool.query(
      'SELECT username, password_hash FROM users WHERE username IN ($1, $2) ORDER BY username ASC',
      [usernameA, usernameB]
    );

    console.log('\n📊 DATABASE RECORD INSPECTION (PostgreSQL):');
    console.log('-'.repeat(80));
    console.log(String('Username').padEnd(15) | String('Salt').padEnd(36) | String('Hash').padEnd(68));
    console.log('-'.repeat(80));

    const rows = dbRes.rows;
    const tableData = [];

    for (const row of rows) {
      const parts = row.password_hash.split('$');
      // format: ktqhf$v1$iterations$saltHex$hashHex
      const salt = parts[3];
      const hash = parts[4];
      console.log(`${row.username.padEnd(15)} | ${salt.padEnd(32)} | ${hash}`);
      tableData.push({ username: row.username, salt, hash, fullHash: row.password_hash });
    }
    console.log('-'.repeat(80));

    // 5. Compare Salt & Hash uniqueness
    const saltMatch = tableData[0].salt === tableData[1].salt;
    const hashMatch = tableData[0].hash === tableData[1].hash;

    console.log('\n🔍 SALT & HASH COMPARISON RESULTS:');
    console.log(`   * Salt A (${tableData[0].salt.substring(0, 10)}...) == Salt B (${tableData[1].salt.substring(0, 10)}...)? ${saltMatch ? '❌ MATCH' : '✅ UNIQUE'}`);
    console.log(`   * Hash A (${tableData[0].hash.substring(0, 10)}...) == Hash B (${tableData[1].hash.substring(0, 10)}...)? ${hashMatch ? '❌ MATCH' : '✅ UNIQUE'}`);

    if (!saltMatch && !hashMatch) {
      console.log('   🎉 SUCCESS: Even though both users registered with the EXACT same password,');
      console.log('               their database salts and hashes are completely unique.');
    }

    // 6. Test login verification round-trip
    console.log('\n🔐 TESTING LOGIN VERIFICATION PROCESS:');
    const verifyA = await verifyPassword(testPassword, tableData[0].fullHash);
    const verifyB = await verifyPassword(testPassword, tableData[1].fullHash);
    
    console.log(`   * User A login with "${testPassword}": ${verifyA.valid ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`   * User B login with "${testPassword}": ${verifyB.valid ? '✅ SUCCESS' : '❌ FAILED'}`);

    const verifyWrong = await verifyPassword('WrongPassword!', tableData[0].fullHash);
    console.log(`   * User A login with wrong password:   ${!verifyWrong.valid ? '✅ REJECTED (Correct)' : '❌ ALLOWED (Bug)'}`);

    // 7. Clean up
    await pool.query('DELETE FROM users WHERE username IN ($1, $2)', [usernameA, usernameB]);
    console.log('\n🧹 Test users purged from database.');

  } catch (err) {
    console.error('❌ Error running audit script:', err);
  } finally {
    await pool.end();
  }
}

runAudit();
