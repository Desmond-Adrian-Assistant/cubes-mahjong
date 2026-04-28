#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { chromium } = require('/tmp/cubes-mp-browser-test/node_modules/playwright-core');

const BASE = process.env.MJ_URL || 'http://localhost:8878/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.join(__dirname, '..', 'screenshots', 'mp-browser-test');
fs.mkdirSync(OUT, { recursive: true });

async function waitForGC(page) {
  await page.waitForFunction(() => window.gameController && window.gameController.renderer, null, { timeout: 20000 });
}

async function safeShot(page, name) {
  const file = path.join(OUT, name + '.png');
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function getState(page) {
  return await page.evaluate(() => {
    const gc = window.gameController;
    return {
      seat: gc.mpClient?.seatIdx,
      room: gc.mpClient?.room,
      mpMode: gc.mpMode,
      phase: gc._lastMpState?.phase,
      currentPlayer: gc._lastMpState?.currentPlayer,
      options: gc._lastMpState?.claimOptions || [],
      handLen: gc._lastMpState?.hand?.length || 0,
      drawnTileId: gc._lastMpState?.drawnTileId,
      lastDiscard: gc._lastMpState?.lastDiscard?.id,
      tilesLeft: gc._lastMpState?.tilesLeft,
      modalShown: document.getElementById('modal')?.classList.contains('show'),
      floatShown: getComputedStyle(document.getElementById('drawn-tile-float') || document.body).display !== 'none'
    };
  });
}

async function actIfNeeded(page, label) {
  return await page.evaluate((label) => {
    const gc = window.gameController;
    const st = gc._lastMpState;
    if (!st || !gc.mpClient) return { action: 'no-state' };
    if ((st.claimOptions || []).length > 0) {
      gc.mpSend({ type: 'skip' });
      return { action: 'skip-claim', options: st.claimOptions };
    }
    if (st.phase === 'discard' && st.currentPlayer === gc.mpClient.seatIdx) {
      const hand = st.hand || [];
      const tile = hand.find(t => t.id === st.drawnTileId) || hand[0];
      if (!tile) return { action: 'no-tile' };
      gc.mpSend({ type: 'discard', tileId: tile.id });
      return { action: 'discard', tileId: tile.id, label };
    }
    return { action: 'wait', phase: st.phase, currentPlayer: st.currentPlayer, seat: gc.mpClient.seatIdx };
  }, label);
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const guestCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await hostCtx.addInitScript(() => { localStorage.setItem('mj_name', 'HostBot'); localStorage.setItem('mj_avatar', 'chen'); });
  await guestCtx.addInitScript(() => { localStorage.setItem('mj_name', 'GuestBot'); localStorage.setItem('mj_avatar', 'lin'); });

  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();
  const events = [];
  for (const [page, label] of [[host, 'host'], [guest, 'guest']]) {
    page.on('console', msg => events.push(`[${label} console:${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => events.push(`[${label} pageerror] ${err.message}`));
  }

  await host.goto(BASE, { waitUntil: 'domcontentloaded' });
  await waitForGC(host);
  await host.evaluate(async () => { await window.gameController.mpCreateRoom(); });
  await host.waitForFunction(() => document.getElementById('mp-code-display')?.textContent.trim().length === 4, null, { timeout: 10000 });
  const room = await host.locator('#mp-code-display').textContent();
  const lobbyHost = await safeShot(host, '01-host-lobby');

  await guest.goto(BASE, { waitUntil: 'domcontentloaded' });
  await waitForGC(guest);
  await guest.evaluate(async (room) => { await window.gameController.mpJoinRoom(room); }, room.trim());
  await guest.waitForFunction(() => document.getElementById('mp-player-list')?.textContent.includes('GuestBot'), null, { timeout: 10000 });
  const lobbyGuest = await safeShot(guest, '02-guest-lobby');

  await host.click('#mp-start-game');
  await host.waitForFunction(() => window.gameController?._lastMpState?.phase === 'discard', null, { timeout: 15000 });
  await guest.waitForFunction(() => window.gameController?._lastMpState?.phase === 'discard', null, { timeout: 15000 });
  const gameHost = await safeShot(host, '03-host-started');
  const gameGuest = await safeShot(guest, '04-guest-started');

  const actionLog = [];
  let successfulActions = 0;
  for (let i = 0; i < 30; i++) {
    const hs = await getState(host);
    const gs = await getState(guest);
    let acted = false;
    for (const [page, label, st] of [[host, 'host', hs], [guest, 'guest', gs]]) {
      if ((st.options && st.options.length) || (st.phase === 'discard' && st.currentPlayer === st.seat)) {
        const res = await actIfNeeded(page, label);
        actionLog.push({ step: i, label, ...res });
        if (res.action === 'discard' || res.action === 'skip-claim') successfulActions++;
        acted = true;
      }
    }
    if (!acted) actionLog.push({ step: i, action: 'wait', host: hs, guest: gs });
    await host.waitForTimeout(450);
    if (successfulActions >= 8) break;
  }

  await host.waitForTimeout(1000);
  const finalHost = await safeShot(host, '05-host-after-rounds');
  const finalGuest = await safeShot(guest, '06-guest-after-rounds');
  const final = { host: await getState(host), guest: await getState(guest) };

  await browser.close();
  const result = { room: room.trim(), screenshots: [lobbyHost, lobbyGuest, gameHost, gameGuest, finalHost, finalGuest], actionLog, final, events: events.slice(-20) };
  console.log(JSON.stringify(result, null, 2));
})().catch(async err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
