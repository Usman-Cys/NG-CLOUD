const { Pool } = require('pg');
const pool = new Pool({
  host: '192.168.136.200',
  port: 5432,
  user: 'admin',
  password: 'dbpassword',
  database: 'ngcloud'
});

async function main() {
  try {
    const res = await pool.query(
      `SELECT f.id, f.filename, fk.wrapped_key
       FROM files f
       LEFT JOIN file_keys fk ON fk.file_id = f.id
       WHERE f.id = 'e7591b12-d5cd-4ffa-8893-1c97c42327a1'`
    );

    const row = res.rows[0];
    if (!row || !row.wrapped_key) {
      console.log('No wrapped key found');
      return;
    }

    const decoded = Buffer.from(row.wrapped_key, 'base64').toString('utf-8');
    const pkg = JSON.parse(decoded);
    
    console.log('Full package:');
    console.log('  version:', pkg.version);
    console.log('  kem:', pkg.kem);
    console.log('  wrapCipher:', pkg.wrapCipher);
    console.log('  associatedData:', pkg.associatedData);
    
    // Check encryptedFileKey size
    const encKeyBytes = Buffer.from(pkg.encryptedFileKey, 'base64');
    console.log('  encryptedFileKey bytes:', encKeyBytes.length, '(should be 48 for 32-byte key: 32 plaintext + 16 tag)');
    
    // Check nonce size
    const nonceBytes = Buffer.from(pkg.nonce, 'base64');
    console.log('  nonce bytes:', nonceBytes.length, '(should be 16)');
    
    // Check kemCiphertext size
    const kemCtBytes = Buffer.from(pkg.kemCiphertext, 'base64');
    console.log('  kemCiphertext bytes:', kemCtBytes.length, '(should be 1088 for ML-KEM-768)');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
