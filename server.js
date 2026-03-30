const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8877;

// ============================================================
// TILE DEFINITIONS
// ============================================================
const WINDS = ['East', 'South', 'West', 'North'];
const DRAGONS = ['Red', 'Green', 'White'];
const FLOWERS = ['Plum', 'Orchid', 'Chrysanthemum', 'Bamboo'];
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

function createTileSet() {
  const tiles = [];
  let id = 0;
  for (const suit of ['bamboo', 'dots', 'characters']) {
    for (let num = 1; num <= 9; num++) {
      for (let i = 0; i < 4; i++) tiles.push({ id: id++, suit, num, type: 'suited' });
    }
  }
  for (const wind of WINDS) {
    for (let i = 0; i < 4; i++) tiles.push({ id: id++, suit: 'winds', wind, type: 'honor' });
  }
  for (const dragon of DRAGONS) {
    for (let i = 0; i < 4; i++) tiles.push({ id: id++, suit: 'dragons', dragon, type: 'honor' });
  }
  for (const flower of FLOWERS) tiles.push({ id: id++, suit: 'flowers', flower, type: 'bonus' });
  for (const season of SEASONS) tiles.push({ id: id++, suit: 'flowers', season, type: 'bonus' });
  return tiles;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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

function tilesMatch(a, b) {
  if (a.suit !== b.suit) return false;
  if (a.num !== undefined) return a.num === b.num;
  if (a.wind) return a.wind === b.wind;
  if (a.dragon) return a.dragon === b.dragon;
  return false;
}

function countMatching(hand, tile) { return hand.filter(t => tilesMatch(t, tile)).length; }

function getTileKey(tile) {
  if (tile.num !== undefined) return `${tile.suit}-${tile.num}`;
  if (tile.wind) return `winds-${tile.wind}`;
  if (tile.dragon) return `dragons-${tile.dragon}`;
  return `${tile.suit}-${tile.flower || tile.season}`;
}

// ============================================================
// WIN DETECTION
// ============================================================
function canFormSets(tiles, numSets) {
  if (tiles.length === 0) return numSets === 0;
  if (tiles.length !== numSets * 3) return false;
  const sorted = [...tiles].sort((a, b) => getTileSortKey(a) - getTileSortKey(b));
  // Try triplet
  if (sorted.length >= 3 && tilesMatch(sorted[0], sorted[1]) && tilesMatch(sorted[1], sorted[2])) {
    if (canFormSets(sorted.slice(3), numSets - 1)) return true;
  }
  // Try sequence
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
      if (i > 0 && tilesMatch(sorted[i], sorted[i - 1])) continue;
      const remaining = [...sorted];
      remaining.splice(i, 2);
      if (canFormSets(remaining, setsNeeded)) return true;
    }
  }
  return false;
}

function canMahjong(player, extraTile = null) {
  const hand = [...player.hand];
  if (extraTile) hand.push(extraTile);
  return checkWinningHand(hand, 4 - player.melds.length);
}

// ============================================================
// CLAIMING HELPERS
// ============================================================
function getChiCombinations(player, tile, fromPlayerIdx, playerIdx) {
  if (tile.type !== 'suited') return [];
  if ((playerIdx + 3) % 4 !== fromPlayerIdx) return []; // chi only from left
  const hand = player.hand;
  const combos = [];
  const hasN = (n) => hand.some(t => t.suit === tile.suit && t.num === n);
  const num = tile.num;
  if (num >= 3 && hasN(num - 2) && hasN(num - 1)) combos.push([num - 2, num - 1, num]);
  if (num >= 2 && num <= 8 && hasN(num - 1) && hasN(num + 1)) combos.push([num - 1, num, num + 1]);
  if (num <= 7 && hasN(num + 1) && hasN(num + 2)) combos.push([num, num + 1, num + 2]);
  return combos;
}

function canPong(player, tile) { return countMatching(player.hand, tile) >= 2; }
function canKong(player, tile) { return countMatching(player.hand, tile) >= 3; }

function getConcealedKongs(player) {
  const counts = {};
  const kongs = [];
  for (const tile of player.hand) {
    const key = getTileKey(tile);
    counts[key] = (counts[key] || 0) + 1;
    if (counts[key] === 4) kongs.push({ tile, key });
  }
  return kongs;
}

