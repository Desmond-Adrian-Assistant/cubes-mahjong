#!/bin/bash
# Patch: Add player setup section to welcome modal
cd /Users/adrianai/Projects/cubes-mahjong

# 1. Add modal-setup div after modal-divider
sed -i '' '/<div class="modal-divider"><\/div>/a\
      <div id="modal-setup"><\/div>' index-3d.html

# 2. Add setup initialization JS before "window.gameController = new GameController"
cat >> /tmp/setup-patch.js << 'SETUPEOF'

// ========== SETUP SCREEN POPULATION ==========
function initSetupScreen() {
  const avatars = ['🐼','🐱','🦊','🐰','🐻','🐲','🦁','🐸','🐶','🦉','🐺','🎋'];
  const colors = [
    {name:'Gold',hex:'#C0A878'},{name:'Jade',hex:'#5a8a5a'},{name:'Rose',hex:'#8a4a5a'},
    {name:'Sky',hex:'#4a6a8a'},{name:'Plum',hex:'#6a4a7a'},{name:'Ink',hex:'#3a3a3a'},
    {name:'Teal',hex:'#3a7a7a'},{name:'Rust',hex:'#8a5a3a'}
  ];
  const mats = [
    {name:'Default',val:'default',bg:'#d8c498'},
    {name:'Bamboo',val:'bamboo',bg:'#5a7a4a'},
    {name:'Night',val:'night',bg:'#2a2a3a'},
    {name:'Cherry',val:'cherry',bg:'#8a4a5a'},
    {name:'Ocean',val:'ocean',bg:'#3a5a7a'}
  ];

  const setupDiv = document.getElementById('modal-setup');
  if (!setupDiv) return;

  // Load saved prefs
  const savedName = localStorage.getItem('mahjong-player-name') || '';
  const savedAvatar = localStorage.getItem('mahjong-player-avatar') || '🐼';
  const savedColor = localStorage.getItem('mahjong-tile-accent') || '#C0A878';
  const savedMat = localStorage.getItem('mahjong-mat-choice') || 'default';

  let html = '';

  // Name input
  html += '<div style="margin-bottom:14px;text-align:left;">';
  html += '<label style="font-size:10px;font-weight:700;color:#8a7a6a;letter-spacing:1px;text-transform:uppercase;font-family:Helvetica Neue,sans-serif;">Your Name</label>';
  html += '<input type="text" id="setup-name" placeholder="Player" maxlength="12" value="' + savedName + '" style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid rgba(180,160,120,0.4);font-size:14px;margin-top:4px;background:rgba(255,252,245,0.6);font-family:Helvetica Neue,sans-serif;box-sizing:border-box;">';
  html += '</div>';

  // Avatar picker
  html += '<div style="margin-bottom:14px;text-align:left;">';
  html += '<label style="font-size:10px;font-weight:700;color:#8a7a6a;letter-spacing:1px;text-transform:uppercase;font-family:Helvetica Neue,sans-serif;">Avatar</label>';
  html += '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;justify-content:center;">';
  for (const a of avatars) {
    const sel = a === savedAvatar;
    html += '<div class="setup-avatar-btn" data-avatar="' + a + '" style="width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;border:2px solid ' + (sel ? '#5a4a38' : 'rgba(180,160,120,0.3)') + ';background:' + (sel ? 'rgba(90,74,56,0.1)' : 'rgba(255,252,245,0.5)') + ';transition:all 0.2s;">' + a + '</div>';
  }
  html += '</div></div>';

  // Color picker
  html += '<div style="margin-bottom:14px;text-align:left;">';
  html += '<label style="font-size:10px;font-weight:700;color:#8a7a6a;letter-spacing:1px;text-transform:uppercase;font-family:Helvetica Neue,sans-serif;">Tile Accent</label>';
  html += '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;justify-content:center;">';
  for (const c of colors) {
    const sel = c.hex.toLowerCase() === savedColor.toLowerCase();
    html += '<div class="setup-color-btn" data-color="' + c.hex + '" title="' + c.name + '" style="width:32px;height:32px;border-radius:8px;background:' + c.hex + ';cursor:pointer;border:2px solid ' + (sel ? '#3a2a18' : 'transparent') + ';box-shadow:' + (sel ? '0 0 0 2px rgba(58,42,24,0.3)' : '0 1px 4px rgba(0,0,0,0.1)') + ';transition:all 0.2s;"></div>';
  }
  html += '</div></div>';

  // Mat picker
  html += '<div style="margin-bottom:18px;text-align:left;">';
  html += '<label style="font-size:10px;font-weight:700;color:#8a7a6a;letter-spacing:1px;text-transform:uppercase;font-family:Helvetica Neue,sans-serif;">Table Mat</label>';
  html += '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;justify-content:center;">';
  for (const m of mats) {
    const sel = m.val === savedMat;
    html += '<div class="setup-mat-btn" data-mat="' + m.val + '" style="width:48px;height:48px;border-radius:8px;background:' + m.bg + ';cursor:pointer;border:2px solid ' + (sel ? '#3a2a18' : 'transparent') + ';box-shadow:' + (sel ? '0 0 0 2px rgba(58,42,24,0.3)' : '0 1px 4px rgba(0,0,0,0.1)') + ';transition:all 0.2s;display:flex;align-items:flex-end;justify-content:center;"><span style="font-size:8px;color:rgba(255,255,255,0.8);font-family:Helvetica Neue,sans-serif;margin-bottom:3px;">' + m.name + '</span></div>';
  }
  html += '</div></div>';

  setupDiv.innerHTML = html;

  // Wire up avatar clicks
  setupDiv.querySelectorAll('.setup-avatar-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      setupDiv.querySelectorAll('.setup-avatar-btn').forEach(function(b) {
        b.style.border = '2px solid rgba(180,160,120,0.3)';
        b.style.background = 'rgba(255,252,245,0.5)';
      });
      btn.style.border = '2px solid #5a4a38';
      btn.style.background = 'rgba(90,74,56,0.1)';
      localStorage.setItem('mahjong-player-avatar', btn.dataset.avatar);
    });
  });

  // Wire up color clicks
  setupDiv.querySelectorAll('.setup-color-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      setupDiv.querySelectorAll('.setup-color-btn').forEach(function(b) {
        b.style.border = '2px solid transparent';
        b.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)';
      });
      btn.style.border = '2px solid #3a2a18';
      btn.style.boxShadow = '0 0 0 2px rgba(58,42,24,0.3)';
      localStorage.setItem('mahjong-tile-accent', btn.dataset.color);
      // Live preview
      var picker = document.getElementById('tile-color-picker');
      if (picker) { picker.value = btn.dataset.color; picker.dispatchEvent(new Event('input')); }
    });
  });

  // Wire up mat clicks
  setupDiv.querySelectorAll('.setup-mat-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      setupDiv.querySelectorAll('.setup-mat-btn').forEach(function(b) {
        b.style.border = '2px solid transparent';
        b.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)';
      });
      btn.style.border = '2px solid #3a2a18';
      btn.style.boxShadow = '0 0 0 2px rgba(58,42,24,0.3)';
      localStorage.setItem('mahjong-mat-choice', btn.dataset.mat);
    });
  });

  // Save name on input
  var nameInput = document.getElementById('setup-name');
  if (nameInput) {
    nameInput.addEventListener('input', function() {
      localStorage.setItem('mahjong-player-name', nameInput.value.trim());
    });
  }
}
SETUPEOF

