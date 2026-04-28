// Cubes Mahjong Cloudflare Workers + Durable Objects prototype.
// Keeps the committed Node server intact; this is the edge-native room server.

const WINDS = ['East', 'South', 'West', 'North'];
const DRAGONS = ['Red', 'Green', 'White'];
const FLOWERS = ['Plum', 'Orchid', 'Chrysanthemum', 'Bamboo'];
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', ...(init.headers || {}) },
  });
}

function createTileSet() {
  const tiles = [];
  let id = 0;
  for (const suit of ['bamboo', 'dots', 'characters']) {
    for (let num = 1; num <= 9; num++) for (let i = 0; i < 4; i++) tiles.push({ id: id++, suit, num, type: 'suited' });
  }
  for (const wind of WINDS) for (let i = 0; i < 4; i++) tiles.push({ id: id++, suit: 'winds', wind, type: 'honor' });
  for (const dragon of DRAGONS) for (let i = 0; i < 4; i++) tiles.push({ id: id++, suit: 'dragons', dragon, type: 'honor' });
  for (const flower of FLOWERS) tiles.push({ id: id++, suit: 'flowers', flower, type: 'bonus' });
  for (const season of SEASONS) tiles.push({ id: id++, suit: 'flowers', season, type: 'bonus' });
  return tiles;
}
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
function getTileSortKey(tile) {
  const suitOrder = { bamboo: 0, dots: 1, characters: 2, winds: 3, dragons: 4, flowers: 5 };
  let key = (suitOrder[tile.suit] || 0) * 100;
  if (tile.num) key += tile.num;
  if (tile.wind) key += WINDS.indexOf(tile.wind);
  if (tile.dragon) key += DRAGONS.indexOf(tile.dragon);
  if (tile.flower) key += FLOWERS.indexOf(tile.flower);
  if (tile.season) key += SEASONS.indexOf(tile.season) + 4;
  return key;
}
function sortHand(hand) { return hand.sort((a, b) => getTileSortKey(a) - getTileSortKey(b)); }
function tilesMatch(a, b) { if (!a || !b || a.suit !== b.suit) return false; if (a.num !== undefined) return a.num === b.num; if (a.wind) return a.wind === b.wind; if (a.dragon) return a.dragon === b.dragon; return false; }
function countMatching(hand, tile) { return hand.filter(t => tilesMatch(t, tile)).length; }
function getTileKey(tile) { if (tile.num !== undefined) return `${tile.suit}-${tile.num}`; if (tile.wind) return `winds-${tile.wind}`; if (tile.dragon) return `dragons-${tile.dragon}`; return `${tile.suit}-${tile.flower || tile.season}`; }
function canFormSets(tiles, numSets) {
  if (tiles.length === 0) return numSets === 0;
  if (tiles.length !== numSets * 3) return false;
  const sorted = [...tiles].sort((a, b) => getTileSortKey(a) - getTileSortKey(b));
  if (sorted.length >= 3 && tilesMatch(sorted[0], sorted[1]) && tilesMatch(sorted[1], sorted[2]) && canFormSets(sorted.slice(3), numSets - 1)) return true;
  if (sorted[0].type === 'suited' && sorted.length >= 3) {
    const t1 = sorted[0];
    const t2Idx = sorted.findIndex((t, i) => i > 0 && t.suit === t1.suit && t.num === t1.num + 1);
    const t3Idx = sorted.findIndex((t, i) => i > 0 && t.suit === t1.suit && t.num === t1.num + 2);
    if (t2Idx > 0 && t3Idx > 0) {
      const remaining = [...sorted];
      for (const idx of [0, t2Idx, t3Idx].sort((a, b) => b - a)) remaining.splice(idx, 1);
      if (canFormSets(remaining, numSets - 1)) return true;
    }
  }
  return false;
}
function checkWinningHand(hand, setsNeeded = 4) {
  const expected = setsNeeded * 3 + 2;
  if (hand.length !== expected) return false;
  const sorted = [...hand].sort((a, b) => getTileSortKey(a) - getTileSortKey(b));
  for (let i = 0; i < sorted.length - 1; i++) {
    if (tilesMatch(sorted[i], sorted[i + 1])) {
      const remaining = [...sorted];
      remaining.splice(i, 2);
      if (canFormSets(remaining, setsNeeded)) return true;
    }
  }
  return false;
}
function canMahjong(player, extraTile = null) { const hand = [...player.hand]; if (extraTile) hand.push(extraTile); return checkWinningHand(hand, 4 - player.melds.length); }
function getChiCombinations(player, tile, fromPlayerIdx, playerIdx) {
  if (!tile || tile.type !== 'suited') return [];
  if ((playerIdx + 3) % 4 !== fromPlayerIdx) return [];
  const hand = player.hand;
  const combos = [];
  const hasN = n => hand.some(t => t.suit === tile.suit && t.num === n);
  const num = tile.num;
  if (num >= 3 && hasN(num - 2) && hasN(num - 1)) combos.push([num - 2, num - 1, num]);
  if (num >= 2 && num <= 8 && hasN(num - 1) && hasN(num + 1)) combos.push([num - 1, num, num + 1]);
  if (num <= 7 && hasN(num + 1) && hasN(num + 2)) combos.push([num, num + 1, num + 2]);
  return combos;
}
function aiChooseDiscard(player) { return player.hand.length ? Math.floor(Math.random() * player.hand.length) : -1; }

