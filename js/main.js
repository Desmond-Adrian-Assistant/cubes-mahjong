import { resizeCanvas, animate } from './background.js';
import { renderAll } from './renderer.js';
import { showModal } from './ui.js';
import { getTileSVG } from './tiles.js';
import { onTilePointerMove, onTilePointerUp } from './drag-drop.js';
import {
  startGame, showMenu, skipClaim, showChiOptions,
  claimPong, showKongOptions, claimMahjong, discardSelected
} from './game-logic.js';

// Drag-and-drop global listeners
document.addEventListener('pointermove', onTilePointerMove);
document.addEventListener('pointerup', onTilePointerUp);

// Button event listeners (replacing inline onclick handlers)
document.querySelector('.menu-btn').addEventListener('click', showMenu);
document.getElementById('btn-skip').addEventListener('click', skipClaim);
document.getElementById('btn-chi').addEventListener('click', showChiOptions);
document.getElementById('btn-pong').addEventListener('click', claimPong);
document.getElementById('btn-kong').addEventListener('click', showKongOptions);
document.getElementById('btn-mahjong').addEventListener('click', claimMahjong);
document.getElementById('btn-discard').addEventListener('click', discardSelected);

// Resize handler
window.addEventListener('resize', () => {
  resizeCanvas();
  renderAll();
});

// Init
resizeCanvas();
animate();

// Show welcome modal
showModal(
  '🀄 Cubes',
  `<div class="modal-subtitle">Classic 4-Player Mahjong</div>
  <div class="modal-tiles">
    <div class="modal-tile">${getTileSVG({type:'suited',suit:'characters',num:1})}</div>
    <div class="modal-tile">${getTileSVG({dragon:'Red'})}</div>
    <div class="modal-tile">${getTileSVG({wind:'East'})}</div>
    <div class="modal-tile">${getTileSVG({type:'suited',suit:'bamboo',num:1})}</div>
    <div class="modal-tile">${getTileSVG({type:'suited',suit:'dots',num:9})}</div>
  </div>
  <div class="modal-players">
    <div class="modal-player">
      <div class="avatar" style="background:linear-gradient(135deg,#ffccbc,#ffab91)">🐼</div>
      <span class="player-name">You</span><span class="player-wind">South</span>
    </div>
    <div class="modal-player">
      <div class="avatar" style="background:linear-gradient(135deg,#e1bee7,#ce93d8)">🐰</div>
      <span class="player-name">Usagi</span><span class="player-wind">East</span>
    </div>
    <div class="modal-player">
      <div class="avatar" style="background:linear-gradient(135deg,#b3e5fc,#81d4fa)">🐱</div>
      <span class="player-name">Mochi</span><span class="player-wind">North</span>
    </div>
    <div class="modal-player">
      <div class="avatar" style="background:linear-gradient(135deg,#ffe0b2,#ffcc80)">🦊</div>
      <span class="player-name">Kitsune</span><span class="player-wind">West</span>
    </div>
  </div>`,
  'Play',
  startGame
);
