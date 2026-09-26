require('dotenv').config();
const pool = require('../src/config/db');
const minioClient = require('../src/config/minioClient');

async function runAudit() {
  console.log('🔍 Starting Database and MinIO Storage Integrity Audit...');
  let issues = 0;

  try {
    // 1. Total counts of table entries
    const tables = [
      'users', 'admins', 'files', 'file_chunks', 'file_keys', 'file_shares', 'file_locks', 'audit_logs', 'activity_logs'
    ];
    console.log('\n--- Table Entry Counts ---');
    for (const table of tables) {
      const res = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
      console.log(`  Table "${table}": ${res.rows[0].count} record(s)`);
    }

    // 2. Orphan Checks
    console.log('\n--- Orphan Metadata Checks ---');
    
    // Orphan chunks
    const chunkOrphans = await pool.query(
      'SELECT COUNT(*)::int AS count FROM file_chunks WHERE file_id NOT IN (SELECT id FROM files)'
    );
    const orphanChunksCount = chunkOrphans.rows[0].count;
    if (orphanChunksCount > 0) {
      console.error(`❌ ERROR: Found ${orphanChunksCount} orphaned file chunks with invalid file references.`);
      issues++;
    } else {
      console.log('✅ Chunks: No orphaned chunk metadata records found.');
    }

    // Orphan keys
    const keyOrphans = await pool.query(
      'SELECT COUNT(*)::int AS count FROM file_keys WHERE file_id NOT IN (SELECT id FROM files)'
    );
    const orphanKeysCount = keyOrphans.rows[0].count;
    if (orphanKeysCount > 0) {
      console.error(`❌ ERROR: Found ${orphanKeysCount} orphaned file keys with invalid file references.`);
      issues++;
    } else {
      console.log('✅ Keys: No orphaned encryption key metadata found.');
    }

    // Orphan shares
    const shareOrphans = await pool.query(
      'SELECT COUNT(*)::int AS count FROM file_shares WHERE file_id NOT IN (SELECT id FROM files)'
    );
    const orphanSharesCount = shareOrphans.rows[0].count;
    if (orphanSharesCount > 0) {
      console.error(`❌ ERROR: Found ${orphanSharesCount} orphaned file shares with invalid file references.`);
      issues++;
    } else {
      console.log('✅ Shares: No orphaned sharing records found.');
    }

    // 3. Storage quota compliance checks
    console.log('\n--- Storage Quota Audits ---');
    const quotaRes = await pool.query(`
      SELECT 
        u.username,
        u.storage_quota_bytes,
        COALESCE(SUM(f.size_bytes), 0)::bigint AS used_bytes
      FROM users u
      LEFT JOIN files f ON f.owner_id = u.id AND f.status != 'deleted'
      GROUP BY u.id, u.username, u.storage_quota_bytes
    `);

    let quotaViolations = 0;
    for (const row of quotaRes.rows) {
      const quotaMb = (Number(row.storage_quota_bytes) / (1024 * 1024)).toFixed(1);
      const usedMb = (Number(row.used_bytes) / (1024 * 1024)).toFixed(1);
      if (Number(row.used_bytes) > Number(row.storage_quota_bytes)) {
        console.error(`❌ VIOLATION: User "${row.username}" exceeded quota! Used: ${usedMb} MB / Allowed: ${quotaMb} MB`);
        quotaViolations++;
        issues++;
      }
    }
    if (quotaViolations === 0) {
      console.log('✅ Quota: All users are operating within their allocated storage quota limits.');
    }

    // 4. MinIO Bucket objects audit
    console.log('\n--- MinIO Storage Audit ---');
    const bucket = process.env.MINIO_BUCKET;
    const exists = await minioClient.bucketExists(bucket);
    if (!exists) {
      console.error(`❌ ERROR: MinIO bucket "${bucket}" does not exist!`);
      issues++;
    } else {
      console.log(`✅ MinIO Bucket: "${bucket}" exists and is accessible.`);
    }

    // List objects and check for encryption / naming conventions
    console.log('\nScanning MinIO objects:');
    const objects = [];
    const stream = minioClient.listObjects(bucket, '', true);
    
    await new Promise((resolve, reject) => {
      stream.on('data', (obj) => {
        objects.push(obj);
      });
      stream.on('error', reject);
      stream.on('end', resolve);
    });

    console.log(`  Found ${objects.length} object(s) in MinIO bucket "${bucket}".`);
    
    // Check if objects match known file_chunks or files
    let unregisteredObjects = 0;
    const dbPathsRes = await pool.query(
      `SELECT minio_path FROM files WHERE status != 'deleted' AND minio_path IS NOT NULL
       UNION
       SELECT minio_path FROM file_chunks`
    );
    const dbPaths = new Set(dbPathsRes.rows.map(r => r.minio_path));

    for (const obj of objects) {
      const name = obj.name;
      if (!dbPaths.has(name)) {
        // Check if it belongs to a deleted/soft-deleted file or is completely unregistered
        const fileCheck = await pool.query(
          `SELECT filename, status FROM files WHERE minio_path = $1 OR id::text = SPLIT_PART($1, '/', 2)`,
          [name]
        );
        if (fileCheck.rows.length > 0) {
          console.log(`  • Object "${name}" belongs to file "${fileCheck.rows[0].filename}" (Status: ${fileCheck.rows[0].status})`);
        } else {
          console.warn(`  ⚠️ WARNING: Object "${name}" is completely unregistered in database.`);
          unregisteredObjects++;
        }
      } else {
        console.log(`  • Object "${name}" matches active database record (Size: ${obj.size} bytes).`);
      }
    }

    console.log('\n--- Final Integrity Summary ---');
    if (issues === 0) {
      console.log('💚 Database & Storage Integrity checks PASSED. Zero critical issues detected.');
    } else {
      console.error(`❤️ Database & Storage Integrity checks FAILED with ${issues} issue(s).`);
    }

  } catch (err) {
    console.error('❌ Audit execution failed with error:', err.message);
  } finally {
    await pool.end();
  }
}

runAudit();
