import { game } from './game-state.js';
import { getTileSVG, getTileBackHTML } from './tiles.js';
import { onTilePointerDown, isDragging } from './drag-drop.js';
import { canMahjong, getConcealedKongs, getAddKongs } from './game-logic.js';

export function renderAll() {
  renderPlayerHand();
  renderOpponentHands();
  renderDiscards();
  renderMelds();
  updatePlayerBubbles();
  updateWallInfo();
  updateTurnIndicator();
  updateActionButtons();
  updatePlayerScoreDisplay();
}

export function updatePlayerScoreDisplay() {
  const el = document.getElementById('player-score-display');
  if (el) {
    el.textContent = game.players[1].score.toLocaleString();
  }
}

export function renderPlayerHand() {
  // Don't blow away the DOM while user is dragging tiles
  if (isDragging()) return;

  const tray = document.getElementById('hand-tray');
  tray.innerHTML = '';

  const player = game.players[1];

  player.hand.forEach((tile, i) => {
    const el = createTileElement(tile, false);

    if (i === game.selectedTileIndex) {
      el.classList.add('selected');
    }
    if (game.drawnTile && tile.id === game.drawnTile.id) {
      el.classList.add('drawn');
      el.classList.add('animating-draw');
    }

    el.addEventListener('pointerdown', (e) => onTilePointerDown(e, i));
    tray.appendChild(el);
  });
}

export function renderOpponentHands() {
  renderOpponentHand('hand-top', game.players[3].hand.length, 'top');
  renderOpponentHand('hand-left', game.players[2].hand.length, 'left');
  renderOpponentHand('hand-right', game.players[0].hand.length, 'right');
}

export function renderOpponentHand(elementId, count, position) {
  const container = document.getElementById(elementId);
  container.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'tile facedown';
    el.innerHTML = `<div class="tile-body">${getTileBackHTML()}</div>`;
    container.appendChild(el);
  }
}