class GameState {
  constructor() { this.reset(); }
  reset() {
    this.wall = []; this.deadWall = [];
    this.players = [0, 1, 2, 3].map(i => ({ hand: [], melds: [], flowers: [], discards: [], score: 25000, isAI: true, name: `AI ${WINDS[i]}`, avatar: 'chen' }));
    this.currentPlayer = 0; this.phase = 'waiting'; this.lastDiscard = null; this.lastDiscardPlayer = -1; this.drawnTile = null;
    this.claimResponses = {}; this.winType = null; this.liveWallInitial = 0; this.wallCapacities = [33, 33, 32, 32]; this.wallBreakOffset = 0;
  }
  distributeWallCapacities(total) { const base = Math.floor(total / 4), rem = total % 4; return [0,1,2,3].map(i => base + (i < rem ? 1 : 0)); }
  dealTiles() {
    this.wall = shuffle(createTileSet()); this.deadWall = this.wall.splice(0, 14);
    this.liveWallInitial = this.wall.length; this.wallCapacities = this.distributeWallCapacities(this.liveWallInitial); this.wallBreakOffset = Math.floor(Math.random() * Math.max(1, this.liveWallInitial));
    for (let round = 0; round < 3; round++) for (let p = 0; p < 4; p++) for (let i = 0; i < 4; i++) this.players[p].hand.push(this.wall.shift());
    for (let p = 0; p < 4; p++) this.players[p].hand.push(this.wall.shift());
    this.players[0].hand.push(this.wall.shift());
    for (let p = 0; p < 4; p++) this.handleFlowers(p);
    for (let p = 0; p < 4; p++) sortHand(this.players[p].hand);
  }
  getWallSideForPhysicalIndex(idx) { let acc = 0; for (let side = 0; side < this.wallCapacities.length; side++) { acc += this.wallCapacities[side]; if (idx < acc) return side; } return 3; }
  getWallSlots() {
    const slots = this.wallCapacities.map(cap => new Array(cap).fill(true));
    const total = this.liveWallInitial || this.wallCapacities.reduce((a,b)=>a+b,0); const drawn = Math.max(0, total - this.wall.length);
    const starts = []; let acc = 0; for (const cap of this.wallCapacities) { starts.push(acc); acc += cap; }
    for (let i = 0; i < drawn; i++) { const physicalIdx = (this.wallBreakOffset - i + total) % total; const side = this.getWallSideForPhysicalIndex(physicalIdx); const localIdx = physicalIdx - starts[side]; if (slots[side]?.[localIdx] !== undefined) slots[side][localIdx] = false; }
    return slots;
  }
  getWallCounts() { return this.getWallSlots().map(side => side.filter(Boolean).length); }
  handleFlowers(playerIdx) { const p = this.players[playerIdx]; while (true) { const idx = p.hand.findIndex(t => t.type === 'bonus'); if (idx === -1) break; p.flowers.push(p.hand.splice(idx,1)[0]); if (this.wall.length) p.hand.push(this.wall.shift()); } sortHand(p.hand); }
  drawTile(playerIdx) { if (!this.wall.length) return null; const tile = this.wall.shift(); this.players[playerIdx].hand.push(tile); this.drawnTile = tile; this.handleFlowers(playerIdx); return tile; }
  drawReplacement(playerIdx) { const tile = this.deadWall.length ? this.deadWall.shift() : this.wall.shift(); if (!tile) return null; this.players[playerIdx].hand.push(tile); this.drawnTile = tile; this.handleFlowers(playerIdx); return tile; }
  getPlayerState(playerIdx) { return { hand: this.players[playerIdx].hand, melds: this.players.map(p=>p.melds), flowers: this.players.map(p=>p.flowers), discards: this.players.map(p=>p.discards), handCounts: this.players.map(p=>p.hand.length), scores: this.players.map(p=>p.score), currentPlayer: this.currentPlayer, phase: this.phase, lastDiscard: this.lastDiscard, lastDiscardPlayer: this.lastDiscardPlayer, tilesLeft: this.wall.length, deadWallLeft: this.deadWall.length, wallCounts: this.getWallCounts(), wallSlots: this.getWallSlots(), wallBreakOffset: this.wallBreakOffset, wallCapacities: this.wallCapacities, drawnTileId: this.drawnTile?.id ?? null, playerNames: this.players.map(p=>p.name), playerIsAI: this.players.map(p=>p.isAI), playerAvatars: this.players.map(p=>p.avatar || 'chen') }; }
  calculateScore(winnerIdx) { const basePoints = 8 + this.players[winnerIdx].flowers.length + (this.winType === 'tsumo' ? 1 : 0); const value = basePoints * 4; return { basePoints, value, totalWin: value * 3 }; }
}

