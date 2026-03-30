import { PLAYER_NAMES, PLAYER_EMOJIS } from './constants.js';
import {
  game, sortHand, tilesMatch, countMatching,
  getTileSortKey, getTileKey, createTileSet, shuffle, resetGame,
  markLastDiscardClaimed
} from './game-state.js';
import { aiTurn, processAIClaims } from './ai.js';
import { renderAll, renderPlayerHand, updateActionButtons, hideActionButtons } from './renderer.js';
import {
  showToast, showAIToast, showModal, hideModal,
  showClaimPanel, hideClaimPanel, showConfetti
} from './ui.js';

// ============================================================
// DEALING & DRAWING
// ============================================================

export function dealTiles() {
  const allTiles = shuffle(createTileSet());
  game.deadWall = allTiles.splice(-14);
  game.wall = allTiles;

  for (let round = 0; round < 3; round++) {
    for (let p = 0; p < 4; p++) {
      for (let i = 0; i < 4; i++) {
        drawTileToHand(p);
      }
    }
  }
  for (let p = 0; p < 4; p++) {
    drawTileToHand(p);
  }
  drawTileToHand(game.dealerSeat);

  for (const p of game.players) {
    sortHand(p.hand);
  }

  for (let p = 0; p < 4; p++) {
    handleFlowers(p);
  }
}

export function drawTileToHand(playerIndex) {
  if (game.wall.length === 0) return null;
  const tile = game.wall.shift();
  game.players[playerIndex].hand.push(tile);
  return tile;
}

export function drawReplacementTile(playerIndex) {
  let tile;
  if (game.deadWall.length > 0) {
    tile = game.deadWall.shift();
  } else if (game.wall.length > 0) {
    tile = game.wall.pop();
  } else {
    return null;
  }
  game.players[playerIndex].hand.push(tile);
  return tile;
}

export function handleFlowers(playerIndex) {
  const player = game.players[playerIndex];
  let hadFlowers = false;

  while (true) {
    const flowerIndex = player.hand.findIndex(t => t.type === 'bonus');
    if (flowerIndex === -1) break;

    const flower = player.hand.splice(flowerIndex, 1)[0];
    player.flowers.push(flower);
    hadFlowers = true;

    const replacement = drawReplacementTile(playerIndex);
    if (!replacement) break;
  }

  if (hadFlowers) {
    sortHand(player.hand);
  }

  return hadFlowers;
}

// ============================================================
// WINNING HAND LOGIC
// ============================================================

export function canMahjong(playerIndex, tile = null) {
  const player = game.players[playerIndex];
  const hand = [...player.hand];
  if (tile) hand.push(tile);

  const numMelds = player.melds.length;
  const setsNeeded = 4 - numMelds;

  return checkWinningHand(hand, setsNeeded);
}

