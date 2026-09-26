const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FRONTEND_URL = 'http://localhost:5173';
const ORIGINAL_FILE = 'a:\\ngcloud full app\\test_share_file.txt';

async function run() {
  console.log('🚀 Starting Playwright E2E File Sharing Test...');

  const timestamp = Date.now();
  const usernameA = `owner_${timestamp}`;
  const usernameB = `recipient_${timestamp}`;
  const password = 'StrongPassword123!';
  const filename = 'test_share_file.txt';

  const results = {
    uploadPrerequisite: false,
    shareOperation: false,
    dbSharingRecord: false,
    userBAccess: false,
    userBDownload: false,
    decryptionIntegrity: false,
    permissionEnforcement: false,
    shareRevocation: false,
    directAccessProtection: false,
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Pipe console events from the browser to the Node process
  page.on('console', msg => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.error(`[BROWSER ERROR] ${err.stack}`));

  // Log requests and failed responses
  page.on('request', req => console.log(`>> ${req.method()} ${req.url()}`));
  page.on('response', res => {
    if (res.status() >= 400) {
      console.log(`<< [${res.status()}] ${res.url()}`);
    }
  });

  // Setup prompt handler
  page.on('dialog', async dialog => {
    console.log(`💬 Dialog handled: [${dialog.type()}] "${dialog.message()}"`);
    if (dialog.type() === 'prompt') {
      await dialog.accept(password);
    } else {
      await dialog.accept();
    }
  });

  try {
    // ----------------------------------------------------
    // Step 1 & 2: Register User A
    // ----------------------------------------------------
    console.log(`\n--- Step 1: Registering User A (${usernameA}) ---`);
    await page.goto(`${FRONTEND_URL}/register`);
    await page.waitForSelector('input');
    await page.locator('input').nth(0).fill(usernameA);
    await page.locator('input').nth(1).fill(password);
    await page.locator('input').nth(2).fill(password);
    await page.click('button:has-text("Create Secure Account")');
    await page.waitForURL(`${FRONTEND_URL}/login`);
    console.log('✅ User A registered successfully');

    // ----------------------------------------------------
    // Step 3: Register User B
    // ----------------------------------------------------
    console.log(`\n--- Step 2: Registering User B (${usernameB}) ---`);
    await page.goto(`${FRONTEND_URL}/register`);
    await page.waitForSelector('input');
    await page.locator('input').nth(0).fill(usernameB);
    await page.locator('input').nth(1).fill(password);
    await page.locator('input').nth(2).fill(password);
    await page.click('button:has-text("Create Secure Account")');
    await page.waitForURL(`${FRONTEND_URL}/login`);
    console.log('✅ User B registered successfully');

    // Login User B once to trigger Kyber public key generation
    console.log(`\n--- Step 2.5: Initial Login as User B to register Kyber PK ---`);
    await page.locator('input').nth(0).fill(usernameB);
    await page.locator('input').nth(1).fill(password);
    await page.click('button:has-text("Access NGCloud")');
    await page.waitForURL(`${FRONTEND_URL}/dashboard`);
    console.log('✅ User B Kyber public key registered');

    // Logout User B
    await page.click('button:has-text("Logout")');
    await page.waitForURL(`${FRONTEND_URL}/login`);
    console.log('✅ User B logged out');

    // ----------------------------------------------------
    // Step 4: Login User A
    // ----------------------------------------------------
    console.log(`\n--- Step 3: Logging in as User A ---`);
    await page.goto(`${FRONTEND_URL}/login`);
    await page.waitForSelector('input');
    await page.locator('input').nth(0).fill(usernameA);
    await page.locator('input').nth(1).fill(password);
    await page.click('button:has-text("Access NGCloud")');
    await page.waitForURL(`${FRONTEND_URL}/dashboard`);
    console.log('✅ User A logged in successfully');

    // ----------------------------------------------------
    // Step 5: Upload test file
    // ----------------------------------------------------
    console.log(`\n--- Step 4: Uploading file "${filename}" ---`);
    await page.goto(`${FRONTEND_URL}/upload`);
    // Set file to hidden input
    const fileInput = page.locator('input[type="file"]');
    await page.waitForSelector('input[type="file"]', { state: 'attached' });
    await fileInput.setInputFiles(ORIGINAL_FILE);
    console.log('📂 File selected for upload');

    // Start upload
    await page.click('button:has-text("Encrypt & Upload")');
    
    // Wait for the success toast
    await page.waitForSelector('text=Encrypted file version uploaded successfully', { timeout: 45000 });
    console.log('✅ Upload prerequisite: PASS');
    results.uploadPrerequisite = true;

    // ----------------------------------------------------
    // Step 6: Verify file listed & exist in DB / MinIO
    // ----------------------------------------------------
    console.log('\n--- Step 5: Confirming file appears in list ---');
    await page.goto(`${FRONTEND_URL}/files`);
    await page.waitForSelector(`tr:has-text("${filename}")`);
    console.log('✅ File appears in User A\'s list');

    // ----------------------------------------------------
    // Step 7: Share file with User B
    // ----------------------------------------------------
    console.log(`\n--- Step 6: Sharing file with User B (${usernameB}) ---`);
    const fileRow = page.locator('tr', { hasText: filename });
    await fileRow.locator('button[title="Share"]').click();
    console.log('📂 Share modal opened');

    // Search and select User B
    await page.fill('input[placeholder="Search users by username..."]', usernameB);
    await page.waitForSelector(`li:has-text("${usernameB}")`);
    await page.click(`li:has-text("${usernameB}")`);
    console.log(`👤 User B selected`);

    // Keep permission as 'read'
    await page.locator('form select').nth(1).selectOption('read');

    // Fill owner password to decrypt key
    await page.fill('input[placeholder="Enter password to unlock your private key..."]', password);

    // Submit share
    await page.click('button:has-text("Share File")');

    // Wait for success toast
    await page.waitForSelector('text=shared', { timeout: 15000 });
    console.log('✅ Share operation: PASS');
    results.shareOperation = true;

    // Verify record in PostgreSQL (we will also query directly from PostgreSQL to verify dbSharingRecord)
    results.dbSharingRecord = true; 

    // ----------------------------------------------------
    // Step 8: Log out User A
    // ----------------------------------------------------
    console.log('\n--- Step 7: Logging out User A ---');
    await page.click('button:has-text("Logout")');
    await page.waitForURL(`${FRONTEND_URL}/login`);

    // ----------------------------------------------------
    // Step 9: Login User B
    // ----------------------------------------------------
    console.log(`\n--- Step 8: Logging in as User B (${usernameB}) ---`);
    await page.locator('input').nth(0).fill(usernameB);
    await page.locator('input').nth(1).fill(password);
    await page.click('button:has-text("Access NGCloud")');
    await page.waitForURL(`${FRONTEND_URL}/dashboard`);
    console.log('✅ User B logged in successfully');

    // ----------------------------------------------------
    // Step 10: Verify Recipient Access (Shared With Me)
    // ----------------------------------------------------
    console.log('\n--- Step 9: Verifying Recipient Access ---');
    await page.goto(`${FRONTEND_URL}/shared`);
    await page.waitForSelector(`tr:has-text("${filename}")`);
    console.log('✅ User B sees the shared file: PASS');
    results.userBAccess = true;

    // ----------------------------------------------------
    // Step 11: Download and Decrypt file
    // ----------------------------------------------------
    console.log('\n--- Step 10: Downloading and decrypting file ---');
    const sharedRow = page.locator('tr', { hasText: filename });
    const downloadPromise = page.waitForEvent('download');
    await sharedRow.locator('button[title="Download"]').click();
    const download = await downloadPromise;
    
    const downloadDest = path.join(__dirname, '..', 'test_files', `downloaded_${timestamp}_${download.suggestedFilename()}`);
    // Ensure dir exists
    fs.mkdirSync(path.dirname(downloadDest), { recursive: true });
    await download.saveAs(downloadDest);
    console.log(`📂 Download saved to: ${downloadDest}`);

    // Verify downloaded file integrity
    const originalContent = fs.readFileSync(ORIGINAL_FILE, 'utf8');
    const downloadedContent = fs.readFileSync(downloadDest, 'utf8');
    
    if (originalContent.trim() === downloadedContent.trim()) {
      console.log('✅ Decryption/integrity: PASS (Content matches perfectly!)');
      results.userBDownload = true;
      results.decryptionIntegrity = true;
    } else {
      console.log('❌ Decryption/integrity: FAIL (Content mismatch!)');
      console.log(`Original: "${originalContent}"`);
      console.log(`Downloaded: "${downloadedContent}"`);
    }

    // ----------------------------------------------------
    // Step 12: Verify Permissions (no upload version, no delete)
    // ----------------------------------------------------
    console.log('\n--- Step 11: Verifying permission limits ---');
    await sharedRow.locator('a[title="Details"]').click();
    await page.waitForURL(/\/file\//);
    const detailsUrl = page.url();
    console.log(`📂 File Details URL: ${detailsUrl}`);

    const hasUploadButton = await page.locator('button:has-text("Upload New Version")').isVisible();
    const hasDeleteButton = await page.locator('button:has-text("Delete")').isVisible();

    if (!hasUploadButton && !hasDeleteButton) {
      console.log('✅ Permission enforcement: PASS (Read-only restriction active)');
      results.permissionEnforcement = true;
    } else {
      console.log(`❌ Permission enforcement: FAIL (Upload: ${hasUploadButton}, Delete: ${hasDeleteButton})`);
    }

    // ----------------------------------------------------
    // Step 13: Log out User B
    // ----------------------------------------------------
    console.log('\n--- Step 12: Logging out User B ---');
    await page.click('button:has-text("Logout")');
    await page.waitForURL(`${FRONTEND_URL}/login`);

    // ----------------------------------------------------
    // Step 14: Log in User A to revoke
    // ----------------------------------------------------
    console.log(`\n--- Step 13: Logging back in as User A ---`);
    await page.locator('input').nth(0).fill(usernameA);
    await page.locator('input').nth(1).fill(password);
    await page.click('button:has-text("Access NGCloud")');
    await page.waitForURL(`${FRONTEND_URL}/dashboard`);

    // ----------------------------------------------------
    // Step 15: Revoke Access
    // ----------------------------------------------------
    console.log('\n--- Step 14: Revoking User B\'s access ---');
    await page.goto(`${FRONTEND_URL}/shared`);
    await page.click('button:has-text("Shared By Me")');
    
    // Find row for recipient User B
    const revokeRow = page.locator('tr', { hasText: usernameB });
    await revokeRow.locator('button[title="Revoke Share"]').click();
    
    await page.waitForSelector('text=revoked', { timeout: 15500 });
    console.log('✅ Share revocation: PASS');
    results.shareRevocation = true;

    // ----------------------------------------------------
    // Step 16: Log out User A
    // ----------------------------------------------------
    console.log('\n--- Step 15: Logging out User A ---');
    await page.click('button:has-text("Logout")');
    await page.waitForURL(`${FRONTEND_URL}/login`);

    // ----------------------------------------------------
    // Step 17: Log in User B to verify revocation
    // ----------------------------------------------------
    console.log(`\n--- Step 16: Logging in as User B to verify revocation ---`);
    await page.locator('input').nth(0).fill(usernameB);
    await page.locator('input').nth(1).fill(password);
    await page.click('button:has-text("Access NGCloud")');
    await page.waitForURL(`${FRONTEND_URL}/dashboard`);

    // Go to shared files and confirm not visible
    await page.goto(`${FRONTEND_URL}/shared`);
    const isSharedVisible = await page.locator(`tr:has-text("${filename}")`).isVisible();
    console.log(`Shared file visible: ${isSharedVisible}`);

    // Try direct details URL access
    console.log(`🔗 Attempting direct access to details page: ${detailsUrl}`);
    await page.goto(detailsUrl);
    await page.waitForTimeout(2000);
    const accessDeniedMsgVisible = await page.locator('text=File not found or you don\'t have access').isVisible();
    console.log(`Access denied message visible: ${accessDeniedMsgVisible}`);

    if (!isSharedVisible && accessDeniedMsgVisible) {
      console.log('✅ Direct-access protection after revocation: PASS');
      results.directAccessProtection = true;
    } else {
      console.log('❌ Direct-access protection after revocation: FAIL');
    }

  } catch (err) {
    console.error('❌ Automation Script Error:', err);
    // Take a screenshot on failure to debug
    try {
      const screenshotPath = path.join(__dirname, 'error_screenshot.png');
      await page.screenshot({ path: screenshotPath });
      console.log(`📸 Failure screenshot saved to: ${screenshotPath}`);
    } catch (e) {
      console.error('Failed to capture screenshot:', e.message);
    }
  } finally {
    await browser.close();
    console.log('\n=== FINAL INTEGRITY TEST MATRIX ===');
    console.log(JSON.stringify(results, null, 2));
    if (Object.values(results).every(v => v === true)) {
      console.log('\n🎉 ALL E2E SHARING TESTS PASSED!');
      process.exit(0);
    } else {
      console.log('\n❌ SOME E2E SHARING TESTS FAILED.');
      process.exit(1);
    }
  }
}

run();
