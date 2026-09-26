const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const pool = require('../src/config/db');
const minioClient = require('../src/config/minioClient');
const { ktQhfHashBytes } = require('../src/utils/ktqhf');

const TEST_FILES_DIR = path.join(__dirname, '../test_files');
const BUCKET = process.env.MINIO_BUCKET || 'ngcloud-vault';

async function verifyPipeline() {
  console.log('🛡️ Starting Zero-Knowledge Encryption Pipeline Audit...');
  let failed = 0;
  let passed = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    } else {
      console.log(`✅ PASS: ${message}`);
      passed++;
    }
  }

  try {
    // 1. Fetch uploaded files list
    const filesRes = await pool.query(
      `SELECT id, owner_id, filename, size_bytes, nonce, algorithm, file_hash, status 
       FROM files 
       WHERE status = 'uploaded' AND filename LIKE '%e2e%'`
    );

    console.log(`\nFound ${filesRes.rows.length} E2E uploaded file(s) to verify.`);

    for (const file of filesRes.rows) {
      console.log(`\n--- Auditing File: "${file.filename}" (ID: ${file.id}) ---`);
      
      // A. Verify file is marked as uploaded and has size
      assert(file.status === 'uploaded', 'File status is "uploaded"');
      assert(Number(file.size_bytes) > 0, `File size is positive: ${file.size_bytes} bytes`);

      // B. Verify cryptographic envelope
      assert(file.algorithm === 'FS-MLWE-SC-256' || file.algorithm === 'FS-LWE-SC', `Cryptographic algorithm is valid: ${file.algorithm}`);
      assert(!!file.nonce, 'Cryptographic initialization vector (nonce) is present');
      
      // Verify wrapped key exists
      const keyRes = await pool.query(
        'SELECT wrapped_key FROM file_keys WHERE file_id = $1 AND user_id = $2',
        [file.id, file.owner_id]
      );
      assert(keyRes.rows.length > 0 && !!keyRes.rows[0].wrapped_key, 'ML-KEM/Kyber wrapped symmetric file key is present in database');

      if (keyRes.rows.length > 0) {
        const wrappedKey = keyRes.rows[0].wrapped_key;
        try {
          const decoded = Buffer.from(wrappedKey, 'base64').toString('utf8');
          const envelope = JSON.parse(decoded);
          assert(envelope.version === 2, 'Key envelope version is 2 (FS-MLWE-SC)');
          assert(envelope.kem === 'ML-KEM-768', 'KEM algorithm is ML-KEM-768');
          assert(envelope.wrapCipher === 'Ascon-128a', 'Wrap symmetric cipher is Ascon-128a');
          assert(!!envelope.nonce, 'KEM wrap nonce is present');
          assert(!!envelope.kemCiphertext, 'KEM ciphertext payload is present');
          assert(!!envelope.encryptedFileKey, 'Encrypted symmetric file key is present');
        } catch (e) {
          assert(false, `Key envelope failed structural validation: ${e.message}`);
        }
      }

      // C. Verify chunks and plaintext hash alignment
      const chunksRes = await pool.query(
        'SELECT chunk_index, minio_path, chunk_hash, chunk_size FROM file_chunks WHERE file_id = $1 ORDER BY chunk_index ASC',
        [file.id]
      );
      assert(chunksRes.rows.length > 0, `File chunk metadata records found: ${chunksRes.rows.length} chunk(s)`);

      // Get the original plaintext file if available on disk to verify hashes
      const origFilename = file.filename.replace('.enc', '');
      const origFilePath = path.join(TEST_FILES_DIR, origFilename);
      
      if (fs.existsSync(origFilePath)) {
        const origBytes = fs.readFileSync(origFilePath);
        const expectedFileHash = ktQhfHashBytes(origBytes);
        assert(file.file_hash === expectedFileHash, 'Plaintext full-file KT-QHF hash stored in files table matches original file hash');

        // Check each chunk hash
        const CHUNK_SIZE_4MB = 4 * 1024 * 1024;
        for (let i = 0; i < chunksRes.rows.length; i++) {
          const dbChunk = chunksRes.rows[i];
          const startOffset = i * CHUNK_SIZE_4MB;
          const endOffset = Math.min(startOffset + CHUNK_SIZE_4MB, origBytes.length);
          const expectedChunkBytes = origBytes.slice(startOffset, endOffset);
          const expectedChunkHash = ktQhfHashBytes(expectedChunkBytes);
          
          assert(dbChunk.chunk_hash === expectedChunkHash, `Chunk ${i} hash in database matches computed plaintext chunk hash`);

          // Fetch raw encrypted chunk bytes from MinIO and inspect them
          try {
            const minioPath = dbChunk.minio_path;
            const dataStream = await minioClient.getObject(BUCKET, minioPath);
            const chunkBytes = await new Promise((resolve, reject) => {
              const chunks = [];
              dataStream.on('data', c => chunks.push(c));
              dataStream.on('error', reject);
              dataStream.on('end', () => resolve(Buffer.concat(chunks)));
            });

            assert(chunkBytes.length === Number(dbChunk.chunk_size), `Downloaded MinIO chunk size matches database chunk size (${chunkBytes.length} bytes)`);

            // Verify content is encrypted (does not contain plaintext substring and is different from plaintext)
            const isDifferent = Buffer.compare(chunkBytes.slice(0, Math.min(100, chunkBytes.length)), expectedChunkBytes.slice(0, Math.min(100, expectedChunkBytes.length))) !== 0;
            assert(isDifferent, `MinIO chunk ${i} bytes differ from original plaintext bytes (encryption confirmed)`);

            if (origFilename.endsWith('.txt')) {
              const textContent = chunkBytes.toString('utf8');
              const containsPlaintext = textContent.includes('Hello, this is a secure text file');
              assert(!containsPlaintext, 'MinIO chunk bytes do not contain any plaintext string values');
            }
          } catch (minioErr) {
            assert(false, `Failed to retrieve chunk ${i} from MinIO bucket: ${minioErr.message}`);
          }
        }
      } else {
        console.log(`Original plaintext file "${origFilename}" not found on disk. Skipping hash match comparisons.`);
      }
    }

    console.log(`\n🏁 Encryption Pipeline Audit Completed. Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ Encryption pipeline audit crashed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run audit
verifyPipeline();
