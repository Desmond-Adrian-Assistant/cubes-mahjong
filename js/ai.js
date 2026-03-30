import { PLAYER_NAMES, PLAYER_EMOJIS } from './constants.js';
import { game, sortHand, tilesMatch, countMatching, markLastDiscardClaimed } from './game-state.js';
import {
  canMahjong, getConcealedKongs, getAddKongs,
  declareConcealedKong, declareAddKong,
  discardTile, endGame, drawReplacementTile, handleFlowers,
  getChiCombinations, nextTurn
} from './game-logic.js';
import { renderAll } from './renderer.js';
import { showAIToast, showToast } from './ui.js';

export function evaluateTileValue(hand, tile, melds = []) {
  const matchCount = countMatching(hand, tile);
  let value = 0;

  if (matchCount >= 3) value += 50;
  else if (matchCount >= 2) value += 30;
  else if (matchCount === 1) value += 5;

  if (tile.type === 'suited') {
    const num = tile.num;
    const suit = tile.suit;

    const hasN = (n) => n >= 1 && n <= 9 && hand.some(t => t.suit === suit && t.num === n);

    if (hasN(num - 1)) value += 15;
    if (hasN(num + 1)) value += 15;
    if (hasN(num - 2)) value += 8;
    if (hasN(num + 2)) value += 8;

    if (num >= 4 && num <= 6) value += 5;
    if (num === 1 || num === 9) value -= 3;
  }

  if (tile.type === 'honor') {
    if (matchCount === 1) value -= 5;
  }

  return value;
}

export function aiChooseDiscard(playerIndex) {
  const player = game.players[playerIndex];
  const hand = player.hand;

  if (hand.length === 0) return -1;

  const evaluations = hand.map((tile, index) => ({
    index,
    tile,
    value: evaluateTileValue(hand, tile, player.melds)
  }));

  evaluations.sort((a, b) => a.value - b.value);

  const candidates = evaluations.slice(0, Math.min(3, evaluations.length));
  const choice = candidates[Math.floor(Math.random() * candidates.length)];

  return choice.index;
}

export function aiShouldClaimChi(playerIndex, tile, combinations) {
  if (Math.random() > 0.5) return false;
  const player = game.players[playerIndex];
  if (player.melds.length >= 2) return true;
  return true;
}

export function aiTurn() {
  if (game.phase !== 'discard') return;

  const playerIndex = game.currentPlayer;
  const player = game.players[playerIndex];
  if (!player.isAI) return;

  if (canMahjong(playerIndex)) {
    game.winType = 'tsumo';
    endGame('win', playerIndex);
    return;
  }

  const concealedKongs = getConcealedKongs(playerIndex);
  if (concealedKongs.length > 0 && Math.random() > 0.3) {
    const kong = concealedKongs[0];
    declareConcealedKong(playerIndex, kong.tile);
    return;
  }

  const addKongs = getAddKongs(playerIndex);
  if (addKongs.length > 0 && Math.random() > 0.4) {
    declareAddKong(playerIndex, addKongs[0]);
    return;
  }

  const discardIdx = aiChooseDiscard(playerIndex);
  if (discardIdx >= 0) {
    discardTile(playerIndex, discardIdx);
  }
}

export function processAIClaims() {
  if (!game.claimWindow) return;

  const tile = game.lastDiscard;

  for (const claim of game.possibleClaims) {
    if (claim.player === 1) continue;
    if (claim.claims.includes('mahjong')) {
      aiClaimMahjong(claim.player);
      return;
    }
  }

  for (const claim of game.possibleClaims) {
    if (claim.player === 1) continue;
    if (claim.claims.includes('kong')) {
      aiClaimKong(claim.player, tile);
      return;
    }
  }

  for (const claim of game.possibleClaims) {
    if (claim.player === 1) continue;
    if (claim.claims.includes('pong')) {
      aiClaimPong(claim.player, tile);
      return;
    }
  }

  for (const claim of game.possibleClaims) {
    if (claim.player === 1) continue;
    if (claim.claims.includes('chi')) {
      const combinations = getChiCombinations(claim.player, tile);
      if (combinations.length > 0 && aiShouldClaimChi(claim.player, tile, combinations)) {
        aiClaimChi(claim.player, tile, combinations[0]);
        return;
      }
    }
  }

  game.claimWindow = false;
  nextTurn();
}

