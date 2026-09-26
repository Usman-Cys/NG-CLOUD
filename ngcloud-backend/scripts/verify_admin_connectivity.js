const http = require('http');

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const mergedHeaders = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const reqOptions = {
      hostname: 'localhost',
      port: 5000,
      path: options.path,
      method: options.method || 'GET',
      headers: mergedHeaders,
    };

    const req = http.request(reqOptions, (res) => {
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
  console.log('🚀 Running Administrative Connectivity E2E Tests...');

  try {
    // 1. Create and Login as normal user
    console.log('\n--- Test User Registration & Login ---');
    const username = 'stduser_' + Date.now();
    const registerRes = await makeRequest({ path: '/api/auth/register', method: 'POST' }, {
      username,
      password: 'StandardPassword123!',
      publicKeyPqc: 'standardpqckey',
      kyberPublicKey: 'standardkyberkey',
    });
    if (registerRes.status !== 201) {
      throw new Error('Standard user registration failed');
    }

    const userLogin = await makeRequest({ path: '/api/auth/login', method: 'POST' }, {
      username,
      password: 'StandardPassword123!',
    });
    if (userLogin.status !== 200) {
      throw new Error('Standard user login failed');
    }
    const userToken = userLogin.data.token;

    // Test 1: Normal user cannot access admin stats API (Expected 403)
    console.log('\n--- Test 1: Verify Normal User is Blocked from Admin stats ---');
    const statsUserRes = await makeRequest({
      path: '/api/admin/stats',
      method: 'GET',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    console.log('User accessing admin stats status:', statsUserRes.status);
    console.log('User accessing admin stats message:', statsUserRes.data);
    if (statsUserRes.status !== 403) {
      throw new Error('Normal user was not blocked with 403 Forbidden!');
    }

    // 2. Login as admin
    console.log('\n--- Admin Login ---');
    const adminLogin = await makeRequest({ path: '/api/auth/login', method: 'POST' }, {
      username: 'admin',
      password: 'Admin123!',
    });
    console.log('Admin Login status:', adminLogin.status);
    if (adminLogin.status !== 200) {
      throw new Error('Admin login failed');
    }
    const adminToken = adminLogin.data.token;

    // Test 2: Admin can access stats
    console.log('\n--- Test 2: Verify Admin can Access Stats ---');
    const statsAdminRes = await makeRequest({
      path: '/api/admin/stats',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Admin Stats status:', statsAdminRes.status);
    console.log('Admin Stats data structure sample:', Object.keys(statsAdminRes.data));
    if (statsAdminRes.status !== 200 || !statsAdminRes.data.stats) {
      throw new Error('Admin stats call failed or returned empty payload');
    }

    // Test 3: Admin users page query
    console.log('\n--- Test 3: Verify Admin can Retrieve Users List ---');
    const usersAdminRes = await makeRequest({
      path: '/api/admin/users',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Admin Users List status:', usersAdminRes.status);
    console.log('Users count:', usersAdminRes.data.users?.length);
    const targetUser = usersAdminRes.data.users?.find(u => u.username === username);
    if (!targetUser) {
      throw new Error('Registered test user is not in users list!');
    }
    console.log('Sample User from list (verify password hash is absent):', Object.keys(targetUser));
    if (targetUser.password_hash || targetUser.passwordHash) {
      throw new Error('Security flaw: user password hash is exposed to admin dashboard!');
    }

    // Test 4: Admin files metadata list
    console.log('\n--- Test 4: Verify Admin can Retrieve Files Metadata ---');
    const filesAdminRes = await makeRequest({
      path: '/api/admin/files',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Admin Files status:', filesAdminRes.status);
    console.log('Files count:', filesAdminRes.data.files?.length);
    if (filesAdminRes.status !== 200) {
      throw new Error('Admin files list retrieval failed');
    }

    // Test 5: Storage Node details check
    console.log('\n--- Test 5: Verify Admin can Retrieve Storage Health ---');
    const storageAdminRes = await makeRequest({
      path: '/api/admin/storage',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Admin Storage status:', storageAdminRes.status);
    console.log('MinIO status:', storageAdminRes.data.storage?.minioStatus);
    console.log('Nodes count:', storageAdminRes.data.storage?.nodes?.length);
    if (storageAdminRes.status !== 200 || !storageAdminRes.data.storage?.nodes) {
      throw new Error('Admin storage info query failed');
    }

    // Test 6: Verify Admin Logs (activity_logs table)
    console.log('\n--- Test 6: Verify Logs table ---');
    const logsAdminRes = await makeRequest({
      path: '/api/admin/logs',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Admin Logs status:', logsAdminRes.status);
    console.log('Logs count:', logsAdminRes.data.logs?.length);
    const sampleLog = logsAdminRes.data.logs?.[0];
    if (sampleLog) {
      console.log('Sample Log event:', { action: sampleLog.action, username: sampleLog.username, status: sampleLog.status });
    }

    // Test 7: Verify Admin Policy settings endpoint
    console.log('\n--- Test 7: Verify Policy Endpoint ---');
    const policyAdminRes = await makeRequest({
      path: '/api/admin/policy',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Admin Policy status:', policyAdminRes.status);
    console.log('Max File size:', policyAdminRes.data.policy?.maxFileSizeMb, 'MB');
    if (policyAdminRes.status !== 200 || !policyAdminRes.data.policy) {
      throw new Error('Admin policy lookup failed');
    }

    // Test 8: Verify Admin security checklist
    console.log('\n--- Test 8: Verify Security Checklist ---');
    const securityAdminRes = await makeRequest({
      path: '/api/admin/security',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Admin Security Checklist status:', securityAdminRes.status);
    console.log('Security checks count:', securityAdminRes.data.checks?.length);
    if (securityAdminRes.status !== 200) {
      throw new Error('Admin security checks query failed');
    }

    // Test 9: Update user quota and test soft delete user
    console.log('\n--- Test 9: Verify Quota update ---');
    const quotaRes = await makeRequest({
      path: `/api/admin/users/${targetUser.id}/quota`,
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, { quotaMb: 2048 });
    console.log('Quota update status:', quotaRes.status);
    if (quotaRes.status !== 200 || quotaRes.data.user?.storageQuotaMb !== 2048) {
      throw new Error('Quota update failed');
    }

    console.log('\n--- Test 10: Verify Soft Delete User ---');
    const softDelRes = await makeRequest({
      path: `/api/admin/users/${targetUser.id}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Soft delete status:', softDelRes.status);
    console.log('Soft delete response:', softDelRes.data);
    if (softDelRes.status !== 200 || softDelRes.data.status !== 'soft_deleted') {
      throw new Error('User soft deletion failed');
    }

    // Verify soft-deleted user cannot log in (Expected 403)
    console.log('\n--- Verify login block for soft-deleted account ---');
    const blockRes = await makeRequest({ path: '/api/auth/login', method: 'POST' }, {
      username,
      password: 'StandardPassword123!',
    });
    console.log('Block login status (Expected 403):', blockRes.status);
    if (blockRes.status !== 403) {
      throw new Error('Soft-deleted user was not blocked from login!');
    }

    // Test 11: Register a new user and test hard delete user
    console.log('\n--- Test 11: Verify Hard Delete User ---');
    const husername = 'harddel_' + Date.now();
    const hregisterRes = await makeRequest({ path: '/api/auth/register', method: 'POST' }, {
      username: husername,
      password: 'StandardPassword123!',
      publicKeyPqc: 'standardpqckey',
      kyberPublicKey: 'standardkyberkey',
    });
    if (hregisterRes.status !== 201) {
      throw new Error('Hard delete test user registration failed');
    }
    const huserId = hregisterRes.data.user.id;

    const hardDelRes = await makeRequest({
      path: `/api/admin/users/${huserId}?permanent=true`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Hard delete status:', hardDelRes.status);
    console.log('Hard delete response:', hardDelRes.data);
    if (hardDelRes.status !== 200 || hardDelRes.data.status !== 'permanent_deleted') {
      throw new Error('User hard deletion failed');
    }

    // Verify hard-deleted user cannot log in (Expected 401 as account is purged)
    console.log('\n--- Verify login rejection for hard-deleted account ---');
    const hblockRes = await makeRequest({ path: '/api/auth/login', method: 'POST' }, {
      username: husername,
      password: 'StandardPassword123!',
    });
    console.log('Block login status (Expected 401):', hblockRes.status);
    if (hblockRes.status !== 401) {
      throw new Error('Hard-deleted user was not rejected with 401!');
    }

    console.log('\n✅ ALL ADMIN CONNECTIVITY MODULE 3 E2E TESTS PASSED!');
  } catch (err) {
    console.error('\n❌ Admin connectivity tests failed:', err.message);
    process.exit(1);
  }
}

runTests();
