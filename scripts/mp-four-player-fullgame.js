#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { chromium } = require('/tmp/cubes-mp-browser-test/node_modules/playwright-core');

const BASE = process.env.MJ_URL || 'http://localhost:8878/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const RUN_ID = process.env.MJ_RUN_ID || new Date().toISOString().replace(/[:.]/g, '-');
const OUT = path.join(__dirname, '..', 'screenshots', 'mp-four-player-fullgame', RUN_ID);
fs.mkdirSync(OUT, { recursive: true });
const MAX_STEPS = Number(process.env.MJ_FULLGAME_STEPS || 260);
const STEP_DELAY = Number(process.env.MJ_FULLGAME_DELAY || 80);
const SNAPSHOT_EVERY = Number(process.env.MJ_SNAPSHOT_EVERY || 0);
const SNAPSHOT_SEATS = (process.env.MJ_SNAPSHOT_SEATS || '0')
  .split(',')
  .map(s => Number(s.trim()))
  .filter(n => Number.isInteger(n) && n >= 0 && n < 4);

async function shot(page, name) {
  const file = path.join(OUT, name + '.png');
  await page.screenshot({ path: file, fullPage: false });
  return file;
}
async function waitForGC(page) {
  await page.waitForFunction(() => window.gameController && window.gameController.renderer, null, { timeout: 20000 });
}
async function state(page) {
  return await page.evaluate(() => {
    const gc = window.gameController, st = gc?._lastMpState || {};
    return {
      seat: gc?.mpClient?.seatIdx,
      room: gc?.mpClient?.room,
      mpMode: gc?.mpMode,
      phase: st.phase,
      currentPlayer: st.currentPlayer,
      options: st.claimOptions || [],
      handLen: st.hand?.length || 0,
      drawnTileId: st.drawnTileId,
      lastDiscard: st.lastDiscard?.id,
      tilesLeft: st.tilesLeft,
      scores: st.scores,
      modalShown: document.getElementById('modal')?.classList.contains('show'),
      modalTitle: document.getElementById('modal-title')?.textContent || '',
      floatShown: getComputedStyle(document.getElementById('drawn-tile-float') || document.body).display !== 'none'
    };
  });
}
async function act(page, name) {
  return await page.evaluate((name) => {
    const gc = window.gameController;
    const st = gc?._lastMpState;
    if (!gc || !st || !gc.mpClient) return { action: 'no-state', name };
    if (st.phase === 'ended') return { action: 'ended', name };
    const options = st.claimOptions || [];
    // Keep wins, skip lower claims so the test reaches completion without getting stuck in claim windows.
    if (options.includes('mahjong')) { gc.mpSend({ type: 'mahjong' }); return { action: 'mahjong-claim', name }; }
    if (options.length > 0) { gc.mpSend({ type: 'skip' }); return { action: 'skip-claim', name, options }; }
    if (st.phase === 'discard' && st.currentPlayer === gc.mpClient.seatIdx) {
      if (st.canTsumo) { gc.mpSend({ type: 'mahjong' }); return { action: 'mahjong-tsumo', name }; }
      const hand = st.hand || [];
      const tile = hand.find(t => t.id === st.drawnTileId) || hand[0];
      if (!tile) return { action: 'no-tile', name };
      gc.mpSend({ type: 'discard', tileId: tile.id });
      return { action: 'discard', name, tileId: tile.id };
    }
    return { action: 'wait', name, phase: st.phase, currentPlayer: st.currentPlayer, seat: gc.mpClient.seatIdx };
  }, name);
}
async function waitFor(page, fn, label) {
  await page.waitForFunction(fn, null, { timeout: 15000 }).catch(e => { throw new Error(`timeout waiting for ${label}: ${e.message}`); });
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const names = ['P1Host','P2Guest','P3Guest','P4Guest'];
  const avatars = ['chen','lin','kenji','keni'];
  const contexts = [];
  const pages = [];
  const events = [];
  for (let i=0;i<4;i++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(({name, avatar}) => { localStorage.setItem('mj_name', name); localStorage.setItem('mj_avatar', avatar); }, { name: names[i], avatar: avatars[i] });
    const page = await ctx.newPage();
    page.on('console', msg => { if (msg.type() === 'error') events.push(`[${names[i]} console:${msg.type()}] ${msg.text()}`); });
    page.on('pageerror', err => events.push(`[${names[i]} pageerror] ${err.message}`));
    contexts.push(ctx); pages.push(page);
  }
  const host = pages[0];
  await host.goto(BASE, { waitUntil: 'domcontentloaded' });
  await waitForGC(host);
  await host.evaluate(async () => window.gameController.mpCreateRoom());
  await waitFor(host, () => document.getElementById('mp-code-display')?.textContent.trim().length === 4, 'host room code');
  const room = (await host.locator('#mp-code-display').textContent()).trim();
  for (let i=1;i<4;i++) {
    await pages[i].goto(BASE, { waitUntil: 'domcontentloaded' });
    await waitForGC(pages[i]);
    await pages[i].evaluate(async (room) => window.gameController.mpJoinRoom(room), room);
  }
  await waitFor(host, () => document.getElementById('mp-player-list')?.textContent.includes('P4Guest'), '4 players in lobby');
  const lobbyShot = await shot(host, '01-four-player-lobby');
  await host.click('#mp-start-game');
  await Promise.all(pages.map((p,i) => waitFor(p, () => window.gameController?._lastMpState?.phase === 'discard', `${names[i]} game start`)));
  const startShots = [];
  for (let i=0;i<4;i++) startShots.push(await shot(pages[i], `02-seat${i}-start`));

  const actionLog = [];
  const periodicShots = [];
  let gameOver = null;
  let lastProgressKey = '';
  let stagnant = 0;
  for (let step=0; step<MAX_STEPS; step++) {
    const states = await Promise.all(pages.map(state));
    if (SNAPSHOT_EVERY > 0 && step > 0 && step % SNAPSHOT_EVERY === 0) {
      for (const seat of SNAPSHOT_SEATS) {
        periodicShots.push(await shot(pages[seat], `step-${String(step).padStart(3, '0')}-seat${seat}`));
      }
    }
    const key = JSON.stringify(states.map(s => [s.phase, s.currentPlayer, s.tilesLeft, s.lastDiscard, s.modalTitle]));
    if (key === lastProgressKey) stagnant++; else { stagnant = 0; lastProgressKey = key; }
    const overIdx = states.findIndex(s => s.phase === 'ended' || /Win|Draw/i.test(s.modalTitle));
    if (overIdx >= 0) { gameOver = { step, states }; break; }
    if (stagnant > 80) { gameOver = { step, states, blocker: 'stagnant state for >80 iterations' }; break; }
    for (let i=0;i<4;i++) {
      const res = await act(pages[i], names[i]);
      if (res.action !== 'wait') actionLog.push({ step, ...res });
    }
    await pages[0].waitForTimeout(STEP_DELAY);
  }
  const endStates = await Promise.all(pages.map(state));
  const endShots = [];
  for (let i=0;i<4;i++) endShots.push(await shot(pages[i], `03-seat${i}-end`));
  const result = { room, maxSteps: MAX_STEPS, gameOver, endStates, actionCount: actionLog.length, actionLogTail: actionLog.slice(-40), screenshots: [lobbyShot, ...startShots, ...periodicShots, ...endShots], periodicShots, events: events.slice(-30) };
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await Promise.race([browser.close(), new Promise(resolve => setTimeout(resolve, 3000))]).catch(() => {});
  if (!gameOver || gameOver.blocker) process.exitCode = 2;
  process.exit(process.exitCode || 0);
})().catch(err => { console.error(err.stack || err.message); process.exit(1); });