// ============================================================
// AI LOGIC
// ============================================================
function evaluateTileValue(hand, tile) {
  const matchCount = countMatching(hand, tile);
  let value = 0;
  if (matchCount >= 3) value += 50;
  else if (matchCount >= 2) value += 30;
  else if (matchCount === 1) value += 5;
  if (tile.type === 'suited') {
    const hasN = (n) => n >= 1 && n <= 9 && hand.some(t => t.suit === tile.suit && t.num === n);
    if (hasN(tile.num - 1)) value += 15;
    if (hasN(tile.num + 1)) value += 15;
    if (hasN(tile.num - 2)) value += 8;
    if (hasN(tile.num + 2)) value += 8;
    if (tile.num >= 4 && tile.num <= 6) value += 5;
    if (tile.num === 1 || tile.num === 9) value -= 3;
  }
  if (tile.type === 'honor' && matchCount === 1) value -= 5;
  return value;
}

function aiChooseDiscard(player) {
  const evals = player.hand.map((tile, i) => ({ i, value: evaluateTileValue(player.hand, tile) }));
  evals.sort((a, b) => a.value - b.value);
  const candidates = evals.slice(0, Math.min(3, evals.length));
  return candidates[Math.floor(Math.random() * candidates.length)].i;
}

// ============================================================
// GAME STATE (per room)
// ============================================================
class GameState {
  constructor() { this.reset(); }

  reset() {
    this.wall = [];
    this.deadWall = [];
    this.players = [
      { hand: [], melds: [], flowers: [], discards: [], score: 25000, isAI: true, name: 'AI East' },
      { hand: [], melds: [], flowers: [], discards: [], score: 25000, isAI: true, name: 'AI South' },
      { hand: [], melds: [], flowers: [], discards: [], score: 25000, isAI: true, name: 'AI West' },
      { hand: [], melds: [], flowers: [], discards: [], score: 25000, isAI: true, name: 'AI North' },
    ];
    this.currentPlayer = 0;
    this.phase = 'waiting'; // waiting | discard | claiming | ended
    this.lastDiscard = null;
    this.lastDiscardPlayer = -1;
    this.drawnTile = null;
    this.claimResponses = {}; // playerIdx -> response
    this.claimTimer = null;
    this.winType = null;
  }

  dealTiles() {
    this.wall = shuffle(createTileSet());
    this.deadWall = this.wall.splice(0, 14);
    for (let round = 0; round < 3; round++) {
      for (let p = 0; p < 4; p++) {
        for (let i = 0; i < 4; i++) this.players[p].hand.push(this.wall.shift());
      }
    }
    for (let p = 0; p < 4; p++) this.players[p].hand.push(this.wall.shift());
    // Dealer gets extra tile
    this.players[0].hand.push(this.wall.shift());
    // Handle flowers
    for (let p = 0; p < 4; p++) this.handleFlowers(p);
    for (let p = 0; p < 4; p++) sortHand(this.players[p].hand);
  }

  handleFlowers(playerIdx) {
    const player = this.players[playerIdx];
    while (true) {
      const idx = player.hand.findIndex(t => t.type === 'bonus');
      if (idx === -1) break;
      player.flowers.push(player.hand.splice(idx, 1)[0]);
      if (this.wall.length > 0) player.hand.push(this.wall.shift());
    }
    sortHand(player.hand);
  }

  drawTile(playerIdx) {
    if (this.wall.length === 0) return null;
    const tile = this.wall.shift();
    this.players[playerIdx].hand.push(tile);
    this.drawnTile = tile;
    this.handleFlowers(playerIdx);
    return tile;
  }

  drawReplacement(playerIdx) {
    if (this.deadWall.length === 0 && this.wall.length === 0) return null;
    const tile = this.deadWall.length > 0 ? this.deadWall.shift() : this.wall.shift();
    this.players[playerIdx].hand.push(tile);
    this.drawnTile = tile;
    this.handleFlowers(playerIdx);
    return tile;
  }

