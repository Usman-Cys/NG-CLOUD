require('dotenv').config();
const { Client } = require('pg');
const jwt = require('jsonwebtoken');

const dbClient = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function runTest() {
  console.log('🏁 Starting Quota & Policy Verification Tests...');
  await dbClient.connect();

  // Find a normal user
  const userRes = await dbClient.query("SELECT id, username FROM users WHERE role = 'user' AND (status != 'deleted' OR status IS NULL) LIMIT 1");
  if (userRes.rows.length === 0) {
    console.error('❌ No normal user found for testing.');
    await dbClient.end();
    return;
  }

  const testUser = userRes.rows[0];
  console.log(`👤 Using user for testing: ${testUser.username} (${testUser.id})`);

  // Generate a valid JWT token
  const token = jwt.sign({ id: testUser.id, username: testUser.username, role: 'user' }, process.env.JWT_SECRET);
  const authHeader = `Bearer ${token}`;

  const serverUrl = `http://localhost:${process.env.PORT || 5000}`;

  // Helper to make request
  const fetch = require('http');
  const makeRequest = (path, method = 'GET', body = null) => {
    return new Promise((resolve, reject) => {
      const url = new URL(path, serverUrl);
      const req = fetch.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          let json = {};
          try {
            json = JSON.parse(data);
          } catch(e) {
            json = { raw: data };
          }
          resolve({ status: res.statusCode, data: json });
        });
      });
      req.on('error', reject);
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  };

  // 1. Fetch Policy endpoint
  console.log('\nTesting GET /api/policy/upload ...');
  const policyRes = await makeRequest('/api/policy/upload');
  console.log(`Response status: ${policyRes.status}`);
  console.log('Response body:', JSON.stringify(policyRes.data, null, 2));
  
  if (policyRes.status === 200 && policyRes.data.maxFileSizeBytes && policyRes.data.userQuota) {
    console.log('✓ Policy endpoint returns expected schema.');
  } else {
    console.error('❌ Policy endpoint test failed.');
  }

  // 2. Validate max file size (>100MB)
  console.log('\nTesting file size rejection (>100MB) ...');
  const largeFileRes = await makeRequest('/api/files/upload-url', 'POST', {
    filename: 'bigfile.zip.enc',
    originalFilename: 'bigfile.zip',
    size: 101 * 1024 * 1024, // 101 MB
    totalChunks: 26
  });
  console.log(`Response status: ${largeFileRes.status}`);
  console.log('Response body:', largeFileRes.data);
  if (largeFileRes.status === 413 && largeFileRes.data.error.includes('File is too large')) {
    console.log('✓ Backend successfully rejected file exceeding 100 MB with 413.');
  } else {
    console.error('❌ Max file size validation failed.');
  }

  // 3. Validate extension restriction
  console.log('\nTesting illegal extension rejection ...');
  const badExtRes = await makeRequest('/api/files/upload-url', 'POST', {
    filename: 'malicious.exe.enc',
    originalFilename: 'malicious.exe',
    size: 1024 * 1024,
    totalChunks: 1
  });
  console.log(`Response status: ${badExtRes.status}`);
  console.log('Response body:', badExtRes.data);
  if (badExtRes.status === 400 && badExtRes.data.error.includes('extension is not allowed')) {
    console.log('✓ Backend successfully rejected invalid file extension with 400.');
  } else {
    console.error('❌ Extension validation failed.');
  }

  // 4. Validate invalid filename
  console.log('\nTesting path traversal filename rejection ...');
  const badFilenameRes = await makeRequest('/api/files/upload-url', 'POST', {
    filename: '../../hacked.zip.enc',
    originalFilename: '../../hacked.zip',
    size: 1024 * 1024,
    totalChunks: 1
  });
  console.log(`Response status: ${badFilenameRes.status}`);
  console.log('Response body:', badFilenameRes.data);
  if (badFilenameRes.status === 400 && badFilenameRes.data.error.includes('filename')) {
    console.log('✓ Backend successfully rejected invalid filename with 400.');
  } else {
    console.error('❌ Filename validation failed.');
  }

  // 5. Validate storage quota limit
  console.log('\nTesting storage quota limit enforcement ...');
  // Query user's current quota and remaining space
  const currentQuota = policyRes.data.userQuota.quota;
  const currentUsed = policyRes.data.userQuota.used;
  const remaining = currentQuota - currentUsed;
  
  // Attempt to request url for a size slightly larger than remaining space
  const oversizeBytes = remaining + 1024 * 1024; // remaining + 1MB
  
  if (oversizeBytes > 100 * 1024 * 1024) {
    console.log(`Skipping overshoot check because remaining space + 1MB (${(oversizeBytes / (1024 * 1024)).toFixed(1)} MB) exceeds single file size limit (100MB).`);
  }

  if (remaining < 100 * 1024 * 1024) {
    const quotaExceedRes = await makeRequest('/api/files/upload-url', 'POST', {
      filename: 'test_quota_exceed.pdf.enc',
      originalFilename: 'test_quota_exceed.pdf',
      size: remaining + 1024 * 1024, // exceeds remaining by 1MB
      totalChunks: 1
    });
    console.log(`Response status: ${quotaExceedRes.status}`);
    console.log('Response body:', quotaExceedRes.data);
    if (quotaExceedRes.status === 413 && quotaExceedRes.data.error.includes('quota exceeded')) {
      console.log('✓ Backend successfully rejected quota overflow with 413.');
    } else {
      console.error('❌ Storage quota validation failed.');
    }
  } else {
    console.log(`Remaining space is too large (${(remaining / (1024 * 1024)).toFixed(1)} MB) to overshoot within single file limits. Let's temporarily drop user's quota in database to test quota overflow!`);
    await dbClient.query('UPDATE users SET storage_quota_bytes = $1 WHERE id = $2', [currentUsed + 10 * 1024 * 1024, testUser.id]); // Set quota to used + 10MB
    try {
      const quotaExceedRes = await makeRequest('/api/files/upload-url', 'POST', {
        filename: 'test_quota_exceed.pdf.enc',
        originalFilename: 'test_quota_exceed.pdf',
        size: 11 * 1024 * 1024, // 11 MB, exceeds remaining 10 MB limit
        totalChunks: 3
      });
      console.log(`Response status: ${quotaExceedRes.status}`);
      console.log('Response body:', quotaExceedRes.data);
      if (quotaExceedRes.status === 413 && quotaExceedRes.data.error.includes('quota exceeded')) {
        console.log('✓ Backend successfully rejected quota overflow with 413.');
      } else {
        console.error('❌ Storage quota validation failed.');
      }
    } finally {
      // Restore quota back
      await dbClient.query('UPDATE users SET storage_quota_bytes = $1 WHERE id = $2', [currentQuota, testUser.id]);
      console.log('Quota restored.');
    }
  }

  await dbClient.end();
  console.log('\n🏁 Tests Finished.');
}

runTest().catch(console.error);
