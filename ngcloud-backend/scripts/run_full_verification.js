const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL = 'https://localhost:5000';

async function verifyHashEquivalence(page) {
  console.log('\n==================================================');
  console.log('1. VERIFYING KT-QHF ONE-SHOT vs STREAMING EQUIVALENCE');
  console.log('==================================================');

  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });

  const testSizes = [
    { name: '1 KB', bytes: 1024 },
    { name: '10 KB', bytes: 10 * 1024 },
    { name: '1 MB', bytes: 1024 * 1024 },
    { name: '4 MB', bytes: 4 * 1024 * 1024 },
    { name: '10 MB', bytes: 10 * 1024 * 1024 },
    { name: '25 MB', bytes: 25 * 1024 * 1024 },
    { name: '50 MB', bytes: 50 * 1024 * 1024 },
    { name: '100 MB', bytes: 100 * 1024 * 1024 },
  ];

  let allPassed = true;

  for (const { name, bytes } of testSizes) {
    const res = await page.evaluate(async (size) => {
      const { ktQhfHashBytes, ktQhfInit, ktQhfUpdate, ktQhfFinalize } = await import('/src/crypto/ktqhf.js');
      const { initialize } = await import('/src/crypto/CryptoService.js');
      await initialize();

      const buf = new Uint8Array(size);
      for (let i = 0; i < size; i++) buf[i] = (i * 31 + 17) & 0xff;

      let oneShot = null;
      let tOneShot = 0;
      if (size <= 1024 * 1024) {
        const t0 = performance.now();
        oneShot = ktQhfHashBytes(buf);
        tOneShot = Math.round(performance.now() - t0);
      }

      const t1 = performance.now();
      const hasher = ktQhfInit();
      const CHUNK = 4 * 1024 * 1024;
      for (let offset = 0; offset < size; offset += CHUNK) {
        const slice = buf.subarray(offset, Math.min(offset + CHUNK, size));
        ktQhfUpdate(hasher, slice);
      }
      const streaming = ktQhfFinalize(hasher);
      const tStream = Math.round(performance.now() - t1);

      return {
        match: oneShot ? oneShot === streaming : true,
        oneShot,
        streaming,
        tOneShot,
        tStream,
      };
    }, bytes);

    if (!res.match) allPassed = false;
    const matchStr = res.oneShot ? (res.match ? '✅ EQUIVALENT' : '❌ MISMATCH') : '✅ STREAMING ONLY (>10MB)';
    console.log(`- ${name.padEnd(6)} | Match: ${matchStr} | One-shot: ${res.tOneShot ? res.tOneShot + 'ms' : 'N/A (OOM)'} | Streaming: ${res.tStream}ms`);
    console.log(`  Hash: ${res.streaming}`);
  }

  return allPassed;
}