export function renderDiscards() {
  const container = document.getElementById('discards-display');
  container.innerHTML = '';

  // Use append-only discardHistory for stable grid positions
  game.discardHistory.forEach((entry, i) => {
    const el = document.createElement('div');
    el.className = 'discard-tile';

    if (entry.claimed) {
      // Keep the slot but make it invisible (preserves grid positions)
      el.style.visibility = 'hidden';
      container.appendChild(el);
      return;
    }

    const tile = entry.tile;
    const offsetX = ((tile.id * 7919) % 15) - 7;
    const offsetY = (((tile.id * 7919 * 13) % 15) - 7);
    const rotation = (((tile.id * 7919 * 31) % 25) - 12);
    el.style.setProperty('--rot', rotation + 'deg');
    el.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${rotation}deg)`;

    // Highlight the last unclaimed discard during claiming phase
    if (game.lastDiscard && game.phase === 'claiming' && tile.id === game.lastDiscard.id) {
      el.classList.add('last');
    }
    el.innerHTML = getTileSVG(tile);
    container.appendChild(el);
  });
}

export function renderMelds() {
  const seatToElement = {
    'south': 'melds-south',
    'north': 'melds-north',
    'west': 'melds-west',
    'east': 'melds-east'
  };

  for (const player of game.players) {
    const container = document.getElementById(seatToElement[player.seat]);
    container.innerHTML = '';

    if (player.flowers.length > 0) {
      const flowerGroup = document.createElement('div');
      flowerGroup.className = 'meld-group';
      for (const tile of player.flowers) {
        const el = document.createElement('div');
        el.className = 'meld-tile';
        el.innerHTML = getTileSVG(tile);
        flowerGroup.appendChild(el);
      }
      container.appendChild(flowerGroup);
    }

    for (const meld of player.melds) {
      const group = document.createElement('div');
      group.className = 'meld-group';
      if (meld.concealed) group.classList.add('concealed');

      for (let i = 0; i < meld.tiles.length; i++) {
        const tile = meld.tiles[i];
        const el = document.createElement('div');
        el.className = 'meld-tile';

        if (meld.concealed && (i === 0 || i === meld.tiles.length - 1)) {
          el.classList.add('facedown');
          el.innerHTML = getTileBackHTML();
        } else {
          el.innerHTML = getTileSVG(tile);
        }

        group.appendChild(el);
      }
      container.appendChild(group);
    }
  }
}

export function createTileElement(tile, facedown = false) {
  const el = document.createElement('div');
  el.className = `tile ${tile.suit}${facedown ? ' facedown' : ''}`;

  if (facedown) {
    el.innerHTML = `<div class="tile-body">${getTileBackHTML()}</div>`;
  } else {
    el.innerHTML = `<div class="tile-body"><span class="face">${getTileSVG(tile)}</span></div>`;
  }

  return el;
}

export function updatePlayerBubbles() {
  const bubbles = ['p-top', 'p-left', 'p-right', 'p-bottom'];
  const playerMap = { 'p-bottom': 1, 'p-right': 0, 'p-top': 3, 'p-left': 2 };

  for (const id of bubbles) {
    const el = document.getElementById(id);
    const playerIdx = playerMap[id];

    if (playerIdx === game.currentPlayer) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  }

  document.getElementById('score-south').textContent = game.players[1].score.toLocaleString();
  document.getElementById('score-east').textContent = game.players[0].score.toLocaleString();
  document.getElementById('score-north').textContent = game.players[3].score.toLocaleString();
  document.getElementById('score-west').textContent = game.players[2].score.toLocaleString();
}

export function updateWallInfo() {
  document.getElementById('tiles-left').textContent = (game.wall.length + game.deadWall.length) + ' left';
}

export function updateTurnIndicator() {
  const el = document.getElementById('turn-indicator');
  const names = { 0: '🐰 Usagi', 1: '⭐ Your', 2: '🦊 Kitsune', 3: '🐱 Mochi' };

  el.textContent = names[game.currentPlayer] + ' Turn!';
  el.classList.toggle('your-turn', game.currentPlayer === 1);
}

export function updateActionButtons() {
  const btnChi = document.getElementById('btn-chi');
  const btnPong = document.getElementById('btn-pong');
  const btnKong = document.getElementById('btn-kong');
  const btnMahjong = document.getElementById('btn-mahjong');
  const btnSkip = document.getElementById('btn-skip');
  const btnDiscard = document.getElementById('btn-discard');

  btnChi.classList.remove('visible');
  btnPong.classList.remove('visible');
  btnKong.classList.remove('visible');
  btnMahjong.classList.remove('visible');
  btnSkip.classList.remove('visible');
  btnDiscard.classList.remove('visible');

  if (game.phase === 'claiming' && game.claimWindow) {
    const humanClaim = game.possibleClaims.find(c => c.player === 1);
    if (humanClaim) {
      if (humanClaim.claims.includes('chi')) btnChi.classList.add('visible');
      if (humanClaim.claims.includes('pong')) btnPong.classList.add('visible');
      if (humanClaim.claims.includes('kong')) btnKong.classList.add('visible');
      if (humanClaim.claims.includes('mahjong')) btnMahjong.classList.add('visible');
      btnSkip.classList.add('visible');
    }
  } else if (game.phase === 'discard' && game.currentPlayer === 1) {
    if (game.selectedTileIndex >= 0) {
      btnDiscard.classList.add('visible');
    }

    if (canMahjong(1)) {
      btnMahjong.classList.add('visible');
    }

    const concealedKongs = getConcealedKongs(1);
    const addKongs = getAddKongs(1);
    if (concealedKongs.length > 0 || addKongs.length > 0) {
      btnKong.classList.add('visible');
    }
  }
}

export function hideActionButtons() {
  document.querySelectorAll('.action-btn').forEach(btn => {
    btn.classList.remove('visible');
  });
}