  getPlayerState(playerIdx) {
    return {
      hand: this.players[playerIdx].hand,
      melds: this.players.map(p => p.melds),
      flowers: this.players.map(p => p.flowers),
      discards: this.players.map(p => p.discards),
      handCounts: this.players.map(p => p.hand.length),
      scores: this.players.map(p => p.score),
      currentPlayer: this.currentPlayer,
      phase: this.phase,
      lastDiscard: this.lastDiscard,
      lastDiscardPlayer: this.lastDiscardPlayer,
      tilesLeft: this.wall.length + this.deadWall.length,
      drawnTileId: this.drawnTile ? this.drawnTile.id : null,
      playerNames: this.players.map(p => p.name),
      playerIsAI: this.players.map(p => p.isAI),
      playerAvatars: this.players.map(p => p.avatar || 'chen'),
    };
  }

  calculateScore(winnerIdx) {
    let basePoints = 8 + this.players[winnerIdx].flowers.length;
    if (this.winType === 'tsumo') basePoints += 1;
    const value = basePoints * 4;
    return { basePoints, value, totalWin: value * 3 };
  }
}

// ============================================================
// ROOM MANAGEMENT
// ============================================================
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms.has(code));
  return code;
}

class Room {
  constructor(code, hostWs, hostName) {
    this.code = code;
    this.roomSettings = {}; // tile accent, mat, background from host
    this.state = 'waiting'; // waiting | playing | ended
    this.gs = new GameState();
    this.clients = []; // { ws, name, seatIdx, connected }
    this.addClient(hostWs, hostName);
  }

  addClient(ws, name) {
    const seatIdx = this.clients.length;
    const client = { ws, name, seatIdx, connected: true };
    this.clients.push(client);
    ws._room = this;
    ws._seatIdx = seatIdx;
    ws._name = name;
    return seatIdx;
  }

  findClientByWs(ws) { return this.clients.find(c => c.ws === ws); }

  broadcast(msg) {
    const str = JSON.stringify(msg);
    for (const c of this.clients) {
      if (c.connected && c.ws.readyState === 1) c.ws.send(str);
    }
  }

  sendTo(seatIdx, msg) {
    const c = this.clients[seatIdx];
    if (c && c.connected && c.ws.readyState === 1) {
      c.ws.send(JSON.stringify(msg));
    }
  }

  sendRoomInfo() {
    for (const c of this.clients) {
      this.sendTo(c.seatIdx, {
        type: 'room',
        room: this.code,
        players: this.clients.map(cl => ({ name: cl.name, seat: cl.seatIdx, connected: cl.connected })),
        you: c.seatIdx,
        isHost: c.seatIdx === 0,
      });
    }
  }

  sendGameStateToAll() {
    for (const c of this.clients) {
      if (!c.connected) continue;
      const state = this.gs.getPlayerState(c.seatIdx);
      // Add claim options for this specific player
      state.claimOptions = this.getClaimOptions(c.seatIdx);
      // Check if this player can declare tsumo (self-draw win)
      // Only check tsumo for the current player during their discard phase
      var isCurrent = (this.gs.currentPlayer === c.seatIdx);
      var isDiscard = (this.gs.phase === 'discard');
      state.canTsumo = false;
      if (isCurrent && isDiscard) {
        state.canTsumo = canMahjong(this.gs.players[c.seatIdx]);
        if (state.canTsumo) console.log('[MP] canTsumo=true for seat', c.seatIdx, c.name);
      }
      state.roomSettings = this.roomSettings || {};
      this.sendTo(c.seatIdx, { type: 'gameState', ...state });
    }
  }

  getClaimOptions(playerIdx) {
    if (this.gs.phase !== 'claiming' || !this.gs.lastDiscard) return [];
    if (playerIdx === this.gs.lastDiscardPlayer) return [];
    const player = this.gs.players[playerIdx];
    const tile = this.gs.lastDiscard;
    const options = [];
    if (canMahjong(player, tile)) options.push('mahjong');
    if (canKong(player, tile)) options.push('kong');
    if (canPong(player, tile)) options.push('pong');
    if (getChiCombinations(player, tile, this.gs.lastDiscardPlayer, playerIdx).length > 0) options.push('chi');
    return options;
  }

