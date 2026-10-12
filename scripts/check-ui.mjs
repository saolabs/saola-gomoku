import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.TEST_BASE_URL || `http://127.0.0.1:5556${process.env.SAOLA_DIST_BASE_URL || '/'}`;
let server, browser;
const errors = [];
try {
  let ready = false;
  try { ready = (await fetch(base)).ok; } catch {}
  if (!ready) {
    server = spawn('npm', ['run', 'preview'], { stdio: 'inherit', detached: process.platform !== 'win32' });
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 250));
      try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    }
  }
  assert(ready, 'Preview server is unavailable; run npm run build first.');
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.locator('#board button').first().waitFor();
  assert.equal(await page.locator('#board button').count(), 225);
  assert(!/React|@else|@endif/.test(await page.locator('body').innerText()));

  async function options(values) {
    await page.locator('#new-game').click();
    for (const [name, value] of Object.entries(values)) {
      const field = page.locator(`[name="${name}"]`);
      if (name.endsWith('Name')) await field.fill(value);
      else await field.selectOption(value);
    }
    await page.locator('#start-game').click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
  }
  const cell = coord => page.locator(`[data-coord="${coord}"]`);

  await page.getByRole('button', { name: 'Xem luật chơi' }).click();
  assert((await page.getByRole('dialog').innerText()).includes('Swap2'));
  await page.getByRole('button', { name: 'Đã hiểu, chơi thôi →' }).click();
  await page.locator('#new-game').click();
  await page.locator('[name="target"]').selectOption('6');
  await page.locator('[name="size"]').selectOption('0');
  await page.waitForFunction(() => document.querySelector('[name="target"]')?.value === '5');
  assert.equal(await page.locator('[name="target"] option[value="6"]').count(), 0);
  assert.equal(await page.locator('[name="opening"] option[value="swap2"]').count(), 0);
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  assert.equal(await page.locator('#board button').count(), 225);

  await options({ gameMode: 'twoPlayer', size: '0', target: '4', player1Name: 'An', player2Name: 'Bình' });
  assert.equal(await page.locator('#board button').count(), 25);
  for (const coord of ['1:3', '1:1', '2:3', '2:1', '3:3', '3:1', '4:3']) await cell(coord).click();
  await page.getByText('An chiến thắng!', { exact: true }).waitFor();
  assert.equal(await page.locator('#board .win').count(), 4);
  assert.equal(await page.locator('#board button:not([disabled])').count(), 0);
  await page.locator('#reset').click();
  await page.waitForFunction(() => document.querySelectorAll('#board .x, #board .o').length === 0);
  assert.equal(await page.locator('#board .x, #board .o').count(), 0);

  await options({ gameMode: 'twoPlayer', size: '2', target: '5', opening: 'swap2' });
  for (const coord of ['8:8', '9:8', '8:9']) await cell(coord).click();
  await page.getByRole('button', { name: 'Đặt thêm 2 quân' }).click();
  for (const coord of ['9:9', '7:8']) await cell(coord).click();
  assert.equal(await page.getByRole('button', { name: 'Đặt thêm 2 quân' }).count(), 0);
  await page.getByRole('button', { name: 'Chọn Xanh · O' }).click();
  await cell('7:9').click();
  await page.waitForFunction(() => document.querySelector('[data-coord="7:9"]')?.textContent.trim().toLowerCase() === 'o');
  assert.equal((await cell('7:9').innerText()).toLowerCase(), 'o');

  await options({ gameMode: 'ai', size: '0', target: '4', opening: 'standard', computerModel: 'UCT_Independent' });
  await cell('3:3').click();
  await page.waitForFunction(() => document.querySelectorAll('#board .x, #board .o').length === 2);
  assert(await page.locator('#hint').isEnabled());
  await page.locator('#auto').click();
  await page.getByRole('button', { name: /Dừng tự động/ }).waitFor();
  await page.locator('#auto').click();
  await page.getByRole('button', { name: /Xem hai bot tự chơi/ }).waitFor();
  await page.locator('#reset').click();
  await page.locator('#sound').click();
  await page.getByRole('button', { name: '♪ Âm thanh tắt' }).waitFor();

  await options({ gameMode: 'twoPlayer', size: '2', target: '5', opening: 'standard' });
  for (const coord of ['8:8', '9:8', '8:9', '9:9', '7:9', '10:9']) await cell(coord).click();
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  assert.deepEqual(errors, [], 'Unexpected browser errors');
  console.log('Browser checks passed: rules, settings/cancel, board limits, victory, reset, Swap2, AI turn, autoplay, sound and mobile layout.');
} finally {
  if (browser) await browser.close();
  if (server) {
    if (process.platform !== 'win32') process.kill(-server.pid, 'SIGTERM');
    else server.kill('SIGTERM');
  }
}
