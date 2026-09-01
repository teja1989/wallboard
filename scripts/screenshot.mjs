/**
 * Drives the real app in a browser and captures screenshots of each screen in both themes.
 * Development aid, not part of the test suite — the assertions live in tests/e2e.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';
const OUT = process.env.SHOT_DIR ?? '/tmp/marquee-shots';

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
  // The sandbox routes outbound HTTP through a proxy; localhost must bypass it.
  args: ['--no-proxy-server'],
});
const problems = [];

for (const scheme of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: scheme,
  });
  const page = await context.newPage();

  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`[${scheme}] console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`[${scheme}] pageerror: ${error.message}`));

  for (const [name, path] of [
    ['landing', '/'],
    ['join', '/join'],
    ['create', '/create'],
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${name}-${scheme}.png`, fullPage: true });
    console.log(`captured ${name}-${scheme}.png`);
  }

  await context.close();
}

await browser.close();

if (problems.length) {
  console.log('\nBrowser problems:');
  for (const problem of problems) console.log(`  ${problem}`);
  process.exit(1);
}
console.log('\nNo console errors.');