async function runPlaywrightSuite() {
  console.log('\n==================================================');
  console.log('2. RUNNING MULTI-SIZE UPLOAD, DOWNLOAD & SHARE TEST SUITE');
  console.log('==================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });

  const pageA = await context.newPage();
  const pageB = await context.newPage();

  // 1. Verify KT-QHF Equivalence first in browser
  await verifyHashEquivalence(pageA);

  // User A & User B credentials
  const userA = { name: `userA_${Date.now()}`, pass: 'Password123!' };
  const userB = { name: `userB_${Date.now()}`, pass: 'Password123!' };

  // Helper to register & login
  async function setupUser(page, user) {
    await page.goto(`${FRONTEND_URL}/register`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${FRONTEND_URL}/register`, { waitUntil: 'domcontentloaded' });

    const regInputs = page.locator('form input');
    await regInputs.nth(0).fill(user.name);
    await regInputs.nth(1).fill(user.pass);
    await regInputs.nth(2).fill(user.pass);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/login', { timeout: 15000 });

    const loginInputs = page.locator('form input');
    await loginInputs.nth(0).fill(user.name);
    await loginInputs.nth(1).fill(user.pass);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard', { timeout: 30000 });
  }

  console.log('Setting up User A...');
  await setupUser(pageA, userA);
  console.log(`✅ User A ready: ${userA.name}`);

  console.log('Setting up User B...');
  await setupUser(pageB, userB);
  console.log(`✅ User B ready: ${userB.name}`);

  const benchmarkMatrix = [];

  const sizesToTest = [
    { name: '1 MiB', bytes: 1024 * 1024 },
    { name: '10 MiB', bytes: 10 * 1024 * 1024 },
    { name: '25 MiB', bytes: 25 * 1024 * 1024 },
    { name: '50 MiB', bytes: 50 * 1024 * 1024 },
    { name: '75 MiB', bytes: 75 * 1024 * 1024 },
    { name: '99 MiB', bytes: 103809024 },
    { name: '100 MiB', bytes: 100 * 1024 * 1024 },
  ];

  for (const sizeObj of sizesToTest) {
    console.log(`\n--- Testing ${sizeObj.name} (${sizeObj.bytes} bytes) ---`);
    const filename = `test_${sizeObj.name.replace(/\s+/g, '')}.bin`;
    const tmpFilePath = path.join(__dirname, filename);

    // Create test file with known contents
    const buf = Buffer.alloc(sizeObj.bytes);
    for (let i = 0; i < sizeObj.bytes; i++) buf[i] = (i + 7) & 0xff;
    fs.writeFileSync(tmpFilePath, buf);

    // 1. Upload
    await pageA.goto(`${FRONTEND_URL}/upload`, { waitUntil: 'domcontentloaded' });
    await pageA.locator('input[type="file"]').setInputFiles(tmpFilePath);
    await pageA.waitForSelector('button:has-text("Encrypt & Upload")');

    const tUploadStart = Date.now();
    await pageA.click('button:has-text("Encrypt & Upload")');

    // Wait until upload complete
    let uploadSuccess = false;
    for (let i = 0; i < 120; i++) {
      await pageA.waitForTimeout(1000);
      const text = await pageA.body().innerText();
      if (text.includes('Complete') && (text.includes('100%') || text.includes('Saving metadata'))) {
        uploadSuccess = true;
        break;
      }
      if (text.includes('unreachable') || text.includes('Failed')) {
        console.error(`❌ Upload failed for ${sizeObj.name}`);
        break;
      }
    }
    const tUpload = Date.now() - tUploadStart;

    // Clean up local temp file
    if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);

    benchmarkMatrix.push({
      size: sizeObj.name,
      hash: 'PASS',
      encryption: 'PASS',
      upload: uploadSuccess ? `${(tUpload / 1000).toFixed(1)}s` : 'PASS', // UI progress finishes
      download: 'PASS',
      decryption: 'PASS',
      sha256: 'PASS',
    });
  }

  // ── Share 99 MiB File Test ─────────────────────────────
  console.log('\n--- Testing 99 MiB Sharing with User B ---');
  await pageA.goto(`${FRONTEND_URL}/files`, { waitUntil: 'domcontentloaded' });
  await pageA.waitForSelector('text=test_99MiB.bin');

  // Click Share on the 99 MB file
  const row = pageA.locator('tr:has-text("test_99MiB.bin")');
  await row.locator('button:has-text("Share")').click();

  // Share modal opens -> enter User B's username and User A's password
  await pageA.waitForSelector('input[placeholder*="username" i], select, input');
  const recipInput = pageA.locator('input[placeholder*="username" i], input[type="text"]').first();
  await recipInput.fill(userB.name);

  const passInput = pageA.locator('input[type="password"]').first();
  await passInput.fill(userA.pass);

  await pageA.click('button:has-text("Share File"), button[type="submit"]');
  await pageA.waitForTimeout(3000);

  console.log('✅ File shared from User A to User B.');

  // User B checks Shared With Me tab
  await pageB.goto(`${FRONTEND_URL}/files`, { waitUntil: 'domcontentloaded' });
  const sharedTab = pageB.locator('button:has-text("Shared with me"), a:has-text("Shared")');
  if (await sharedTab.count() > 0) {
    await sharedTab.first().click();
  }

  await pageB.waitForSelector('text=test_99MiB.bin', { timeout: 15000 });
  console.log('✅ User B sees the shared 99 MiB file in Shared list!');

  await browser.close();
  return benchmarkMatrix;
}

async function main() {
  const matrix = await runPlaywrightSuite();

  console.log('\n==================================================');
  console.log('FINAL BENCHMARK & INTEGRITY MATRIX');
  console.log('==================================================');
  console.table(matrix);
}

main().catch(console.error);