function generateRoomCode() { let code = ''; for (let i = 0; i < 4; i++) code += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)]; return code; }

export class MahjongRoom {
  constructor(state, env) { this.state = state; this.env = env; this.sessions = new Set(); this.clients = []; this.gs = new GameState(); this.roomCode = null; }
  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get('upgrade') !== 'websocket') return json({ error: 'expected websocket' }, { status: 426 });
    this.roomCode = url.pathname.split('/').filter(Boolean).at(-1)?.toUpperCase() || this.roomCode;
    const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
    server.accept(); this.sessions.add(server);
    const name = url.searchParams.get('name') || 'Player';
    const avatar = url.searchParams.get('avatar') || 'chen';
    const seat = Number.parseInt(url.searchParams.get('seat') || '-1', 10);
    const reconnectToken = url.searchParams.get('reconnectToken') || '';
    this.attachClient(server, name, avatar, seat, reconnectToken);
    server.addEventListener('message', evt => this.onMessage(server, evt.data));
    server.addEventListener('close', () => this.onClose(server));
    server.addEventListener('error', () => this.onClose(server));
    return new Response(null, { status: 101, webSocket: client });
  }
  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch (_) {} }
  broadcast(msg) { for (const c of this.clients) if (c.connected) this.send(c.ws, msg); }
  addClient(ws, name, avatar = 'chen') { const seatIdx = this.clients.findIndex(c => !c.connected); const idx = seatIdx >= 0 ? seatIdx : this.clients.length; const c = { ws, name, avatar, seatIdx: idx, connected: true, reconnectToken: crypto.randomUUID() }; this.clients[idx] = c; ws._seatIdx = idx; ws._name = name; return idx; }
  attachClient(ws, name, avatar = 'chen', seat = -1, reconnectToken = '') {
    if (seat >= 0 && this.clients[seat] && this.clients[seat].reconnectToken === reconnectToken) {
      const c = this.clients[seat]; c.ws = ws; c.connected = true; if (name) c.name = name; if (avatar) c.avatar = avatar; ws._seatIdx = seat; ws._name = c.name; this.sendRoomInfo(); if (this.gs.phase !== 'waiting') this.sendGameStateToAll(); return seat;
    }
    if (this.gs.phase !== 'waiting' && this.clients.length >= 4) { this.send(ws, { type:'error', message:'Game already in progress' }); return -1; }
    if (this.clients.filter(c => c && c.connected).length >= 4) { this.send(ws, { type:'error', message:'Room full' }); return -1; }
    const idx = this.addClient(ws, name, avatar); this.sendRoomInfo(); return idx;
  }
  sendRoomInfo() { for (const c of this.clients) if (c.connected) this.send(c.ws, { type:'room', room:this.roomCode, players:this.clients.map(cl => ({ name: cl.name, avatar: cl.avatar, seat: cl.seatIdx, connected: cl.connected })), you:c.seatIdx, isHost:c.seatIdx===0, reconnectToken:c.reconnectToken }); }
  sendGameStateToAll() { for (const c of this.clients) if (c.connected) { const st = this.gs.getPlayerState(c.seatIdx); st.claimOptions = this.getClaimOptions(c.seatIdx); st.canTsumo = this.gs.currentPlayer === c.seatIdx && this.gs.phase === 'discard' && canMahjong(this.gs.players[c.seatIdx]); this.send(c.ws, { type:'gameState', ...st }); } }
  getClaimOptions(playerIdx) { if (this.gs.phase !== 'claiming' || !this.gs.lastDiscard || playerIdx === this.gs.lastDiscardPlayer) return []; const p = this.gs.players[playerIdx], tile = this.gs.lastDiscard, out = []; if (canMahjong(p, tile)) out.push('mahjong'); if (countMatching(p.hand, tile) >= 3) out.push('kong'); if (countMatching(p.hand, tile) >= 2) out.push('pong'); if (getChiCombinations(p, tile, this.gs.lastDiscardPlayer, playerIdx).length) out.push('chi'); return out; }
  startGame() { this.gs.reset(); this.clients.forEach((c,i)=>{ this.gs.players[i].isAI=false; this.gs.players[i].name=c.name; this.gs.players[i].avatar=c.avatar || 'chen'; }); for (let i=this.clients.length;i<4;i++) { this.gs.players[i].isAI=true; this.gs.players[i].name=`CPU ${i-this.clients.length+1}`; } this.gs.dealTiles(); this.gs.phase='discard'; this.gs.currentPlayer=0; this.gs.drawnTile=this.gs.players[0].hand.at(-1); this.sendGameStateToAll(); if (this.gs.players[0].isAI) this.aiTurnSoon(); }
  handleDiscard(seatIdx, tileId) { if (this.gs.currentPlayer !== seatIdx || this.gs.phase !== 'discard') return; const p=this.gs.players[seatIdx]; const idx=p.hand.findIndex(t=>t.id===tileId); if (idx<0) return; const tile=p.hand.splice(idx,1)[0]; p.discards.push(tile); this.gs.lastDiscard=tile; this.gs.lastDiscardPlayer=seatIdx; this.gs.drawnTile=null; sortHand(p.hand); this.checkForClaims(); }
  checkForClaims() { let has=false; for(let i=0;i<4;i++) if(i!==this.gs.lastDiscardPlayer && this.getClaimOptions(i).length) has=true; if(!has) return this.nextTurn(); this.gs.phase='claiming'; this.gs.claimResponses={}; for(let i=0;i<4;i++) if(i!==this.gs.lastDiscardPlayer && this.gs.players[i].isAI) this.gs.claimResponses[i]={action:'skip'}; this.sendGameStateToAll(); }
  handleClaim(seatIdx, action, combination=0) { if(this.gs.phase!=='claiming' || seatIdx===this.gs.lastDiscardPlayer) return; this.gs.claimResponses[seatIdx]={action,combination}; if([0,1,2,3].every(i=>i===this.gs.lastDiscardPlayer || this.gs.claimResponses[i])) this.resolveClaims(); }
  resolveClaims() { const responses=this.gs.claimResponses; for(const action of ['mahjong','kong','pong','chi']) for(let i=0;i<4;i++) if(i!==this.gs.lastDiscardPlayer && responses[i]?.action===action) return this.executeClaim(i, action, responses[i].combination||0); this.nextTurn(); }
  executeClaim(playerIdx, action, combination) { const p=this.gs.players[playerIdx], tile=this.gs.lastDiscard; if(action==='mahjong'){ p.hand.push(tile); this.gs.players[this.gs.lastDiscardPlayer].discards.pop(); this.gs.winType='ron'; return this.endGame(playerIdx); } if(action==='pong'){ const meld=[tile]; for(let i=0;i<2;i++){const idx=p.hand.findIndex(t=>tilesMatch(t,tile)); if(idx>=0) meld.push(p.hand.splice(idx,1)[0]);} this.gs.players[this.gs.lastDiscardPlayer].discards.pop(); p.melds.push({type:'pong',tiles:meld,exposed:true}); } if(action==='kong'){ const meld=[tile]; for(let i=0;i<3;i++){const idx=p.hand.findIndex(t=>tilesMatch(t,tile)); if(idx>=0) meld.push(p.hand.splice(idx,1)[0]);} this.gs.players[this.gs.lastDiscardPlayer].discards.pop(); p.melds.push({type:'kong',tiles:meld,exposed:true}); this.gs.drawReplacement(playerIdx); } if(action==='chi'){ const combo=getChiCombinations(p,tile,this.gs.lastDiscardPlayer,playerIdx)[combination]||[]; const meld=[tile]; for(const n of combo){ if(n===tile.num) continue; const idx=p.hand.findIndex(t=>t.suit===tile.suit&&t.num===n); if(idx>=0) meld.push(p.hand.splice(idx,1)[0]); } this.gs.players[this.gs.lastDiscardPlayer].discards.pop(); meld.sort((a,b)=>(a.num||0)-(b.num||0)); p.melds.push({type:'chi',tiles:meld,exposed:true}); } sortHand(p.hand); this.gs.lastDiscard=null; this.gs.currentPlayer=playerIdx; this.gs.phase='discard'; this.sendGameStateToAll(); if(p.isAI) this.aiTurnSoon(); }
  nextTurn() { this.gs.currentPlayer=(this.gs.currentPlayer+1)%4; this.gs.phase='discard'; if(!this.gs.wall.length) return this.endGame(-1); this.gs.drawTile(this.gs.currentPlayer); sortHand(this.gs.players[this.gs.currentPlayer].hand); this.sendGameStateToAll(); if(this.gs.players[this.gs.currentPlayer].isAI) this.aiTurnSoon(); }
  aiTurnSoon() { setTimeout(()=>this.aiTurn(), 250); }
  aiTurn() { const i=this.gs.currentPlayer, p=this.gs.players[i]; if(this.gs.phase!=='discard'||!p.isAI) return; if(canMahjong(p)){ this.gs.winType='tsumo'; return this.endGame(i); } const idx=aiChooseDiscard(p); if(idx>=0) this.handleDiscard(i,p.hand[idx].id); }
  endGame(winnerIdx) { this.gs.phase='ended'; if(winnerIdx>=0){ const scoring=this.gs.calculateScore(winnerIdx); this.broadcast({type:'gameOver', winner:winnerIdx, winnerName:this.gs.players[winnerIdx].name, winType:this.gs.winType, scores:this.gs.players.map(p=>p.score), scoring, hands:this.gs.players.map(p=>p.hand)}); } else this.broadcast({type:'gameOver', winner:-1, winType:'draw', scores:this.gs.players.map(p=>p.score), hands:this.gs.players.map(p=>p.hand)}); }
  onMessage(ws, raw) { let msg; try { msg=JSON.parse(raw); } catch { return; } if(msg.type==='create'||msg.type==='join'){ return this.sendRoomInfo(); } if(msg.type==='start'){ if(ws._seatIdx===0) this.startGame(); } if(msg.type==='discard') this.handleDiscard(ws._seatIdx,msg.tileId); if(msg.type==='skip') this.handleClaim(ws._seatIdx,'skip'); if(msg.type==='claim') this.handleClaim(ws._seatIdx,msg.action,msg.combination); if(msg.type==='mahjong') this.handleClaim(ws._seatIdx,'mahjong'); if(msg.type==='restart' && ws._seatIdx===0){ this.gs.reset(); this.sendRoomInfo(); } if(msg.type==='chat') this.broadcast({type:'chat',from:ws._name,text:String(msg.text||'').slice(0,200)}); }
  onClose(ws) { this.sessions.delete(ws); const c=this.clients[ws._seatIdx]; if(c){ c.connected=false; this.broadcast({type:'playerLeft',name:c.name,seat:c.seatIdx}); } }
}