export function aiClaimPong(playerIndex, tile) {
  const player = game.players[playerIndex];

  const pongTiles = [tile];
  for (let i = 0; i < 2; i++) {
    const idx = player.hand.findIndex(t => tilesMatch(t, tile));
    if (idx >= 0) {
      pongTiles.push(player.hand.splice(idx, 1)[0]);
    }
  }

  markLastDiscardClaimed();
  game.players[game.lastDiscardPlayer].discards.pop();
  player.melds.push({ type: 'pong', tiles: pongTiles, exposed: true });

  sortHand(player.hand);
  game.claimWindow = false;
  game.currentPlayer = playerIndex;
  game.phase = 'discard';
  game.lastDiscard = null;
  game.justClaimed = true;

  showAIToast(`${PLAYER_EMOJIS[playerIndex]} ${PLAYER_NAMES[playerIndex]} Pung!`);
  renderAll();

  setTimeout(() => aiTurn(), 800);
}

export function aiClaimChi(playerIndex, tile, combination) {
  const player = game.players[playerIndex];

  const chiTiles = [tile];
  for (const t of combination.tiles) {
    if (t.id !== tile.id) {
      const idx = player.hand.findIndex(h => h.id === t.id);
      if (idx >= 0) {
        chiTiles.push(player.hand.splice(idx, 1)[0]);
      }
    }
  }

  markLastDiscardClaimed();
  game.players[game.lastDiscardPlayer].discards.pop();
  chiTiles.sort((a, b) => (a.num || 0) - (b.num || 0));
  player.melds.push({ type: 'chi', tiles: chiTiles, exposed: true });

  sortHand(player.hand);
  game.claimWindow = false;
  game.currentPlayer = playerIndex;
  game.phase = 'discard';
  game.lastDiscard = null;
  game.justClaimed = true;

  showAIToast(`${PLAYER_EMOJIS[playerIndex]} ${PLAYER_NAMES[playerIndex]} Chow!`);
  renderAll();

  setTimeout(() => aiTurn(), 800);
}

export function aiClaimKong(playerIndex, tile) {
  const player = game.players[playerIndex];

  const kongTiles = [tile];
  for (let i = 0; i < 3; i++) {
    const idx = player.hand.findIndex(t => tilesMatch(t, tile));
    if (idx >= 0) {
      kongTiles.push(player.hand.splice(idx, 1)[0]);
    }
  }

  markLastDiscardClaimed();
  game.players[game.lastDiscardPlayer].discards.pop();
  player.melds.push({ type: 'kong', tiles: kongTiles, exposed: true });

  sortHand(player.hand);
  game.claimWindow = false;
  game.currentPlayer = playerIndex;

  const replacement = drawReplacementTile(playerIndex);
  if (replacement) {
    game.drawnTile = replacement;
    handleFlowers(playerIndex);
    sortHand(player.hand);
  }

  game.phase = 'discard';
  game.lastDiscard = null;

  showAIToast(`${PLAYER_EMOJIS[playerIndex]} ${PLAYER_NAMES[playerIndex]} Kong!`);
  renderAll();

  setTimeout(() => aiTurn(), 1000);
}

export function aiClaimMahjong(playerIndex) {
  const player = game.players[playerIndex];
  player.hand.push(game.lastDiscard);

  markLastDiscardClaimed();
  game.players[game.lastDiscardPlayer].discards.pop();
  game.claimWindow = false;
  game.winType = 'ron';
  endGame('win', playerIndex);
}