  startGame() {
    this.state = 'playing';
    // Assign human players, fill rest with AI
    for (let i = 0; i < 4; i++) {
      if (i < this.clients.length) {
        this.gs.players[i].isAI = false;
        this.gs.players[i].name = this.clients[i].name;
        this.gs.players[i].avatar = this.clients[i].avatar || 'chen';
      } else {
        this.gs.players[i].isAI = true;
        var cpuNum = i - this.clients.length + 1;
        this.gs.players[i].name = 'CPU ' + cpuNum;
        var cpuAvatars = ['lin','kenji','keni','mei','takeshi','yuna','hao','robot','alien','shiba','panda','dragon','neko'];
        // Pick random avatar not already used by human players
        var usedAvatars = this.clients.map(c => c.avatar);
        var available = cpuAvatars.filter(a => !usedAvatars.includes(a));
        if (available.length === 0) available = cpuAvatars;
        this.gs.players[i].avatar = available[Math.floor(Math.random() * available.length)];
        usedAvatars.push(this.gs.players[i].avatar);
      }
    }
    this.gs.dealTiles();
    this.gs.phase = 'discard';
    this.gs.currentPlayer = 0;
    // Set drawn tile for dealer
    this.gs.drawnTile = this.gs.players[0].hand[this.gs.players[0].hand.length - 1];
    this.sendGameStateToAll();
    // If dealer is AI, make them play
    if (this.gs.players[0].isAI) {
      setTimeout(() => this.aiTurn(), 800);
    }
  }

  // ========== GAME ACTIONS ==========

  handleDiscard(seatIdx, tileIndex) {
    if (this.gs.currentPlayer !== seatIdx) return;
    if (this.gs.phase !== 'discard') return;
    const player = this.gs.players[seatIdx];
    if (tileIndex < 0 || tileIndex >= player.hand.length) return;

    const tile = player.hand.splice(tileIndex, 1)[0];
    player.discards.push(tile);
    this.gs.lastDiscard = tile;
    this.gs.lastDiscardPlayer = seatIdx;
    this.gs.drawnTile = null;
    sortHand(player.hand);

    this.broadcast({ type: 'action', player: seatIdx, action: 'discard', tile });
    this.checkForClaims();
  }

  checkForClaims() {
    const tile = this.gs.lastDiscard;
    let hasClaims = false;

    for (let i = 0; i < 4; i++) {
      if (i === this.gs.lastDiscardPlayer) continue;
      const options = this.getClaimOptions(i);
      if (options.length > 0) hasClaims = true;
    }

    if (hasClaims) {
      this.gs.phase = 'claiming';
      this.gs.claimResponses = {};
      // Auto-skip for AI immediately (with priority logic)
      for (let i = 0; i < 4; i++) {
        if (i === this.gs.lastDiscardPlayer) continue;
        if (this.gs.players[i].isAI) {
          this.handleAIClaim(i);
        }
      }
      this.sendGameStateToAll();
      // Start claim timer (10 seconds)
      this.startClaimTimer();
    } else {
      this.nextTurn();
    }
  }

  handleAIClaim(playerIdx) {
    const options = this.getClaimOptions(playerIdx);
    if (options.includes('mahjong')) {
      this.gs.claimResponses[playerIdx] = { action: 'mahjong' };
    } else if (options.includes('pong') && Math.random() > 0.4) {
      this.gs.claimResponses[playerIdx] = { action: 'pong' };
    } else if (options.includes('chi') && Math.random() > 0.5) {
      this.gs.claimResponses[playerIdx] = { action: 'chi', combination: 0 };
    } else {
      this.gs.claimResponses[playerIdx] = { action: 'skip' };
    }
  }

  handleClaim(seatIdx, action, combination = 0) {
    if (this.gs.phase !== 'claiming') return;
    if (seatIdx === this.gs.lastDiscardPlayer) return;
    this.gs.claimResponses[seatIdx] = { action, combination };
    this.tryResolveClaims();
  }

  handleSkip(seatIdx) {
    if (this.gs.phase !== 'claiming') return;
    this.gs.claimResponses[seatIdx] = { action: 'skip' };
    this.tryResolveClaims();
  }

  startClaimTimer() {
    if (this.gs.claimTimer) clearTimeout(this.gs.claimTimer);
    this.gs.claimTimer = setTimeout(() => {
      // Auto-skip anyone who hasn't responded
      for (let i = 0; i < 4; i++) {
        if (i === this.gs.lastDiscardPlayer) continue;
        if (!this.gs.claimResponses[i]) {
          this.gs.claimResponses[i] = { action: 'skip' };
        }
      }
      this.tryResolveClaims();
    }, 10000);
  }

