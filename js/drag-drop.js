import { game } from './game-state.js';
import { selectTile } from './game-logic.js';
import { renderPlayerHand } from './renderer.js';

const DRAG_THRESHOLD = 10;

let drag = {
  active: false,
  dragging: false,
  el: null,
  index: -1,
  pointerId: -1,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  originRect: null,
  rects: [],
  currentInsert: -1,
  placeholder: null,
  trayEl: null
};

// Public: other modules check this to avoid re-rendering hand during drag
export function isDragging() {
  return drag.dragging;
}

export function onTilePointerDown(e, index) {
  if (game.currentPlayer !== 1 || game.phase !== 'discard') return;
  if (drag.active) return; // prevent double-start
  e.preventDefault();

  const tray = document.getElementById('hand-tray');
  const tiles = Array.from(tray.querySelectorAll('.tile'));
  const el = tiles[index];
  if (!el) return;

  const rects = tiles.map(t => t.getBoundingClientRect());

  drag.active = true;
  drag.dragging = false;
  drag.el = el;
  drag.index = index;
  drag.pointerId = e.pointerId;
  drag.startX = e.clientX;
  drag.startY = e.clientY;
  drag.currentX = e.clientX;
  drag.currentY = e.clientY;
  drag.originRect = rects[index];
  drag.rects = rects;
  drag.currentInsert = index;
  drag.placeholder = null;
  drag.trayEl = tray;
}

// These are the document-level listeners registered in main.js
export function onTilePointerMove(e) {
  if (!drag.active) return;

  drag.currentX = e.clientX;
  drag.currentY = e.clientY;

  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;

  if (!drag.dragging) {
    if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
    initiateDrag();
  }

  if (!drag.dragging || !drag.el) return;

  // Move tile with pointer using transform (no layout thrash)
  const moveX = e.clientX - drag.startX;
  const moveY = e.clientY - drag.startY;
  drag.el.style.transform = `translate(${moveX}px, ${moveY}px) scale(1.1)`;

  // Determine insert position
  const cx = e.clientX;
  let insertAt = drag.rects.length - 1;
  for (let i = 0; i < drag.rects.length; i++) {
    if (i === drag.index) continue;
    const mid = drag.rects[i].left + drag.rects[i].width / 2;
    if (cx < mid) {
      insertAt = i;
      break;
    }
  }

  if (insertAt !== drag.currentInsert) {
    drag.currentInsert = insertAt;
    movePlaceholder(insertAt);
  }
}

export function onTilePointerUp(e) {
  if (!drag.active) return;

  const wasDragging = drag.dragging;
  const fromIndex = drag.index;
  const toIndex = drag.currentInsert;

  if (wasDragging) {
    finishDrag(fromIndex, toIndex);
  } else {
    cleanup();
    selectTile(fromIndex);
  }
}

function initiateDrag() {
  drag.dragging = true;
  const el = drag.el;
  const tray = drag.trayEl;
  const rect = drag.originRect;

  // Create invisible placeholder to hold the gap in the flex tray
  const ph = document.createElement('div');
  ph.className = 'drag-placeholder';
  ph.style.width = rect.width + 'px';
  ph.style.height = rect.height + 'px';
  ph.style.flexShrink = '0';
  drag.placeholder = ph;

  // Style the dragged tile: keep it in the tray but pull it out of flow
  // Use position:relative + transform so it stays a child (no reparenting!)
  el.style.position = 'relative';
  el.style.zIndex = '1000';
  el.style.width = rect.width + 'px';
  el.style.height = rect.height + 'px';
  el.style.transition = 'none';
  el.style.boxShadow = '0 12px 32px rgba(0,0,0,0.25)';
  el.style.opacity = '0.95';
  el.style.pointerEvents = 'none';

  // Insert placeholder right before the tile, then move tile to end of tray
  // so it renders on top but stays a tray child
  tray.insertBefore(ph, el);
  tray.appendChild(el);
}

function movePlaceholder(insertAt) {
  const tray = drag.trayEl;
  const ph = drag.placeholder;
  if (!ph || !tray) return;

  // Get children excluding placeholder and the dragged tile
  const children = Array.from(tray.children).filter(c => c !== ph && c !== drag.el);

  if (insertAt >= children.length) {
    // Insert before the dragged tile (which is at end of tray)
    tray.insertBefore(ph, drag.el);
  } else {
    tray.insertBefore(ph, children[insertAt]);
  }
}

function finishDrag(fromIndex, toIndex) {
  // Animate snap-back
  const el = drag.el;
  if (el && drag.placeholder) {
    const phRect = drag.placeholder.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    // Calculate transform to move tile to placeholder position
    const snapX = phRect.left - drag.originRect.left;
    const snapY = phRect.top - drag.originRect.top;
    
    el.style.transition = 'transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease';
    el.style.transform = `translate(${snapX}px, ${snapY}px) scale(1)`;
    el.style.boxShadow = '';
    el.style.opacity = '1';

    setTimeout(() => {
      applyReorder(fromIndex, toIndex);
    }, 130);
  } else {
    applyReorder(fromIndex, toIndex);
  }
}

function applyReorder(fromIndex, toIndex) {
  cleanup();

  if (fromIndex !== toIndex) {
    const hand = game.players[1].hand;
    const [moved] = hand.splice(fromIndex, 1);
    // After splice, if we moved from before the target, the target shifted down by 1
    const adjustedTo = fromIndex < toIndex ? toIndex - 1 : toIndex;
    hand.splice(adjustedTo, 0, moved);

    // Adjust selected tile index
    if (game.selectedTileIndex === fromIndex) {
      game.selectedTileIndex = adjustedTo;
    } else if (fromIndex < toIndex) {
      if (game.selectedTileIndex > fromIndex && game.selectedTileIndex < toIndex) {
        game.selectedTileIndex--;
      }
    } else {
      if (game.selectedTileIndex >= toIndex && game.selectedTileIndex < fromIndex) {
        game.selectedTileIndex++;
      }
    }
  }

  renderPlayerHand();
}

function cleanup() {
  if (drag.el) {
    drag.el.style.position = '';
    drag.el.style.zIndex = '';
    drag.el.style.width = '';
    drag.el.style.height = '';
    drag.el.style.transition = '';
    drag.el.style.transform = '';
    drag.el.style.boxShadow = '';
    drag.el.style.opacity = '';
    drag.el.style.pointerEvents = '';
  }
  if (drag.placeholder && drag.placeholder.parentNode) {
    drag.placeholder.remove();
  }
  drag.active = false;
  drag.dragging = false;
  drag.el = null;
  drag.placeholder = null;
  drag.trayEl = null;
}
