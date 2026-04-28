#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { chromium } = require('/tmp/cubes-mp-browser-test/node_modules/playwright-core');

const BASE = process.env.MJ_URL || 'http://localhost:8878/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const RUN_ID = process.env.MJ_RUN_ID || 'forced-win-' + new Date().toISOString().replace(/[:.]/g, '-');
const OUT = path.join(__dirname, '..', 'screenshots', 'mp-forced-win', RUN_ID);
fs.mkdirSync(OUT, { recursive: true });

async function waitForGC(page) { await page.waitForFunction(() => window.gameController && window.gameController.renderer, null, { timeout: 20000 }); }
async function shot(page, name) { const file = path.join(OUT, name + '.png'); await page.screenshot({ path: file, fullPage: false }); return file; }
async function waitFor(page, fn, label) { await page.waitForFunction(fn, null, { timeout: 15000 }).catch(e => { throw new Error(`timeout waiting for ${label}: ${e.message}`); }); }
async function state(page) { return page.evaluate(() => ({
  seat: window.gameController?.mpClient?.seatIdx,
  room: window.gameController?.mpClient?.room,
  mpMode: window.gameController?.mpMode,
  phase: window.gameController?._lastMpState?.phase,
  canTsumo: window.gameController?._lastMpState?.canTsumo,
  handLen: window.gameController?._lastMpState?.hand?.length,
  modalShown: document.getElementById('modal')?.classList.contains('show'),
  modalTitle: document.getElementById('modal-title')?.textContent || '',
  modalText: document.getElementById('modal-text')?.textContent || '',
  scores: window.gameController?._lastMpState?.scores
})); }

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const names = ['WinHost','WinGuest2','WinGuest3','WinGuest4'];
  const pages = [];
  const events = [];
  for (let i=0;i<4;i++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(({ name }) => { localStorage.setItem('mj_name', name); localStorage.setItem('mj_avatar', 'chen'); }, { name: names[i] });
    const page = await ctx.newPage();
    page.on('console', msg => { if (msg.type() === 'error') events.push(`[${names[i]} console:error] ${msg.text()}`); });
    page.on('pageerror', err => events.push(`[${names[i]} pageerror] ${err.message}`));
    pages.push(page);
  }
  const host = pages[0];
  await host.goto(BASE, { waitUntil: 'domcontentloaded' }); await waitForGC(host);
  await host.evaluate(async () => window.gameController.mpCreateRoom());
  await waitFor(host, () => document.getElementById('mp-code-display')?.textContent.trim().length === 4, 'room code');
  const room = (await host.locator('#mp-code-display').textContent()).trim();
  for (let i=1;i<4;i++) { await pages[i].goto(BASE, { waitUntil: 'domcontentloaded' }); await waitForGC(pages[i]); await pages[i].evaluate(async room => window.gameController.mpJoinRoom(room), room); }
  await waitFor(host, () => document.getElementById('mp-player-list')?.textContent.includes('WinGuest4'), '4 players');
  await shot(host, '01-lobby');
  await host.click('#mp-start-game');
  await Promise.all(pages.map((p,i) => waitFor(p, () => window.gameController?._lastMpState?.phase === 'discard', `start ${i}`)));
  await shot(host, '02-start-before-force');
  await host.evaluate(() => window.gameController.mpSend({ type: 'debugForceWin', seat: 0 }));
  await waitFor(host, () => window.gameController?._lastMpState?.canTsumo === true, 'forced canTsumo');
  await shot(host, '03-forced-winning-hand');
  await host.evaluate(() => window.gameController.mpSend({ type: 'mahjong' }));
  await Promise.all(pages.map((p,i) => waitFor(p, () => /Win/i.test(document.getElementById('modal-title')?.textContent || ''), `win modal ${i}`)));
  const screenshots = [];
  for (let i=0;i<4;i++) screenshots.push(await shot(pages[i], `04-seat${i}-win`));
  const states = await Promise.all(pages.map(state));
  const result = { room, states, screenshots, events };
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await Promise.race([browser.close(), new Promise(resolve => setTimeout(resolve, 3000))]).catch(() => {});
  process.exit(0);
})().catch(err => { console.error(err.stack || err.message); process.exit(1); });
