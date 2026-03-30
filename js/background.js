const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

export function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawBackground() {
  const W = window.innerWidth;
  const H = window.innerHeight;

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#e8e4ef');
  grad.addColorStop(1, '#ddd8e8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(200, 190, 210, 0.3)';
  for (let i = 0; i < 60; i++) {
    const x = (i * 97 + 23) % W;
    const y = (i * 71 + 17) % H;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function animate() {
  drawBackground();
  requestAnimationFrame(animate);
}
