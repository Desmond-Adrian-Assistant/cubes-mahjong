#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { chromium } = require('/tmp/cubes-mp-browser-test/node_modules/playwright-core');

const BASE = process.env.MJ_URL || 'http://localhost:8878/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const RUN_ID = process.env.MJ_RUN_ID || `ai-claims-${Date.now()}`;
const OUT = path.join(__dirname, '..', 'screenshots', 'mp-ai-claims-audit', RUN_ID);
fs.mkdirSync(OUT, { recursive: true });
const MAX_STEPS = Number(process.env.MJ_CLAIMS_STEPS || 220);

function ids(xs) { return (xs || []).map(t => t && t.id).filter(x => x !== undefined); }
function dupes(a, b) { const s = new Set(a); return b.filter(x => s.has(x)); }

async function state(page) {
  return page.evaluate(() => {
    const gc = window.gameController;
    const players = (gc?.gs?.players || []).map((p, idx) => ({
      idx,
      hand: (p.hand || []).map(t => t.id),
      discards: (p.discards || []).map(t => t.id),
      melds: (p.melds || []).map(m => ({ type: m.type, tiles: (m.tiles || []).map(t => t.id) })),
      meldTileIds: (p.melds || []).flatMap(m => (m.tiles || []).map(t => t.id)),
    }));
    return {
      phase: gc?.gs?.phase,
      currentPlayer: gc?.gs?.currentPlayer,
      tilesLeft: gc?.gs?.mpTilesLeft,
      modalTitle: document.getElementById('modal-title')?.textContent || '',
      players,
    };
  });
}

async function act(page) {
  return page.evaluate(() => {
    const gc = window.gameController;
    const st = gc?._lastMpState;
    if (!gc || !st || !gc.mpClient) return 'no-state';
    const options = st.claimOptions || [];
    if (options.includes('mahjong')) { gc.mpSend({ type: 'skip' }); return 'skip-mahjong-for-audit'; }
    if (options.length) { gc.mpSend({ type: 'skip' }); return 'skip-claim'; }
    if (st.phase === 'discard' && st.currentPlayer === gc.mpClient.seatIdx) {
      const hand = st.hand || [];
      const tile = hand.find(t => t.id === st.drawnTileId) || hand[0];
      if (tile) { gc.mpSend({ type: 'discard', tileId: tile.id }); return 'discard'; }
    }
    return 'wait';
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { localStorage.setItem('mj_name', 'AuditHost'); localStorage.setItem('mj_avatar', 'chen'); });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.gameController && window.gameController.renderer, null, { timeout: 20000 });
  await page.evaluate(async () => window.gameController.mpCreateRoom());
  await page.waitForFunction(() => document.getElementById('mp-code-display')?.textContent.trim().length === 4, null, { timeout: 15000 });
  const room = (await page.locator('#mp-code-display').textContent()).trim();
  await page.click('#mp-start-game');
  await page.waitForFunction(() => window.gameController?._lastMpState?.phase === 'discard', null, { timeout: 15000 });

  const auditLog = [];
  let firstMeldStep = null;
  let issue = null;
  for (let step = 0; step < MAX_STEPS; step++) {
    const st = await state(page);
    const meldCount = st.players.reduce((sum, p) => sum + p.melds.length, 0);
    if (meldCount && firstMeldStep == null) {
      firstMeldStep = step;
      await page.screenshot({ path: path.join(OUT, `first-meld-step-${step}.png`) });
    }
    for (const p of st.players) {
      const overlap = dupes(p.discards, p.meldTileIds);
      if (overlap.length) issue = { step, player: p.idx, overlap, p };
    }
    auditLog.push({ step, phase: st.phase, currentPlayer: st.currentPlayer, tilesLeft: st.tilesLeft, meldCount, modalTitle: st.modalTitle });
    if (issue || st.phase === 'ended' || /Win|Draw/i.test(st.modalTitle)) break;
    await act(page);
    await page.waitForTimeout(60);
  }
  const finalState = await state(page);
  await page.screenshot({ path: path.join(OUT, 'final.png') });
  const result = { room, firstMeldStep, issue, finalState, auditLogTail: auditLog.slice(-30), out: OUT };
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  process.exit(issue ? 2 : 0);
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
