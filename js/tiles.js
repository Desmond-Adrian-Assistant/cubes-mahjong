export function getDotsSVG(num) {
  const positions = {
    1: [[50, 50]],
    2: [[50, 30], [50, 70]],
    3: [[50, 25], [30, 65], [70, 65]],
    4: [[30, 30], [70, 30], [30, 70], [70, 70]],
    5: [[30, 25], [70, 25], [50, 50], [30, 75], [70, 75]],
    6: [[30, 25], [70, 25], [30, 50], [70, 50], [30, 75], [70, 75]],
    7: [[30, 20], [70, 20], [30, 45], [70, 45], [30, 70], [70, 70], [50, 90]],
    8: [[25, 22], [50, 22], [75, 22], [25, 50], [75, 50], [25, 78], [50, 78], [75, 78]],
    9: [[25, 22], [50, 22], [75, 22], [25, 50], [50, 50], [75, 50], [25, 78], [50, 78], [75, 78]]
  };

  const colors = ['#1565c0', '#c62828'];
  const r = num <= 4 ? 14 : num <= 6 ? 12 : 10;

  let circles = positions[num].map((pos, i) => {
    const color = num === 1 ? '#c62828' : colors[i % 2];
    return `<circle cx="${pos[0]}" cy="${pos[1]}" r="${r}" fill="${color}" stroke="#1a237e" stroke-width="1.5"/>
            <circle cx="${pos[0]-3}" cy="${pos[1]-3}" r="${r*0.25}" fill="rgba(255,255,255,0.4)"/>`;
  }).join('');

  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${circles}</svg>`;
}

export function getBambooSVG(num) {
  if (num === 1) {
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="45" rx="25" ry="20" fill="#2e7d32" stroke="#1b5e20" stroke-width="2"/>
      <ellipse cx="50" cy="35" rx="15" ry="12" fill="#1b5e20"/>
      <circle cx="42" cy="32" r="4" fill="#212121"/>
      <circle cx="40" cy="30" r="1.5" fill="white"/>
      <polygon points="60,35 75,30 60,38" fill="#bf360c"/>
      <path d="M30 55 Q20 70 35 75 Q50 80 65 75 Q80 70 70 55" fill="#2e7d32" stroke="#1b5e20" stroke-width="2"/>
      <ellipse cx="38" cy="48" rx="4" ry="6" fill="#1b5e20"/>
      <ellipse cx="62" cy="48" rx="4" ry="6" fill="#1b5e20"/>
    </svg>`;
  }

  const cols = num <= 3 ? num : num <= 6 ? 3 : 3;
  const rows = Math.ceil(num / cols);
  const stickW = 18;
  const stickH = num <= 3 ? 70 : num <= 6 ? 40 : 28;
  const gap = 6;
  const totalW = cols * stickW + (cols - 1) * gap;
  const totalH = rows * stickH + (rows - 1) * 4;
  const startX = (100 - totalW) / 2;
  const startY = (100 - totalH) / 2;

  let sticks = '';
  let count = 0;

  for (let row = 0; row < rows && count < num; row++) {
    const sticksInRow = Math.min(cols, num - count);
    const rowStartX = startX + (cols - sticksInRow) * (stickW + gap) / 2;

    for (let col = 0; col < sticksInRow && count < num; col++) {
      const x = rowStartX + col * (stickW + gap);
      const y = startY + row * (stickH + 4);
      const color = '#2e7d32';
      const darkColor = '#1b5e20';
      const accent = count % 2 === 0 ? '#c62828' : '#1b5e20';

      sticks += `
        <rect x="${x}" y="${y}" width="${stickW}" height="${stickH}" rx="4" fill="${color}" stroke="${darkColor}" stroke-width="1.5"/>
        <rect x="${x+2}" y="${y+2}" width="4" height="${stickH-4}" rx="2" fill="rgba(255,255,255,0.2)"/>
        <line x1="${x}" y1="${y + stickH/3}" x2="${x + stickW}" y2="${y + stickH/3}" stroke="${accent}" stroke-width="1.5"/>
        <line x1="${x}" y1="${y + stickH*2/3}" x2="${x + stickW}" y2="${y + stickH*2/3}" stroke="${accent}" stroke-width="1.5"/>
      `;
      count++;
    }
  }

  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${sticks}</svg>`;
}

export function getCharactersSVG(num) {
  const cnNums = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <text x="50" y="42" text-anchor="middle" font-family="serif" font-size="36" font-weight="bold" fill="#1a237e">${cnNums[num-1]}</text>
    <text x="50" y="82" text-anchor="middle" font-family="serif" font-size="30" font-weight="bold" fill="#c62828">万</text>
  </svg>`;
}