  tryResolveClaims() {
    // Check if all eligible players have responded
    for (let i = 0; i < 4; i++) {
      if (i === this.gs.lastDiscardPlayer) continue;
      if (!this.gs.claimResponses[i]) return; // still waiting
    }
    if (this.gs.claimTimer) { clearTimeout(this.gs.claimTimer); this.gs.claimTimer = null; }
    this.resolveClaims();
  }

  resolveClaims() {
    const tile = this.gs.lastDiscard;
    const responses = this.gs.claimResponses;

    // Priority: mahjong > kong > pong > chi
    for (const action of ['mahjong', 'kong', 'pong', 'chi']) {
      for (let i = 0; i < 4; i++) {
        if (i === this.gs.lastDiscardPlayer) continue;
        if (responses[i] && responses[i].action === action) {
          this.executeClaim(i, action, responses[i].combination || 0);
          return;
        }
      }
    }
    // All skipped
    this.nextTurn();
  }

  executeClaim(playerIdx, action, combination) {
    const player = this.gs.players[playerIdx];
    const tile = this.gs.lastDiscard;

    if (action === 'mahjong') {
      player.hand.push(tile);
      this.gs.players[this.gs.lastDiscardPlayer].discards.pop();
      this.gs.winType = 'ron';
      this.endGame(playerIdx);
      return;
    }

    if (action === 'pong') {
      const meldTiles = [tile];
      for (let i = 0; i < 2; i++) {
        const idx = player.hand.findIndex(t => tilesMatch(t, tile));
        if (idx >= 0) meldTiles.push(player.hand.splice(idx, 1)[0]);
      }
      this.gs.players[this.gs.lastDiscardPlayer].discards.pop();
      player.melds.push({ type: 'pong', tiles: meldTiles, exposed: true });
      sortHand(player.hand);
      this.broadcast({ type: 'action', player: playerIdx, action: 'pong', tiles: meldTiles });
    }

    if (action === 'kong') {
      const meldTiles = [tile];
      for (let i = 0; i < 3; i++) {
        const idx = player.hand.findIndex(t => tilesMatch(t, tile));
        if (idx >= 0) meldTiles.push(player.hand.splice(idx, 1)[0]);
      }
      this.gs.players[this.gs.lastDiscardPlayer].discards.pop();
      player.melds.push({ type: 'kong', tiles: meldTiles, exposed: true });
      sortHand(player.hand);
      this.gs.drawReplacement(playerIdx);
      this.broadcast({ type: 'action', player: playerIdx, action: 'kong', tiles: meldTiles });
    }

    if (action === 'chi') {
      const combos = getChiCombinations(player, tile, this.gs.lastDiscardPlayer, playerIdx);
      const combo = combos[combination] || combos[0];
      if (!combo) { this.nextTurn(); return; }
      const meldTiles = [tile];
      for (const num of combo) {
        if (num === tile.num) continue;
        const idx = player.hand.findIndex(t => t.suit === tile.suit && t.num === num);
        if (idx >= 0) meldTiles.push(player.hand.splice(idx, 1)[0]);
      }
      this.gs.players[this.gs.lastDiscardPlayer].discards.pop();
      meldTiles.sort((a, b) => (a.num || 0) - (b.num || 0));
      player.melds.push({ type: 'chi', tiles: meldTiles, exposed: true });
      sortHand(player.hand);
      this.broadcast({ type: 'action', player: playerIdx, action: 'chi', tiles: meldTiles });
    }

    this.gs.lastDiscard = null;
    this.gs.currentPlayer = playerIdx;
    this.gs.phase = 'discard';
    this.sendGameStateToAll();

    if (player.isAI) setTimeout(() => this.aiTurn(), 800);
  }

  nextTurn() {
    this.gs.currentPlayer = (this.gs.currentPlayer + 1) % 4;
    this.gs.phase = 'discard';
    this.gs.lastDiscard = null;

    if (this.gs.wall.length === 0) {
      this.endGame(-1); // draw
      return;
    }

    this.gs.drawTile(this.gs.currentPlayer);
    sortHand(this.gs.players[this.gs.currentPlayer].hand);

    // Check for tsumo
    if (canMahjong(this.gs.players[this.gs.currentPlayer])) {
      if (this.gs.players[this.gs.currentPlayer].isAI) {
        this.gs.winType = 'tsumo';
        this.endGame(this.gs.currentPlayer);
        return;
      }
      // Human will see mahjong option in their claim options
    }

    this.sendGameStateToAll();

    if (this.gs.players[this.gs.currentPlayer].isAI) {
      setTimeout(() => this.aiTurn(), 800);
    }
  }

