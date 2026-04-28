#!/usr/bin/env node
const WebSocket = require('ws');

const URL = process.env.MJ_WS_URL || 'ws://localhost:8878';
const timeoutMs = Number(process.env.MJ_TEST_TIMEOUT || 10000);

function connect(name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    const client = { ws, name, messages: [], room: null, seat: null, token: null, states: [] };
    const timer = setTimeout(() => reject(new Error(`${name} connect timeout`)), timeoutMs);
    ws.on('open', () => { clearTimeout(timer); resolve(client); });
    ws.on('message', raw => {
      const msg = JSON.parse(raw.toString());
      client.messages.push(msg);
      if (msg.type === 'room') { client.room = msg.room; client.seat = msg.you; client.token = msg.reconnectToken; }
      if (msg.type === 'gameState') client.states.push(msg);
    });
    ws.on('error', reject);
  });
}

function waitFor(client, pred, label) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const found = client.messages.find(pred);
      if (found) return resolve(found);
      if (Date.now() - start > timeoutMs) return reject(new Error(`${client.name} timed out waiting for ${label}`));
      setTimeout(tick, 30);
    };
    tick();
  });
}

(async () => {
  const host = await connect('Host');
  host.ws.send(JSON.stringify({ type: 'create', name: 'Host', avatar: 'chen' }));
  const roomMsg = await waitFor(host, m => m.type === 'room' && m.room, 'room create');
  if (!roomMsg.reconnectToken) throw new Error('host missing reconnect token');

  const guest = await connect('Guest');
  guest.ws.send(JSON.stringify({ type: 'join', room: host.room, name: 'Guest', avatar: 'lin' }));
  await waitFor(guest, m => m.type === 'room' && m.you === 1 && m.reconnectToken, 'guest join');
  await waitFor(host, m => m.type === 'room' && m.players && m.players.length === 2, 'host sees guest');

  host.ws.send(JSON.stringify({ type: 'start' }));
  const hostState = await waitFor(host, m => m.type === 'gameState' && m.phase === 'discard', 'host game state');
  const guestState = await waitFor(guest, m => m.type === 'gameState' && m.phase === 'discard', 'guest game state');

  if (!Array.isArray(hostState.hand) || hostState.hand.length < 13) throw new Error('host did not receive own hand');
  if (!Array.isArray(guestState.hand) || guestState.hand.length < 13) throw new Error('guest did not receive own hand');
  if (hostState.handCounts[1] !== guestState.hand.length) throw new Error('host handCounts does not match guest own hand length');
  if (guestState.handCounts[0] !== hostState.hand.length) throw new Error('guest handCounts does not match host own hand length');

  if (hostState.currentPlayer === host.seat) {
    const tile = hostState.hand.find(t => t.id === hostState.drawnTileId) || hostState.hand[0];
    host.ws.send(JSON.stringify({ type: 'discard', tileId: tile.id }));
    await waitFor(guest, m => m.type === 'gameState' && m.lastDiscard && m.lastDiscard.id === tile.id, 'tileId discard propagation');
  }

  const reconnect = await connect('HostRejoin');
  reconnect.ws.send(JSON.stringify({ type: 'join', room: host.room, name: 'Host', seat: host.seat, reconnectToken: host.token }));
  const rejoinRoom = await waitFor(reconnect, m => m.type === 'room' && m.you === host.seat, 'rejoin room');
  if (rejoinRoom.reconnectToken !== host.token) throw new Error('reconnect token changed unexpectedly');
  await waitFor(reconnect, m => m.type === 'gameState', 'rejoin game snapshot');

  for (const c of [host, guest, reconnect]) c.ws.close();
  console.log('MP smoke test passed:', host.room);
})().catch(err => {
  console.error('MP smoke test failed:', err.stack || err.message);
  process.exit(1);
});