export function getWindSVG(wind) {
  const chars = { East: '東', South: '南', West: '西', North: '北' };
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <text x="50" y="68" text-anchor="middle" font-family="serif" font-size="50" font-weight="bold" fill="#212121">${chars[wind]}</text>
  </svg>`;
}

export function getDragonSVG(dragon) {
  if (dragon === 'Red') {
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="18" y="12" width="64" height="76" rx="6" fill="none" stroke="#c62828" stroke-width="3"/>
      <text x="50" y="70" text-anchor="middle" font-family="serif" font-size="52" font-weight="bold" fill="#c62828">中</text>
    </svg>`;
  }
  if (dragon === 'Green') {
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <text x="50" y="70" text-anchor="middle" font-family="serif" font-size="52" font-weight="bold" fill="#2e7d32">發</text>
    </svg>`;
  }
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="18" y="12" width="64" height="76" rx="6" fill="none" stroke="#1565c0" stroke-width="3"/>
    <rect x="26" y="20" width="48" height="60" rx="4" fill="none" stroke="#1565c0" stroke-width="2"/>
  </svg>`;
}

export function getFlowerSVG(tile) {
  if (tile.flower) {
    const flowers = {
      'Plum': `<text x="50" y="58" text-anchor="middle" font-size="42">🌸</text>`,
      'Orchid': `<text x="50" y="58" text-anchor="middle" font-size="42">🌺</text>`,
      'Chrysanthemum': `<text x="50" y="58" text-anchor="middle" font-size="42">🌼</text>`,
      'Bamboo': `<text x="50" y="58" text-anchor="middle" font-size="42">🎋</text>`
    };
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${flowers[tile.flower] || flowers['Plum']}</svg>`;
  }
  if (tile.season) {
    const seasons = {
      'Spring': `<text x="50" y="58" text-anchor="middle" font-size="42">🌷</text>`,
      'Summer': `<text x="50" y="58" text-anchor="middle" font-size="42">☀️</text>`,
      'Autumn': `<text x="50" y="58" text-anchor="middle" font-size="42">🍂</text>`,
      'Winter': `<text x="50" y="58" text-anchor="middle" font-size="42">❄️</text>`
    };
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${seasons[tile.season] || seasons['Spring']}</svg>`;
  }
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><text x="50" y="58" text-anchor="middle" font-size="42">🌸</text></svg>`;
}

export function getTileSVG(tile) {
  if (tile.type === 'suited') {
    if (tile.suit === 'dots') return getDotsSVG(tile.num);
    if (tile.suit === 'bamboo') return getBambooSVG(tile.num);
    if (tile.suit === 'characters') return getCharactersSVG(tile.num);
  }
  if (tile.wind) return getWindSVG(tile.wind);
  if (tile.dragon) return getDragonSVG(tile.dragon);
  if (tile.flower || tile.season) return getFlowerSVG(tile);
  return `<svg viewBox="0 0 100 100"><text x="50" y="60" text-anchor="middle" font-size="40">?</text></svg>`;
}

export function getTileBackHTML() {
  return `<div class="tile-back-pattern">
    <div class="tile-back-stripe red"></div>
    <div class="tile-back-stripe green"></div>
    <div class="tile-back-stripe white"></div>
    <div class="tile-back-stripe red"></div>
    <div class="tile-back-stripe green"></div>
  </div>`;
}