async function signLiveKitToken(env, room, identity, name) {
  if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET || !env.LIVEKIT_URL) throw new Error('LiveKit env vars missing');
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { iss: env.LIVEKIT_API_KEY, sub: identity, name, nbf: now - 10, exp: now + 60 * 60, video: { room, roomJoin: true, canPublish: true, canSubscribe: true } };
  const enc = obj => btoa(JSON.stringify(obj)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const data = `${enc(header)}.${enc(payload)}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.LIVEKIT_API_SECRET), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sig64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  return `${data}.${sig64}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' } });
    if (url.pathname === '/api/rooms' && request.method === 'POST') return json({ room: generateRoomCode() });
    if (url.pathname === '/api/livekit-token' && request.method === 'POST') {
      try { const body = await request.json(); const room = `mahjong-${String(body.room||'').toUpperCase()}`; const identity = String(body.identity || crypto.randomUUID()).slice(0,80); const token = await signLiveKitToken(env, room, identity, String(body.name || identity).slice(0,80)); return json({ url: env.LIVEKIT_URL, room, token }); }
      catch (err) { return json({ error: err.message }, { status: 503 }); }
    }
    if (url.pathname.startsWith('/ws/')) { const room = url.pathname.split('/').pop().toUpperCase(); const id = env.MAHJONG_ROOM.idFromName(room); return env.MAHJONG_ROOM.get(id).fetch(request); }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return json({ ok: true, service: 'cubes-mahjong-worker' });
  }
};
