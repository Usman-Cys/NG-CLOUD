const https = require('https');

const API_BASE = 'https://localhost:5000';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (body) {
      headers['Content-Length'] = Buffer.byteLength(data);
    }

    const reqOptions = {
      method: options.method || 'GET',
      headers,
      rejectUnauthorized: false, // For local self-signed dev SSL certificate
    };

    const url = new URL(options.url);
    reqOptions.hostname = url.hostname;
    reqOptions.port = url.port;
    reqOptions.path = url.pathname + url.search;

    const req = https.request(reqOptions, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        let parsed = responseBody;
        try {
          parsed = JSON.parse(responseBody);
        } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed,
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(data);
    }
    req.end();
  });
}

async function runTests() {
  console.log('🏁 Starting NGCloud E2E Integration Test Suite...');
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
    // ----------------------------------------------------
    // Phase 1: Environment & Health Validation
    // ----------------------------------------------------
    console.log('\n--- Phase 1: Environment Health Check ---');
    const rootRes = await request({ url: `${API_BASE}/` });
    assert(rootRes.status === 200 && rootRes.data.status === 'ok', 'Root API endpoint responds with success status');

    const healthRes = await request({ url: `${API_BASE}/health` });
    assert(healthRes.status === 200, 'Health endpoint status code is 200');
    assert(healthRes.data.status === 'healthy', 'Database and MinIO connections are healthy');

    // ----------------------------------------------------
    // Phase 2: User Registration Scenario Validation
    // ----------------------------------------------------
    console.log('\n--- Phase 2: User Registration Validations ---');
    const timestamp = Date.now();
    const userA_name = `user_a_${timestamp}`;
    const userB_name = `user_b_${timestamp}`;

    // Base64 public keys
    const pubKeyPqcBase64 = Buffer.from('pqc_pubkey_bytes_dummy').toString('base64');
    const kyberPublicKeyBase64 = Buffer.from('kyber_pubkey_bytes_dummy').toString('base64');

    // 1. Weak password registration (too short)
    const weakShortRes = await request({
      url: `${API_BASE}/api/auth/register`,
      method: 'POST',
    }, {
      username: userA_name,
      password: '123',
      publicKeyPqc: pubKeyPqcBase64,
      kyberPublicKey: kyberPublicKeyBase64
    });
    assert(weakShortRes.status === 400, 'Short password (length < 8) registration rejected with 400');

    // 2. Weak password registration (no digit or special char)
    const weakPassRes = await request({
      url: `${API_BASE}/api/auth/register`,
      method: 'POST',
    }, {
      username: userA_name,
      password: 'weakpasswordonlyletters',
      publicKeyPqc: pubKeyPqcBase64,
      kyberPublicKey: kyberPublicKeyBase64
    });
    assert(weakPassRes.status === 400, 'Password without digits/special chars rejected with 400');

    // 3. Valid Registration: User A
    const regARes = await request({
      url: `${API_BASE}/api/auth/register`,
      method: 'POST',
    }, {
      username: userA_name,
      password: 'StrongPassword123!',
      publicKeyPqc: pubKeyPqcBase64,
      kyberPublicKey: kyberPublicKeyBase64
    });
    assert(regARes.status === 201, 'User A registered successfully with valid Base64 keys');
    if (regARes.status !== 201) {
      console.log('User A registration failed:', regARes.data);
    }

    // 4. Duplicate username check
    const dupRes = await request({
      url: `${API_BASE}/api/auth/register`,
      method: 'POST',
    }, {
      username: userA_name,
      password: 'StrongPassword123!',
      publicKeyPqc: pubKeyPqcBase64,
      kyberPublicKey: kyberPublicKeyBase64
    });
    assert(dupRes.status === 409, 'Duplicate username registration blocked with 409 Conflict');

    // 5. Register User B
    const regBRes = await request({
      url: `${API_BASE}/api/auth/register`,
      method: 'POST',
    }, {
      username: userB_name,
      password: 'StrongPassword123!',
      publicKeyPqc: pubKeyPqcBase64,
      kyberPublicKey: kyberPublicKeyBase64
    });
    assert(regBRes.status === 201, 'User B registered successfully');

    const userA_id = regARes.data?.user?.id;
    const userB_id = regBRes.data?.user?.id;

    // ----------------------------------------------------
    // Phase 3: Login Tests
    // ----------------------------------------------------
    console.log('\n--- Phase 3: Login Validations ---');
    // 1. Wrong password login
    const wrongPassRes = await request({
      url: `${API_BASE}/api/auth/login`,
      method: 'POST',
    }, {
      username: userA_name,
      password: 'WrongPassword'
    });
    assert(wrongPassRes.status === 401, 'Login with wrong password rejected with 401');

    // 2. Successful Login User A
    const loginARes = await request({
      url: `${API_BASE}/api/auth/login`,
      method: 'POST',
    }, {
      username: userA_name,
      password: 'StrongPassword123!'
    });
    assert(loginARes.status === 200, 'User A logged in successfully');
    const tokenA = loginARes.data?.token;

    // 3. Successful Login User B
    const loginBRes = await request({
      url: `${API_BASE}/api/auth/login`,
      method: 'POST',
    }, {
      username: userB_name,
      password: 'StrongPassword123!'
    });
    assert(loginBRes.status === 200, 'User B logged in successfully');
    const tokenB = loginBRes.data?.token;

    // 4. Retrieve Profile Info
    const meRes = await request({
      url: `${API_BASE}/api/auth/me`,
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(meRes.status === 200 && meRes.data?.user?.username === userA_name, 'Profile loaded correctly for logged-in user');

    // ----------------------------------------------------
    // Phase 5 & 6: File Upload & Download Operations
    // ----------------------------------------------------
    console.log('\n--- Phase 5 & 6: File Upload & Download Validations ---');
    // 1. Upload session generation
    const uploadReq = await request({
      url: `${API_BASE}/api/files/upload-url`,
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    }, {
      filename: 'e2e_secure_report.txt.enc',
      originalFilename: 'e2e_secure_report.txt',
      sizeBytes: 1024,
      totalChunks: 1
    });
    assert(uploadReq.status === 200, 'Upload session URL created successfully');
    if (uploadReq.status !== 200) {
      console.log('Upload URL generation failed:', uploadReq.data);
    }
    const fileId = uploadReq.data?.fileId;

    // Generate valid wrapped key container matching version 2 validation
    const mockWrappedKeyObj = {
      version: 2,
      kem: 'ML-KEM-768',
      wrapCipher: 'Ascon-128a',
      nonce: Buffer.alloc(16).toString('base64'),
      kemCiphertext: Buffer.alloc(1088).toString('base64'),
      encryptedFileKey: Buffer.alloc(48).toString('base64')
    };
    const mockWrappedKeyBase64 = Buffer.from(JSON.stringify(mockWrappedKeyObj)).toString('base64');
    const mockNonce24 = Buffer.alloc(24).toString('base64');

    // 2. Save metadata
    if (fileId) {
      const metaRes = await request({
        url: `${API_BASE}/api/files/metadata`,
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` }
      }, {
        fileId,
        filename: 'e2e_secure_report.txt.enc',
        totalChunks: 1,
        sizeBytes: 1024,
        wrappedKey: mockWrappedKeyBase64,
        nonce: mockNonce24,
        algorithm: 'FS-MLWE-SC-256',
        status: 'uploaded'
      });
      assert(metaRes.status === 200, 'File metadata updated/saved successfully');
      if (metaRes.status !== 200) {
        console.log('Save metadata failed:', metaRes.data);
      }

      // 3. Save chunks
      const chunkRes = await request({
        url: `${API_BASE}/api/files/${fileId}/chunks`,
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` }
      }, {
        chunks: [{
          chunkIndex: 0,
          minioPath: `vault/${fileId}.part0`,
          chunkHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          chunkSize: 1024
        }]
      });
      assert(chunkRes.status === 200, 'File chunks metadata saved successfully');
      if (chunkRes.status !== 200) {
        console.log('Save chunks failed:', chunkRes.data);
      }

      // 4. Download session generation
      const dlRes = await request({
        url: `${API_BASE}/api/files/download-url`,
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` }
      }, {
        fileId
      });
      assert(dlRes.status === 200, 'Download session URL generated successfully');
      assert(dlRes.data?.chunks?.length === 1, 'Download response contains correct chunk count');
      assert(dlRes.data?.file?.wrappedKey === mockWrappedKeyBase64, 'Download returns correct wrapped key for User A');

      // ----------------------------------------------------
      // Phase 7: File Sharing & Permissions Matrix Validation
      // ----------------------------------------------------
      console.log('\n--- Phase 7: Sharing & Permissions Matrix ---');
      // 1. Sharing with other user
      const shareRes = await request({
        url: `${API_BASE}/api/shares`,
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` }
      }, {
        fileId,
        recipientId: userB_id,
        permission: 'read',
        recipientWrappedKey: mockWrappedKeyBase64
      });
      assert(shareRes.status === 201, 'File shared with User B successfully');

      // 2. Share with self block
      const shareSelfRes = await request({
        url: `${API_BASE}/api/shares`,
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` }
      }, {
        fileId,
        recipientId: userA_id,
        permission: 'read',
        recipientWrappedKey: mockWrappedKeyBase64
      });
      assert(shareSelfRes.status === 400, 'Sharing file with oneself correctly blocked with 400');

      // 3. User B retrieves list of files shared with them
      const sharedWithMeRes = await request({
        url: `${API_BASE}/api/shares/shared-with-me`,
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      assert(sharedWithMeRes.status === 200, 'User B retrieved files shared with them');
      assert(sharedWithMeRes.data?.shares?.some(s => s.fileId === fileId), 'User A file is in User B shared list');

      // 4. User B attempts write action on read-only file (Expected Block: 403)
      const blockWriteRes = await request({
        url: `${API_BASE}/api/files/upload-url`,
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` }
      }, {
        fileId,
        filename: 'e2e_secure_report.txt.enc',
        sizeBytes: 1024,
        totalChunks: 1
      });
      assert(blockWriteRes.status === 403, 'User B write attempt on read-only share blocked with 403');

      // 5. User B attempts file delete (Expected Block: 403 - Only owner can delete)
      const blockDeleteRes = await request({
        url: `${API_BASE}/api/files/${fileId}`,
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      assert(blockDeleteRes.status === 403, 'User B delete attempt on shared file blocked with 403');

      // 6. User A upgrades permission to 'write'
      const upgradeShareRes = await request({
        url: `${API_BASE}/api/shares`,
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` }
      }, {
        fileId,
        recipientId: userB_id,
        permission: 'write',
        recipientWrappedKey: mockWrappedKeyBase64
      });
      assert(upgradeShareRes.status === 201, 'File share permission upgraded to write successfully');

      // 7. User B attempts write/upload on file now (Expected Success: 200)
      const allowWriteRes = await request({
        url: `${API_BASE}/api/files/upload-url`,
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` }
      }, {
        fileId,
        filename: 'e2e_secure_report.txt.enc',
        sizeBytes: 2048,
        totalChunks: 1
      });
      assert(allowWriteRes.status === 200, 'User B write/upload on write-enabled share allowed');

      // ----------------------------------------------------
      // Phase 8: File Deletion Tests
      // ----------------------------------------------------
      console.log('\n--- Phase 8: Deletion Validations ---');
      // 1. Soft delete
      const deleteRes = await request({
        url: `${API_BASE}/api/files/${fileId}`,
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      assert(deleteRes.status === 200 && deleteRes.data?.status === 'deleted', 'File soft deleted successfully by owner');
    }

    // ----------------------------------------------------
    // Phase 11 & 12: Admin Functions & Privilege Escalation Checks
    // ----------------------------------------------------
    console.log('\n--- Phase 11 & 12: Admin & Privilege Escalation ---');
    // 1. Escalation check: Standard user accesses admin stats
    const escStatsRes = await request({
      url: `${API_BASE}/api/admin/stats`,
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(escStatsRes.status === 403, 'Privilege escalation attempt by normal user blocked with 403');

    // 2. Administrative login
    const adminLoginRes = await request({
      url: `${API_BASE}/api/admin/auth/login`,
      method: 'POST',
    }, {
      username: 'admin',
      password: 'Admin@!'
    });
    assert(adminLoginRes.status === 200, 'Admin credentials authenticate successfully');
    const adminToken = adminLoginRes.data?.token;

    if (adminToken) {
      // 3. Admin access stats
      const adminStatsRes = await request({
        url: `${API_BASE}/api/admin/stats`,
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(adminStatsRes.status === 200 && !!adminStatsRes.data?.stats, 'Admin retrieves system stats dashboard successfully');

      // 4. Admin updates storage quota for User A
      const quotaRes = await request({
        url: `${API_BASE}/api/admin/users/${userA_id}/quota`,
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` }
      }, {
        quotaMb: 1024
      });
      assert(quotaRes.status === 200 && quotaRes.data?.user?.storageQuotaMb === 1024, 'Admin successfully changes User A storage quota');

      // 5. Admin deactivates User A
      const deactRes = await request({
        url: `${API_BASE}/api/admin/users/${userA_id}/status`,
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` }
      }, {
        status: 'disabled'
      });
      assert(deactRes.status === 200 && deactRes.data?.user?.status === 'disabled', 'Admin successfully deactivates User A account');

      // 6. User A login fails (Expected Block: 403)
      const blockLoginRes = await request({
        url: `${API_BASE}/api/auth/login`,
        method: 'POST',
      }, {
        username: userA_name,
        password: 'StrongPassword123!'
      });
      assert(blockLoginRes.status === 403, 'Disabled/Deactivated User A blocked from logging in with 403');

      // Clean up: restore user A for deletion
      await request({
        url: `${API_BASE}/api/admin/users/${userA_id}/status`,
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` }
      }, {
        status: 'active'
      });
    }

    // ----------------------------------------------------
    // Phase 12 & 16: Additional Security Checks (JWT validation, XSS/SQLi checks)
    // ----------------------------------------------------
    console.log('\n--- Phase 12 & 16: Security Validation ---');
    // 1. Request with tampered JWT
    const tamperedRes = await request({
      url: `${API_BASE}/api/auth/me`,
      headers: { Authorization: `Bearer ${tokenA}tampered` }
    });
    assert(tamperedRes.status === 401, 'Request with tampered JWT rejected with 401');

    // 2. Request with missing token header
    const missingTokenRes = await request({
      url: `${API_BASE}/api/auth/me`,
    });
    assert(missingTokenRes.status === 401, 'Request with missing JWT header rejected with 401');

    // 3. Check for Security Headers
    assert(rootRes.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options is nosniff');
    assert(rootRes.headers['x-frame-options'] === 'DENY', 'X-Frame-Options is DENY');
    assert(rootRes.headers['referrer-policy'] === 'no-referrer', 'Referrer-Policy is no-referrer');
    assert(rootRes.headers['strict-transport-security'].includes('max-age=31536000'), 'HSTS header configured');

    console.log(`\n🎉 E2E TEST RUN COMPLETED. Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ E2E Execution crashed with error:', err.message);
    process.exit(1);
  }
}

runTests();
