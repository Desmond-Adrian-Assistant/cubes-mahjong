import { WINDS, DRAGONS, FLOWERS, SEASONS } from './constants.js';

export let game = {
  wall: [],
  deadWall: [],
  discardHistory: [], // append-only log: { tile, claimed: false }
  players: [
    { seat: 'east', hand: [], melds: [], flowers: [], discards: [], score: 25000, isAI: true },
    { seat: 'south', hand: [], melds: [], flowers: [], discards: [], score: 25000, isAI: false },
    { seat: 'west', hand: [], melds: [], flowers: [], discards: [], score: 25000, isAI: true },
    { seat: 'north', hand: [], melds: [], flowers: [], discards: [], score: 25000, isAI: true }
  ],
  currentPlayer: 0,
  dealerSeat: 0,
  roundWind: 'East',
  lastDiscard: null,
  lastDiscardPlayer: -1,
  drawnTile: null,
  phase: 'waiting',
  claimWindow: false,
  possibleClaims: [],
  selectedTileIndex: -1,
  claimTimeoutId: null,
  claimTimeRemaining: 10,
  justClaimed: false,
  kongInProgress: false,
  pendingKongTile: null,
  winType: null
};

export function resetGame() {
  game = {
    wall: [],
    deadWall: [],
    discardHistory: [],
    players: [
      { seat: 'east', hand: [], melds: [], flowers: [], discards: [], score: game.players[0].score, isAI: true },
      { seat: 'south', hand: [], melds: [], flowers: [], discards: [], score: game.players[1].score, isAI: false },
      { seat: 'west', hand: [], melds: [], flowers: [], discards: [], score: game.players[2].score, isAI: true },
      { seat: 'north', hand: [], melds: [], flowers: [], discards: [], score: game.players[3].score, isAI: true }
    ],
    currentPlayer: 0,
    dealerSeat: 0,
    roundWind: 'East',
    lastDiscard: null,
    lastDiscardPlayer: -1,
    drawnTile: null,
    phase: 'waiting',
    claimWindow: false,
    possibleClaims: [],
    selectedTileIndex: -1,
    claimTimeoutId: null,
    claimTimeRemaining: 10,
    justClaimed: false,
    kongInProgress: false,
    pendingKongTile: null,
    winType: null
  };
}

export function createTileSet() {
  const tiles = [];
  let id = 0;

  for (const suit of ['bamboo', 'dots', 'characters']) {
    for (let num = 1; num <= 9; num++) {
      for (let i = 0; i < 4; i++) {
        tiles.push({ id: id++, suit, num, type: 'suited' });
      }
    }
  }

  for (const wind of WINDS) {
    for (let i = 0; i < 4; i++) {
      tiles.push({ id: id++, suit: 'winds', wind, type: 'honor' });
    }
  }

  for (const dragon of DRAGONS) {
    for (let i = 0; i < 4; i++) {
      tiles.push({ id: id++, suit: 'dragons', dragon, type: 'honor' });
    }
  }

  for (const flower of FLOWERS) {
    tiles.push({ id: id++, suit: 'flowers', flower, type: 'bonus' });
  }

  for (const season of SEASONS) {
    tiles.push({ id: id++, suit: 'flowers', season, type: 'bonus' });
  }

  return tiles;
}

export function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function getTileSortKey(tile) {
  const suitOrder = { bamboo: 0, dots: 1, characters: 2, winds: 3, dragons: 4, flowers: 5 };
  let key = suitOrder[tile.suit] * 100;
  if (tile.num) key += tile.num;
  if (tile.wind) key += WINDS.indexOf(tile.wind);
  if (tile.dragon) key += DRAGONS.indexOf(tile.dragon);
  if (tile.flower) key += FLOWERS.indexOf(tile.flower);
  if (tile.season) key += SEASONS.indexOf(tile.season) + 4;
  return key;
}

export function getTileKey(tile) {
  if (tile.num !== undefined) return `${tile.suit}-${tile.num}`;
  if (tile.wind) return `winds-${tile.wind}`;
  if (tile.dragon) return `dragons-${tile.dragon}`;
  return `${tile.suit}-${tile.flower || tile.season}`;
}

export function sortHand(hand) {
  return hand.sort((a, b) => getTileSortKey(a) - getTileSortKey(b));
}

export function tilesMatch(a, b) {
  if (a.suit !== b.suit) return false;
  if (a.num !== undefined) return a.num === b.num;
  if (a.wind) return a.wind === b.wind;
  if (a.dragon) return a.dragon === b.dragon;
  return false;
}

export function countMatching(hand, tile) {
  return hand.filter(t => tilesMatch(t, tile)).length;
}

// Mark the most recent discard as claimed in the history (keeps grid stable)
export function markLastDiscardClaimed() {
  for (let i = game.discardHistory.length - 1; i >= 0; i--) {
    if (!game.discardHistory[i].claimed) {
      game.discardHistory[i].claimed = true;
      break;
    }
  }
}
