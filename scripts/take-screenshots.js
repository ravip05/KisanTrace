/**
 * take-screenshots.js
 * Uses Playwright to capture screenshots of all Kisan-Trace screens
 * for the README documentation.
 *
 * Usage: node take-screenshots.js
 * Requires the Vite dev server to be running on http://localhost:5173
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:5173';
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

// Mobile viewport that matches target audience device (5.5" Android, ~393px wide)
const VIEWPORT = { width: 393, height: 851 };

// ── Ensure output directory ───────────────────────────────────────────────────
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function takeScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,         // Retina-quality screenshots for README
    colorScheme: 'dark',
    locale: 'en-IN',
    userAgent:
      'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
  });

  const page = await context.newPage();

  // ── Helper: wait for React to hydrate & animations to settle ──────────────
  async function waitForApp() {
    await page.waitForSelector('.app-shell', { timeout: 10000 });
    await page.waitForTimeout(800); // Let CSS transitions finish
  }

  // ── Helper: save screenshot ───────────────────────────────────────────────
  async function shoot(filename, description) {
    const filepath = path.join(OUTPUT_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: false });
    console.log(`✅ Captured: ${filename} — ${description}`);
    return filepath;
  }

  try {
    console.log(`\n📸 Starting Kisan-Trace screenshot session...\n`);

    // ── 1. Home Screen ────────────────────────────────────────────────────────
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await waitForApp();
    await shoot('01-home-screen.png', 'Home / Crop Selector screen');

    // ── 2. Select a crop (click Paddy) ────────────────────────────────────────
    // Try clicking the Paddy crop card
    const paddyCard = page.locator('[data-crop="paddy"], .crop-card').first();
    if (await paddyCard.count() > 0) {
      await paddyCard.click();
      await page.waitForTimeout(500);
      await shoot('02-home-crop-selected.png', 'Home screen with crop selected');
    } else {
      // Fallback: click the first crop card available
      const firstCard = page.locator('.home-screen__crop-card, .crop-card, button').first();
      if (await firstCard.count() > 0) {
        await firstCard.click();
        await page.waitForTimeout(500);
      }
      await shoot('02-home-crop-selected.png', 'Home screen with crop selected (fallback)');
    }

    // ── 3. Offline status indicator (disconnect network) ─────────────────────
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await waitForApp();
    // Emulate offline
    await context.setOffline(true);
    await page.waitForTimeout(1000);
    await shoot('03-offline-mode.png', 'App in offline mode (connectivity badge)');
    await context.setOffline(false);

    // ── 4. Scanner screen ─────────────────────────────────────────────────────
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await waitForApp();

    // Set crop in localStorage so scanner nav becomes active
    await page.evaluate(() => {
      localStorage.setItem('kt_selectedCrop', 'paddy');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await waitForApp();

    // Click the Scan button in the bottom nav
    const scanBtn = page.locator('#bottom-nav button').nth(1);
    if (await scanBtn.count() > 0) {
      await scanBtn.click();
      await page.waitForTimeout(1500); // Wait for scanner screen to mount + model warm-up state
    }
    await shoot('04-scanner-screen.png', 'Scanner / Camera screen');

    // ── 5. History screen ─────────────────────────────────────────────────────
    // Navigate to history tab
    const historyBtn = page.locator('[aria-label="History"]');
    if (await historyBtn.count() > 0) {
      await historyBtn.click();
      await page.waitForTimeout(800);
    }
    await shoot('05-history-screen.png', 'Scan History screen');

    // ── 6. Full desktop / landscape view for README banner ───────────────────
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await waitForApp();
    await page.waitForTimeout(600);
    await shoot('06-desktop-overview.png', 'Desktop / landscape overview');

    console.log(`\n🎉 All screenshots saved to: ${OUTPUT_DIR}\n`);

  } catch (err) {
    console.error('\n❌ Screenshot failed:', err.message);
    // Don't crash — take a "best effort" screenshot of whatever is on screen
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'error-state.png') }).catch(() => {});
  } finally {
    await browser.close();
  }
}

takeScreenshots();