  aiTurn() {
    if (this.gs.phase !== 'discard') return;
    const playerIdx = this.gs.currentPlayer;
    const player = this.gs.players[playerIdx];
    if (!player.isAI) return;

    if (canMahjong(player)) {
      this.gs.winType = 'tsumo';
      this.endGame(playerIdx);
      return;
    }

    const discardIdx = aiChooseDiscard(player);
    if (discardIdx >= 0) this.handleDiscard(playerIdx, discardIdx);
  }

  handleSort(seatIdx) {
    sortHand(this.gs.players[seatIdx].hand);
    this.sendGameStateToAll();
  }

  handleSelfKong(seatIdx, tileIndex) {
    if (this.gs.currentPlayer !== seatIdx || this.gs.phase !== 'discard') return;
    const player = this.gs.players[seatIdx];
    const tile = player.hand[tileIndex];
    if (!tile) return;

    const kongs = getConcealedKongs(player);
    const match = kongs.find(k => tilesMatch(k.tile, tile));
    if (!match) return;

    const meldTiles = [];
    for (let i = 0; i < 4; i++) {
      const idx = player.hand.findIndex(t => tilesMatch(t, tile));
      if (idx >= 0) meldTiles.push(player.hand.splice(idx, 1)[0]);
    }
    player.melds.push({ type: 'kong', tiles: meldTiles, exposed: false, concealed: true });
    sortHand(player.hand);
    this.gs.drawReplacement(seatIdx);
    this.broadcast({ type: 'action', player: seatIdx, action: 'concealedKong', tiles: meldTiles });
    this.sendGameStateToAll();
    // If AI, continue
    if (player.isAI) setTimeout(() => this.aiTurn(), 800);
  }

  handleMahjong(seatIdx) {
    const player = this.gs.players[seatIdx];
    if (this.gs.phase === 'claiming' && this.gs.lastDiscard) {
      // Claiming someone's discard
      this.handleClaim(seatIdx, 'mahjong');
    } else if (this.gs.currentPlayer === seatIdx && canMahjong(player)) {
      // Self-draw win
      this.gs.winType = 'tsumo';
      this.endGame(seatIdx);
    }
  }

  endGame(winnerIdx) {
    this.gs.phase = 'ended';
    this.state = 'ended';
    if (this.gs.claimTimer) { clearTimeout(this.gs.claimTimer); this.gs.claimTimer = null; }

    if (winnerIdx >= 0) {
      const scoring = this.gs.calculateScore(winnerIdx);
      for (let i = 0; i < 4; i++) {
        if (i === winnerIdx) this.gs.players[i].score += scoring.totalWin;
        else this.gs.players[i].score -= scoring.value;
      }
      this.broadcast({
        type: 'gameOver',
        winner: winnerIdx,
        winnerName: this.gs.players[winnerIdx].name,
        winType: this.gs.winType,
        scores: this.gs.players.map(p => p.score),
        scoring,
        // Reveal all hands
        hands: this.gs.players.map(p => p.hand),
      });
    } else {
      this.broadcast({
        type: 'gameOver',
        winner: -1,
        winType: 'draw',
        scores: this.gs.players.map(p => p.score),
        hands: this.gs.players.map(p => p.hand),
      });
    }
  }

  handleDisconnect(ws) {
    const client = this.findClientByWs(ws);
    if (client) {
      client.connected = false;
      this.broadcast({ type: 'playerLeft', name: client.name, seat: client.seatIdx });
      // If game is playing, convert to AI
      if (this.state === 'playing') {
        this.gs.players[client.seatIdx].isAI = true;
        if (this.gs.currentPlayer === client.seatIdx && this.gs.phase === 'discard') {
          setTimeout(() => this.aiTurn(), 500);
        }
      }
    }
  }

  handleReconnect(ws, name, seatIdx) {
    const client = this.clients[seatIdx];
    if (client && client.name === name) {
      client.ws = ws;
      client.connected = true;
      ws._room = this;
      ws._seatIdx = seatIdx;
      ws._name = name;
      this.gs.players[seatIdx].isAI = false;
      this.broadcast({ type: 'playerRejoined', name, seat: seatIdx });
      this.sendRoomInfo();
      if (this.state === 'playing') this.sendGameStateToAll();
      return true;
    }
    return false;
  }
}