# Now inject: add initSetupScreen call and applySetup in startGame
# We'll use node to do a proper patch since sed is fragile for multi-line

node -e "
const fs = require('fs');
let html = fs.readFileSync('index-3d.html', 'utf8');

// 1. Add modal-setup div
html = html.replace(
  '<div class=\"modal-divider\"></div>',
  '<div class=\"modal-divider\"></div>\n      <div id=\"modal-setup\"></div>'
);

// 2. Add initSetupScreen() call after GameController creation
html = html.replace(
  'window.gameController = new GameController();',
  'window.gameController = new GameController();\n    initSetupScreen();'
);

// 3. Add applySetupChoices method and call it in startGame
// Insert the function and initSetupScreen before the INITIALIZE comment
const setupJS = fs.readFileSync('/tmp/setup-patch.js', 'utf8');
html = html.replace(
  '// ==================== INITIALIZE ====================',
  setupJS + '\n// ==================== INITIALIZE ===================='
);

// 4. In startGame, apply user choices
html = html.replace(
  'this.hideModal();\n    this.gs.reset();',
  \`this.hideModal();
    // Apply setup choices
    var setupName = (document.getElementById('setup-name') || {}).value || localStorage.getItem('mahjong-player-name') || 'Chen';
    var setupAvatar = localStorage.getItem('mahjong-player-avatar') || '\u{1F43C}';
    PLAYER_NAMES[1] = setupName || 'Chen';
    PLAYER_EMOJIS[1] = setupAvatar;
    // Update south player bubble
    var southBubble = document.getElementById('p-south');
    if (southBubble) {
      var nameSpan = southBubble.querySelector('.name');
      if (nameSpan) nameSpan.textContent = setupName || 'Chen';
    }
    var playerLabel = document.querySelector('.player-label .name');
    if (playerLabel) playerLabel.textContent = 'PLAYER 4: ' + (setupName || 'Chen');
    // Hide setup section for game-over modals
    var setupDiv = document.getElementById('modal-setup');
    if (setupDiv) setupDiv.style.display = 'none';
    this.gs.reset();\`
);

// 5. Show setup section again when showing welcome modal (on Play Again)
html = html.replace(
  \"document.getElementById('modal').classList.add('show');\",
  \"document.getElementById('modal').classList.add('show');\\n    var sd = document.getElementById('modal-setup'); if (sd) sd.style.display = '';\"
);

fs.writeFileSync('index-3d.html', html);
console.log('Patched!');

// Validate
const h2 = fs.readFileSync('index-3d.html', 'utf8');
const m = h2.match(/<script>([\\s\\S]*?)<\\/script>/);
try { new Function(m[1]); console.log('JS parses OK'); } catch(e) { console.log('PARSE ERROR:', e.message); }
"

rm /tmp/setup-patch.js
echo "Done!"
