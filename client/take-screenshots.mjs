/**
 * take-screenshots.mjs
 * Uses Playwright to capture screenshots of all Kisan-Trace screens
 * for the README documentation.
 *
 * Usage: node scripts/take-screenshots.mjs
 * Requires the Vite dev server to be running on http://localhost:5173
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    await page.waitForTimeout(1000);
  }

  // ── Helper: save screenshot ───────────────────────────────────────────────
  async function shoot(filename, description) {
    const filepath = path.join(OUTPUT_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: false });
    console.log(`✅ Captured: ${filename} — ${description}`);
  }

  try {
    console.log(`\n📸 Starting Kisan-Trace screenshot session...\n`);

    // ── 1. Home Screen ────────────────────────────────────────────────────────
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await waitForApp();
    await shoot('01-home-screen.png', 'Home / Crop Selector screen');

    // ── 2. Home screen with a crop selected ──────────────────────────────────
    // Set a crop via localStorage and reload
    await page.evaluate(() => {
      localStorage.setItem('kt_selectedCrop', 'paddy');
    });
    // Click first crop card
    const cropCards = page.locator('button').filter({ hasText: /paddy|tomato|groundnut/i });
    const cardCount = await cropCards.count();
    if (cardCount > 0) {
      await cropCards.first().click();
      await page.waitForTimeout(600);
    }
    await shoot('02-home-crop-selected.png', 'Home screen with Paddy selected');

    // ── 3. Offline mode indicator ─────────────────────────────────────────────
    await context.setOffline(true);
    await page.waitForTimeout(1200);
    await shoot('03-offline-mode.png', 'Offline connectivity badge active');
    await context.setOffline(false);
    await page.waitForTimeout(500);

    // ── 4. Scanner screen ─────────────────────────────────────────────────────
    // Navigate to scanner via bottom nav
    const scanNavBtn = page.locator('[aria-label="Scan"]');
    if (await scanNavBtn.count() > 0) {
      await scanNavBtn.click();
      await page.waitForTimeout(2000); // Scanner mounts camera + model warm-up
    }
    await shoot('04-scanner-screen.png', 'Scanner / Camera capture screen');

    // ── 5. History screen ─────────────────────────────────────────────────────
    const histBtn = page.locator('[aria-label="History"]');
    if (await histBtn.count() > 0) {
      await histBtn.click();
      await page.waitForTimeout(800);
    }
    await shoot('05-history-screen.png', 'Scan History screen');

    // ── 6. Home tab again ─────────────────────────────────────────────────────
    const homeBtn = page.locator('[aria-label="Home"]');
    if (await homeBtn.count() > 0) {
      await homeBtn.click();
      await page.waitForTimeout(600);
    }

    // ── 7. Landscape / desktop overview ───────────────────────────────────────
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await waitForApp();
    await page.waitForTimeout(600);
    await shoot('06-desktop-overview.png', 'Desktop / landscape overview for README banner');

    console.log(`\n🎉 All screenshots saved to: ${OUTPUT_DIR}\n`);

  } catch (err) {
    console.error('\n❌ Screenshot error:', err.message);
    try {
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'error-state.png') });
    } catch { /* ignore */ }
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

takeScreenshots();