export function checkWinningHand(hand, setsNeeded = 4) {
  const expectedTiles = setsNeeded * 3 + 2;
  if (hand.length < expectedTiles) return false;
  if (hand.length > expectedTiles) return false;

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

export function canFormSets(tiles, numSets) {
  if (tiles.length === 0) return numSets === 0;
  if (tiles.length !== numSets * 3) return false;

  const sorted = [...tiles].sort((a, b) => getTileSortKey(a) - getTileSortKey(b));

  if (sorted.length >= 3 &&
      tilesMatch(sorted[0], sorted[1]) &&
      tilesMatch(sorted[1], sorted[2])) {
    const remaining = sorted.slice(3);
    if (canFormSets(remaining, numSets - 1)) return true;
  }

  if (sorted[0].type === 'suited' && sorted.length >= 3) {
    const t1 = sorted[0];
    const t2Idx = sorted.findIndex((t, i) => i > 0 && t.suit === t1.suit && t.num === t1.num + 1);
    const t3Idx = sorted.findIndex((t, i) => i > 0 && t.suit === t1.suit && t.num === t1.num + 2);

    if (t2Idx > 0 && t3Idx > 0) {
      const remaining = [...sorted];
      const indices = [0, t2Idx, t3Idx].sort((a, b) => b - a);
      for (const idx of indices) remaining.splice(idx, 1);
      if (canFormSets(remaining, numSets - 1)) return true;
    }
  }

  return false;
}

// ============================================================
// CLAIMING LOGIC
// ============================================================

export function getChiCombinations(playerIndex, tile) {
  if (tile.type !== 'suited') return [];

  const leftPlayer = (playerIndex + 3) % 4;
  if (game.lastDiscardPlayer !== leftPlayer) return [];

  const hand = game.players[playerIndex].hand;
  const suit = tile.suit;
  const num = tile.num;
  const combinations = [];

  const hasN = (n) => hand.some(t => t.suit === suit && t.num === n);
  const findTile = (n) => hand.find(t => t.suit === suit && t.num === n);

  if (num >= 3 && hasN(num - 2) && hasN(num - 1)) {
    combinations.push({
      type: 'chi',
      tiles: [findTile(num - 2), findTile(num - 1), tile],
      indices: [num - 2, num - 1, num]
    });
  }

  if (num >= 2 && num <= 8 && hasN(num - 1) && hasN(num + 1)) {
    combinations.push({
      type: 'chi',
      tiles: [findTile(num - 1), tile, findTile(num + 1)],
      indices: [num - 1, num, num + 1]
    });
  }

  if (num <= 7 && hasN(num + 1) && hasN(num + 2)) {
    combinations.push({
      type: 'chi',
      tiles: [tile, findTile(num + 1), findTile(num + 2)],
      indices: [num, num + 1, num + 2]
    });
  }

  return combinations;
}

export function canChi(playerIndex, tile) {
  return getChiCombinations(playerIndex, tile).length > 0;
}

export function canPong(playerIndex, tile) {
  if (game.lastDiscardPlayer === playerIndex) return false;
  return countMatching(game.players[playerIndex].hand, tile) >= 2;
}

export function canKong(playerIndex, tile) {
  if (game.lastDiscardPlayer === playerIndex) return false;
  return countMatching(game.players[playerIndex].hand, tile) >= 3;
}

export function getConcealedKongs(playerIndex) {
  const hand = game.players[playerIndex].hand;
  const counts = {};
  const kongs = [];

  for (const tile of hand) {
    const key = getTileKey(tile);
    counts[key] = (counts[key] || 0) + 1;
    if (counts[key] === 4) {
      kongs.push({ tile, key });
    }
  }

  return kongs;
}

export function getAddKongs(playerIndex) {
  const player = game.players[playerIndex];
  const addKongs = [];

  for (const meld of player.melds) {
    if (meld.type === 'pong') {
      const pongTile = meld.tiles[0];
      const matchInHand = player.hand.find(t => tilesMatch(t, pongTile));
      if (matchInHand) {
        addKongs.push({ meld, tile: matchInHand });
      }
    }
  }

  return addKongs;
}

// ============================================================
// KONG DECLARATIONS
// ============================================================

export function declareConcealedKong(playerIndex, tile) {
  const player = game.players[playerIndex];

  const kongTiles = [];
  for (let i = 0; i < 4; i++) {
    const idx = player.hand.findIndex(t => tilesMatch(t, tile));
    if (idx >= 0) {
      kongTiles.push(player.hand.splice(idx, 1)[0]);
    }
  }

  player.melds.push({ type: 'kong', tiles: kongTiles, exposed: false, concealed: true });

  sortHand(player.hand);

  const replacement = drawReplacementTile(playerIndex);
  if (replacement) {
    game.drawnTile = replacement;
    handleFlowers(playerIndex);
    sortHand(player.hand);
  }

  if (player.isAI) {
    showAIToast(`${PLAYER_EMOJIS[playerIndex]} ${PLAYER_NAMES[playerIndex]} Concealed Kong!`);
  } else {
    showToast('Concealed Kong! 🀄');
  }

  renderAll();

  if (player.isAI) {
    setTimeout(() => aiTurn(), 1000);
  }
}

export function declareAddKong(playerIndex, addKong) {
  const player = game.players[playerIndex];
  const { meld, tile } = addKong;

  game.kongInProgress = true;
  game.pendingKongTile = tile;

  let canRob = false;
  for (let i = 0; i < 4; i++) {
    if (i !== playerIndex && canMahjong(i, tile)) {
      canRob = true;
      break;
    }
  }

  if (canRob) {
    game.lastDiscard = tile;
    game.lastDiscardPlayer = playerIndex;
    checkForKongRob(playerIndex, meld, tile);
    return;
  }

  completeAddKong(playerIndex, meld, tile);
}

export function checkForKongRob(playerIndex, meld, tile) {
  game.possibleClaims = [];

  for (let i = 0; i < 4; i++) {
    if (i === playerIndex) continue;
    if (canMahjong(i, tile)) {
      game.possibleClaims.push({ player: i, claims: ['mahjong'], isRob: true });
    }
  }

  if (game.possibleClaims.length > 0) {
    game.phase = 'claiming';
    game.claimWindow = true;

    const humanClaim = game.possibleClaims.find(c => c.player === 1);
    if (humanClaim) {
      showToast('Rob the Kong? 🀄');
      updateActionButtons();
      startClaimTimer(() => {
        completeAddKong(playerIndex, meld, tile);
      });
      return;
    }

    setTimeout(() => {
      for (const claim of game.possibleClaims) {
        if (claim.player !== 1 && claim.claims.includes('mahjong')) {
          game.players[claim.player].hand.push(tile);
          const tileIdx = game.players[playerIndex].hand.findIndex(t => t.id === tile.id);
          if (tileIdx >= 0) game.players[playerIndex].hand.splice(tileIdx, 1);

          game.kongInProgress = false;
          game.winType = 'rob';
          endGame('win', claim.player);
          return;
        }
      }
      completeAddKong(playerIndex, meld, tile);
    }, 500);
  } else {
    completeAddKong(playerIndex, meld, tile);
  }
}

export function completeAddKong(playerIndex, meld, tile) {
  const player = game.players[playerIndex];

  const tileIdx = player.hand.findIndex(t => t.id === tile.id);
  if (tileIdx >= 0) {
    player.hand.splice(tileIdx, 1);
  }

  meld.type = 'kong';
  meld.tiles.push(tile);

  sortHand(player.hand);
  game.kongInProgress = false;
  game.pendingKongTile = null;

  const replacement = drawReplacementTile(playerIndex);
  if (replacement) {
    game.drawnTile = replacement;
    handleFlowers(playerIndex);
    sortHand(player.hand);
  }

  if (player.isAI) {
    showAIToast(`${PLAYER_EMOJIS[playerIndex]} ${PLAYER_NAMES[playerIndex]} Kong!`);
    renderAll();
    setTimeout(() => aiTurn(), 1000);
  } else {
    showToast('Kong! 🀄');
    renderAll();
  }
}

// ============================================================
// GAME FLOW
// ============================================================

export function startGame() {
  hideModal();
  game.phase = 'waiting';
  game.currentPlayer = game.dealerSeat;

  dealTiles();
  renderAll();

  setTimeout(() => {
    if (game.players[game.currentPlayer].isAI) {
      game.phase = 'discard';
      setTimeout(aiTurn, 1000);
    } else {
      game.phase = 'discard';
      game.drawnTile = game.players[1].hand[game.players[1].hand.length - 1];
      renderAll();
    }
  }, 500);
}

export function drawPhase(playerIndex) {
  if (game.wall.length === 0) {
    endGame('draw');
    return;
  }

  const tile = drawTileToHand(playerIndex);
  game.drawnTile = tile;

  if (handleFlowers(playerIndex)) {
    game.drawnTile = game.players[playerIndex].hand[game.players[playerIndex].hand.length - 1];
  }

  game.phase = 'discard';
  game.justClaimed = false;
  renderAll();

  if (!game.players[playerIndex].isAI) {
    updateActionButtons();
  }
}

export function discardTile(playerIndex, tileIndex, animate = true) {
  const player = game.players[playerIndex];
  const tile = player.hand.splice(tileIndex, 1)[0];

  player.discards.push(tile);
  game.discardHistory.push({ tile, claimed: false });
  game.lastDiscard = tile;
  game.lastDiscardPlayer = playerIndex;
  game.drawnTile = null;
  game.selectedTileIndex = -1;

  sortHand(player.hand);
  renderAll();

  if (animate) {
    const discardEls = document.querySelectorAll('.discard-tile');
    const lastEl = discardEls[discardEls.length - 1];
    if (lastEl) lastEl.classList.add('animating');
  }

  checkForClaims();
}

export function checkForClaims() {
  game.possibleClaims = [];
  const tile = game.lastDiscard;

  for (let i = 0; i < 4; i++) {
    if (i === game.lastDiscardPlayer) continue;

    const claims = [];
    if (canMahjong(i, tile)) claims.push('mahjong');
    if (canKong(i, tile)) claims.push('kong');
    if (canPong(i, tile)) claims.push('pong');
    if (canChi(i, tile)) claims.push('chi');

    if (claims.length > 0) {
      game.possibleClaims.push({ player: i, claims });
    }
  }

  if (game.possibleClaims.length > 0) {
    game.phase = 'claiming';
    game.claimWindow = true;

    const humanClaim = game.possibleClaims.find(c => c.player === 1);
    if (humanClaim) {
      updateActionButtons();
      startClaimTimer(() => skipClaim());
      return;
    }

    setTimeout(processAIClaims, 800);
  } else {
    nextTurn();
  }
}

export function startClaimTimer(onTimeout) {
  clearClaimTimer();
  game.claimTimeRemaining = 10;

  const timerEl = document.getElementById('claim-timer');
  timerEl.textContent = game.claimTimeRemaining;

  game.claimTimeoutId = setInterval(() => {
    game.claimTimeRemaining--;
    timerEl.textContent = game.claimTimeRemaining;

    if (game.claimTimeRemaining <= 0) {
      clearClaimTimer();
      onTimeout();
    }
  }, 1000);
}

export function clearClaimTimer() {
  if (game.claimTimeoutId) {
    clearInterval(game.claimTimeoutId);
    game.claimTimeoutId = null;
  }
}

export function nextTurn() {
  game.currentPlayer = (game.currentPlayer + 1) % 4;
  game.phase = 'draw';
  game.claimWindow = false;
  game.possibleClaims = [];
  game.justClaimed = false;
  clearClaimTimer();
  hideClaimPanel();

  const indicator = document.getElementById('turn-indicator');
  indicator.classList.add('transitioning');
  setTimeout(() => indicator.classList.remove('transitioning'), 300);

  renderAll();

  if (game.players[game.currentPlayer].isAI) {
    setTimeout(() => {
      drawPhase(game.currentPlayer);
      setTimeout(aiTurn, 800);
    }, 500);
  } else {
    setTimeout(() => drawPhase(game.currentPlayer), 300);
  }
}

// ============================================================
// PLAYER ACTIONS
// ============================================================

export function selectTile(index) {
  if (game.currentPlayer !== 1 || game.phase !== 'discard') return;

  if (game.selectedTileIndex === index) {
    discardSelected();
  } else {
    game.selectedTileIndex = index;
    renderPlayerHand();
    updateActionButtons();
  }
}

export function discardSelected() {
  if (game.selectedTileIndex < 0) return;
  discardTile(1, game.selectedTileIndex);
}

export function showChiOptions() {
  const tile = game.lastDiscard;
  const combinations = getChiCombinations(1, tile);

  if (combinations.length === 1) {
    executeChi(combinations[0]);
    return;
  }

  showClaimPanel('Chow - Choose sequence:', combinations.map((combo, i) => ({
    label: 'Chow',
    tiles: combo.tiles,
    claimedTile: tile,
    action: () => executeChi(combo)
  })));
}

export function executeChi(combination) {
  clearClaimTimer();
  hideClaimPanel();

  const tile = game.lastDiscard;
  const player = game.players[1];

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
  game.currentPlayer = 1;
  game.phase = 'discard';
  game.lastDiscard = null;
  game.justClaimed = true;

  showToast('Chow! ✨');
  renderAll();
}

export function claimPong() {
  clearClaimTimer();
  hideClaimPanel();

  const tile = game.lastDiscard;
  const player = game.players[1];

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
  game.currentPlayer = 1;
  game.phase = 'discard';
  game.lastDiscard = null;
  game.justClaimed = true;

  showToast('Pung! 🎊');
  renderAll();
}

export function showKongOptions() {
  clearClaimTimer();

  const options = [];

  if (game.lastDiscard && canKong(1, game.lastDiscard)) {
    options.push({
      label: 'Kong (Exposed)',
      tiles: [game.lastDiscard, game.lastDiscard, game.lastDiscard, game.lastDiscard],
      claimedTile: game.lastDiscard,
      action: () => executeKong(game.lastDiscard)
    });
  }

  const concealedKongs = getConcealedKongs(1);
  for (const kong of concealedKongs) {
    options.push({
      label: 'Kong (Concealed)',
      tiles: [kong.tile, kong.tile, kong.tile, kong.tile],
      action: () => {
        hideClaimPanel();
        declareConcealedKong(1, kong.tile);
      }
    });
  }

  const addKongs = getAddKongs(1);
  for (const add of addKongs) {
    options.push({
      label: 'Kong (Add to Pung)',
      tiles: [...add.meld.tiles, add.tile],
      action: () => {
        hideClaimPanel();
        declareAddKong(1, add);
      }
    });
  }

  if (options.length === 1) {
    options[0].action();
  } else if (options.length > 1) {
    showClaimPanel('Kong - Choose type:', options);
  } else {
    executeKong(game.lastDiscard);
  }
}

export function executeKong(tile) {
  hideClaimPanel();

  const player = game.players[1];

  const kongTiles = [tile];
  for (let i = 0; i < 3; i++) {
    const idx = player.hand.findIndex(t => tilesMatch(t, tile));
    if (idx >= 0) {
      kongTiles.push(player.hand.splice(idx, 1)[0]);
    }
  }

  if (game.lastDiscard) {
    markLastDiscardClaimed();
  game.players[game.lastDiscardPlayer].discards.pop();
  }

  player.melds.push({ type: 'kong', tiles: kongTiles, exposed: true });

  sortHand(player.hand);
  game.claimWindow = false;
  game.currentPlayer = 1;

  const replacement = drawReplacementTile(1);
  if (replacement) {
    game.drawnTile = replacement;
    handleFlowers(1);
    sortHand(player.hand);
  }

  game.phase = 'discard';
  game.lastDiscard = null;

  showToast('Kong! 🀄');
  renderAll();
}

export function claimMahjong() {
  clearClaimTimer();
  hideClaimPanel();

  const player = game.players[1];

  if (game.lastDiscard && game.claimWindow) {
    player.hand.push(game.lastDiscard);
    markLastDiscardClaimed();
  game.players[game.lastDiscardPlayer].discards.pop();
    game.winType = 'ron';
  } else if (game.kongInProgress && game.pendingKongTile) {
    player.hand.push(game.pendingKongTile);
    game.winType = 'rob';
  } else {
    game.winType = 'tsumo';
  }

  game.claimWindow = false;
  game.kongInProgress = false;
  endGame('win', 1);
}

export function skipClaim() {
  clearClaimTimer();
  hideClaimPanel();
  game.claimWindow = false;
  hideActionButtons();

  setTimeout(processAIClaims, 300);
}

// ============================================================
// SCORING & END GAME
// ============================================================

export function calculateScore(winnerIndex) {
  let basePoints = 8;
  const winner = game.players[winnerIndex];

  basePoints += winner.flowers.length;

  if (game.winType === 'tsumo') {
    basePoints += 1;
  }

  const value = basePoints * 4;
  const totalWin = value * 3;

  return { basePoints, value, totalWin };
}

export function endGame(reason, winner = -1) {
  game.phase = 'ended';
  clearClaimTimer();
  hideClaimPanel();

  if (reason === 'win') {
    const names = PLAYER_NAMES;
    const emojis = PLAYER_EMOJIS;
    const winnerName = names[winner];

    const scoring = calculateScore(winner);
    const loserPay = scoring.value;

    for (let i = 0; i < 4; i++) {
      if (i === winner) {
        game.players[i].score += scoring.totalWin;
      } else {
        game.players[i].score -= loserPay;
      }
    }

    showConfetti();

    const winTypeLabel = game.winType === 'tsumo' ? 'Self-Draw' :
                         game.winType === 'rob' ? 'Robbed Kong' : 'Discard';

    let scoreHtml = `
      <p>${emojis[winner]} ${winnerName} wins with ${winTypeLabel}!</p>
      <div class="score-table">
    `;

    for (let i = 0; i < 4; i++) {
      const isWinner = i === winner;
      const change = isWinner ? `+${scoring.totalWin}` : `-${loserPay}`;
      const changeClass = isWinner ? 'positive' : 'negative';

      scoreHtml += `
        <div class="score-row ${isWinner ? 'winner' : ''}">
          <span class="player-name">${emojis[i]} ${names[i]}</span>
          <span class="player-score">
            ${game.players[i].score.toLocaleString()}
            <span class="score-change ${changeClass}">(${change})</span>
          </span>
        </div>
      `;
    }

    scoreHtml += `
      </div>
      <p style="font-size:11px;color:#9a9aaa;margin-top:8px;">
        ${scoring.basePoints} pts × 4 = ${scoring.value} per player
      </p>
    `;

    if (winner === 1) {
      showToast('🎉 MAHJONG! 🎉');
      setTimeout(() => {
        showModal('🎊 You Win!', scoreHtml, 'Play Again', () => {
          hideModal();
          resetGame();
          startGame();
        });
      }, 1500);
    } else {
      showToast(`${emojis[winner]} ${winnerName} wins!`);
      setTimeout(() => {
        showModal('Game Over', scoreHtml, 'Play Again', () => {
          hideModal();
          resetGame();
          startGame();
        });
      }, 1500);
    }
  } else {
    showModal('🤝 Draw', '<p>No tiles remaining. It\'s a draw!</p>', 'Play Again', () => {
      hideModal();
      resetGame();
      startGame();
    });
  }
}

export function showMenu() {
  showModal('⚙️ Menu', '<p>Start a new game?</p>', 'New Game', () => {
    hideModal();
    resetGame();
    startGame();
  });
}
