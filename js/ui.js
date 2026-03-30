import { game } from './game-state.js';
import { getTileSVG } from './tiles.js';

export function showToast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}

export function showAIToast(text) {
  const el = document.getElementById('ai-toast');
  el.textContent = text;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1500);
}

export function showModal(title, contentHtml, buttonText, callback) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-content').innerHTML = contentHtml;
  document.getElementById('modal-btn').textContent = buttonText;
  document.getElementById('modal-btn').onclick = callback;
  document.getElementById('modal').classList.add('show');
}

export function hideModal() {
  document.getElementById('modal').classList.remove('show');
}

export function showClaimPanel(title, options) {
  const panel = document.getElementById('claim-panel');
  const titleEl = document.getElementById('claim-panel-title');
  const optionsEl = document.getElementById('claim-options');

  titleEl.textContent = title;
  optionsEl.innerHTML = '';

  for (const opt of options) {
    const optEl = document.createElement('div');
    optEl.className = 'claim-option';
    optEl.onclick = opt.action;

    const tilesPreview = document.createElement('div');
    tilesPreview.className = 'tiles-preview';

    for (const tile of opt.tiles) {
      const tileEl = document.createElement('div');
      tileEl.className = 'preview-tile';
      if (opt.claimedTile && tile.id === opt.claimedTile.id) {
        tileEl.classList.add('claimed');
      }
      tileEl.innerHTML = getTileSVG(tile);
      tilesPreview.appendChild(tileEl);
    }

    const label = document.createElement('span');
    label.className = 'action-label';
    label.textContent = opt.label;

    optEl.appendChild(tilesPreview);
    optEl.appendChild(label);
    optionsEl.appendChild(optEl);
  }

  panel.classList.add('visible');
}

export function hideClaimPanel() {
  document.getElementById('claim-panel').classList.remove('visible');
}

export function showConfetti() {
  const container = document.getElementById('confetti-container');
  container.innerHTML = '';

  const colors = ['#7c5cbf', '#42a5f5', '#66bb6a', '#ffca28', '#ef5350', '#ab47bc'];
  const shapes = ['■', '●', '▲', '★', '♦', '✿'];

  for (let i = 0; i < 80; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.textContent = shapes[Math.floor(Math.random() * shapes.length)];
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.color = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.fontSize = (Math.random() * 12 + 8) + 'px';
    confetti.style.animation = `confettiFall ${Math.random() * 2 + 2}s ease-out ${Math.random() * 0.5}s forwards`;
    container.appendChild(confetti);
  }

  setTimeout(() => {
    container.innerHTML = '';
  }, 4000);
}