// ============================================================
// HTTP SERVER (serves static files + WebSocket)
// ============================================================
const MIME_TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? '/index-3d.html' : req.url);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'create': {
        const code = generateRoomCode();
        ws._avatar = msg.avatar || 'chen';
        const room = new Room(code, ws, msg.name || 'Host');
        rooms.set(code, room);
        room.sendRoomInfo();
        console.log(`Room ${code} created by ${msg.name}`);
        break;
      }

      case 'join': {
        const room = rooms.get((msg.room || '').toUpperCase());
        if (!room) { ws.send(JSON.stringify({ type: 'error', message: 'Room not found' })); break; }
        if (room.state !== 'waiting') {
          // Try reconnect
          if (msg.seat !== undefined && room.handleReconnect(ws, msg.name, msg.seat)) break;
          ws.send(JSON.stringify({ type: 'error', message: 'Game already in progress' }));
          break;
        }
        if (room.clients.length >= 4) { ws.send(JSON.stringify({ type: 'error', message: 'Room is full' })); break; }
        room.addClient(ws, msg.name || 'Player');
        room.sendRoomInfo();
        console.log(`${msg.name} joined room ${msg.room}`);
        break;
      }

      case 'settings': {
        // Host sends room style settings
        const settingsRoom = ws._room;
        if (settingsRoom && settingsRoom.clients[0] && settingsRoom.clients[0].ws === ws) {
          settingsRoom.roomSettings = {
            tileAccent: msg.tileAccent || '#C0A878',
            mat: msg.mat || 'default',
            matCustom: msg.matCustom || null,
            background: msg.background || 'wood',
          };
          // Broadcast to all clients in room
          for (const c of settingsRoom.clients) {
            if (c.connected) {
              c.ws.send(JSON.stringify({ type: 'roomSettings', ...settingsRoom.roomSettings }));
            }
          }
        }
        break;
      }
      case 'start': {
        const room = ws._room;
        console.log(`Start requested: room=${room?.code}, seatIdx=${ws._seatIdx}, state=${room?.state}`);
        if (!room || ws._seatIdx !== 0) { 
          console.log(`Start rejected: no room or not host (seatIdx=${ws._seatIdx})`);
          ws.send(JSON.stringify({ type: 'error', message: 'Only the host can start the game' }));
          break; 
        }
        if (room.state !== 'waiting') break;
        room.startGame();
        console.log(`Room ${room.code} game started with ${room.clients.length} players`);
        break;
      }

      case 'discard': {
        const room = ws._room;
        if (!room) break;
        room.handleDiscard(ws._seatIdx, msg.tileIndex);
        break;
      }

      case 'claim': {
        const room = ws._room;
        if (!room) break;
        room.handleClaim(ws._seatIdx, msg.action, msg.combination);
        break;
      }

      case 'skip': {
        const room = ws._room;
        if (!room) break;
        room.handleSkip(ws._seatIdx);
        break;
      }

      case 'mahjong': {
        const room = ws._room;
        if (!room) break;
        room.handleMahjong(ws._seatIdx);
        break;
      }

      case 'concealedKong': {
        const room = ws._room;
        if (!room) break;
        room.handleSelfKong(ws._seatIdx, msg.tileIndex);
        break;
      }

      case 'sort': {
        const room = ws._room;
        if (!room) break;
        room.handleSort(ws._seatIdx);
        break;
      }

      case 'chat': {
        const room = ws._room;
        if (!room) break;
        room.broadcast({ type: 'chat', from: ws._name, text: (msg.text || '').slice(0, 200) });
        break;
      }

      case 'restart': {
        const room = ws._room;
        if (!room || ws._seatIdx !== 0) break;
        room.gs.reset();
        room.state = 'waiting';
        room.sendRoomInfo();
        break;
      }
    }
  });

  ws.on('close', () => {
    const room = ws._room;
    if (room) room.handleDisconnect(ws);
    console.log('Client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`🀄 Cubes Mahjong server running on port ${PORT}`);
  console.log(`   Local:  http://localhost:${PORT}`);
  console.log(`   Public: https://adrians-mac-studio.tail6ac012.ts.net:${PORT}`);
});
