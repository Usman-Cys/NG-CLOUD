const { chromium } = require('playwright');
const fs = require('fs');

const FRONTEND_URL = 'http://localhost:5173';
const TEST_FILE = 'a:\\ngcloud full app\\ngcloud_99MB_test.txt';

async function main() {
  console.log('🚀 Starting Playwright 99 MiB Upload Test...');

  if (!fs.existsSync(TEST_FILE)) {
    console.error(`❌ Test file not found: ${TEST_FILE}`);
    process.exit(1);
  }

  const stats = fs.statSync(TEST_FILE);
  console.log(`📄 Test file size: ${(stats.size / 1024 / 1024).toFixed(2)} MiB (${stats.size} bytes)`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  // ── Console & error listeners ──────────────────────────────
  page.on('console', msg => {
    const type = msg.type().toUpperCase();
    if (type === 'ERROR' || type === 'WARNING' || msg.text().includes('[NGCloud]') || msg.text().includes('Kyber')) {
      console.log(`[BROWSER ${type}] ${msg.text()}`);
    }
  });
  page.on('pageerror', err => console.error(`[PAGE CRASH] ${err}`));

  // ── Network listeners ──────────────────────────────────────
  const netLog = [];
  page.on('request', req => {
    const url = req.url();
    if (url.includes('/api/') || url.includes(':9003')) {
      const entry = { t: Date.now(), method: req.method(), url, status: null, failed: false };
      netLog.push(entry);
      console.log(`[→ REQ] ${req.method()} ${url}`);
    }
  });
  page.on('response', res => {
    const url = res.url();
    if (url.includes('/api/') || url.includes(':9003')) {
      const entry = netLog.find(e => e.url === url && e.status === null);
      if (entry) { entry.status = res.status(); entry.duration = Date.now() - entry.t; }
      console.log(`[← RES ${res.status()}] ${url} (${Date.now() - (netLog.find(e=>e.url===url)?.t||Date.now())}ms)`);
    }
  });
  page.on('requestfailed', req => {
    const url = req.url();
    const entry = netLog.find(e => e.url === url && !e.failed);
    if (entry) { entry.failed = true; entry.error = req.failure().errorText; }
    console.log(`[✗ FAIL] ${req.method()} ${url} — ${req.failure().errorText}`);
  });

  try {
    // ── Registration ──────────────────────────────────────────
    const username = `test99mb_${Date.now()}`;
    const password = 'Password123!';
    console.log(`\n1️⃣  Registering user: ${username}`);
    await page.goto(`${FRONTEND_URL}/register`, { waitUntil: 'networkidle' });

    // Fill register form: inputs are nth(0)=username, nth(1)=password, nth(2)=confirm
    const inputs = page.locator('form input');
    await inputs.nth(0).fill(username);
    await inputs.nth(1).fill(password);
    await inputs.nth(2).fill(password);
    await page.locator('button[type="submit"]').click();

    // After register, app navigates to /login
    await page.waitForURL('**/login', { timeout: 15000 });
    console.log('✅ Registered. Now at login page.');

    // ── Login ────────────────────────────────────────────────
    console.log('2️⃣  Logging in...');
    const loginInputs = page.locator('form input');
    await loginInputs.nth(0).fill(username);
    await loginInputs.nth(1).fill(password);
    await page.locator('button[type="submit"]').click();

    // Wait for Kyber key setup and dashboard
    console.log('   Waiting for Kyber key generation & dashboard...');
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    console.log('✅ Logged in & Kyber keys generated.');

    // ── Navigate to Upload ────────────────────────────────────
    console.log('\n3️⃣  Navigating to /upload...');
    await page.goto(`${FRONTEND_URL}/upload`, { waitUntil: 'networkidle' });

    // ── Set file ──────────────────────────────────────────────
    console.log('4️⃣  Setting file input...');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_FILE);

    // Wait for button to become enabled
    await page.waitForSelector('button:has-text("Encrypt & Upload")');
    console.log('✅ File selected. Upload button is ready.');

    // ── Start Upload ──────────────────────────────────────────
    const uploadStart = Date.now();
    console.log('\n5️⃣  Clicking "Encrypt & Upload"...');
    await page.click('button:has-text("Encrypt & Upload")');

    // ── Monitor Stages ────────────────────────────────────────
    console.log('📊 Monitoring stages every 2 seconds for up to 3 minutes...\n');
    let lastStage = '';
    let stageStart = Date.now();

    for (let i = 0; i < 90; i++) {
      await page.waitForTimeout(2000);
      const elapsed = Math.floor((Date.now() - uploadStart) / 1000);

      const state = await page.evaluate(() => {
        // Active pipeline step (border-cyan-500 or similar highlighted class)
        const lis = Array.from(document.querySelectorAll('li'));
        const active = lis.find(li =>
          li.className && (
            li.className.includes('cyan') ||
            li.className.includes('active') ||
            li.className.includes('border-l-2')
          )
        );
        const activeText = active ? active.textContent.trim().replace(/\s+/g, ' ') : 'Unknown/none';

        // Progress bar value
        const progressSpan = document.querySelector('[role="progressbar"], meter, progress');
        const progressValue = progressSpan
          ? (progressSpan.value || progressSpan.getAttribute('aria-valuenow') || '?')
          : null;

        // Visible text progress percentage from UI
        const allText = document.body.innerText;
        const pctMatch = allText.match(/(\d+)\s*%/);
        const pctText = pctMatch ? pctMatch[0] : null;

        // Check for error/unreachable keywords
        const lowerText = allText.toLowerCase();
        const hasError = lowerText.includes('unreachable') ||
          lowerText.includes('failed') ||
          lowerText.includes('error') ||
          lowerText.includes('crash');

        // Check for "Complete" or "Done" only when active step is Complete
        const isDone = activeText.toLowerCase().includes('complete') || activeText.toLowerCase().includes('done');

        return { activeText, progressValue, pctText, hasError, isDone, lowerText: allText.slice(0, 500) };
      });

      if (state.activeText !== lastStage) {
        const stageDuration = Math.floor((Date.now() - stageStart) / 1000);
        if (lastStage) {
          console.log(`   Stage "${lastStage}" took ${stageDuration}s`);
        }
        lastStage = state.activeText;
        stageStart = Date.now();
        console.log(`\n🔄 [+${elapsed}s] NEW STAGE → "${state.activeText}"`);
      } else {
        console.log(`   [+${elapsed}s] Stage: "${state.activeText}" | Progress: ${state.pctText || state.progressValue || 'N/A'}`);
      }

      if (state.hasError) {
        console.log(`\n❌ ERROR DETECTED at +${elapsed}s`);
        console.log(`   UI text snippet: ${state.lowerText}`);
      }
      if (state.isDone) {
        console.log(`\n✅ UPLOAD COMPLETE at +${elapsed}s`);
        break;
      }
    }

    // Final network summary
    console.log('\n📡 NETWORK SUMMARY:');
    for (const entry of netLog) {
      const status = entry.failed ? `FAILED(${entry.error})` : `HTTP ${entry.status}`;
      const dur = entry.duration ? `${entry.duration}ms` : 'pending';
      console.log(`   ${entry.method} ${entry.url} → ${status} (${dur})`);
    }

  } catch (err) {
    console.error('\n💥 Test crashed:', err.message);
  } finally {
    await browser.close();
    console.log('\n🏁 Test finished.');
  }
}

main().catch(console.error);
