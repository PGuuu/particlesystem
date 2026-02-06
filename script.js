const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const video = document.getElementById('camera');
const analysisCanvas = document.getElementById('analysis');
const analysisCtx = analysisCanvas.getContext('2d', { willReadFrequently: true });
const toggleBtn = document.getElementById('toggleCamera');
const statusLabel = document.getElementById('status');
const particleCountInput = document.getElementById('particleCount');

const rand = (min, max) => Math.random() * (max - min) + min;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const state = {
  particles: [],
  targetPoints: [],
  stream: null,
  cameraEnabled: false,
  frameCounter: 0,
  contourUpdateEvery: 2
};

class Particle {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.reset();
  }

  reset() {
    this.x = rand(0, this.width);
    this.y = rand(0, this.height);
    this.vx = rand(-0.4, 0.4);
    this.vy = rand(-0.4, 0.4);
    this.size = rand(1.4, 3.4);
    this.hue = rand(185, 230);
    this.wanderOffset = rand(0, Math.PI * 2);
  }

  update(points, t, width, height) {
    const point = points.length ? points[(Math.random() * points.length) | 0] : null;

    if (point) {
      const dx = point.x - this.x;
      const dy = point.y - this.y;
      const invDist = 1 / (Math.hypot(dx, dy) + 0.0001);
      this.vx += dx * invDist * 0.23;
      this.vy += dy * invDist * 0.23;
    } else {
      this.vx += Math.sin(t * 0.002 + this.wanderOffset) * 0.02;
      this.vy += Math.cos(t * 0.0015 + this.wanderOffset) * 0.02;
    }

    this.vx += rand(-0.06, 0.06);
    this.vy += rand(-0.06, 0.06);

    this.vx *= 0.9;
    this.vy *= 0.9;

    this.x += this.vx;
    this.y += this.vy;

    if (this.x < 0) this.x += width;
    if (this.x > width) this.x -= width;
    if (this.y < 0) this.y += height;
    if (this.y > height) this.y -= height;
  }

  draw(context, hasTarget) {
    context.beginPath();
    context.fillStyle = hasTarget
      ? `hsla(${this.hue}, 90%, 72%, 0.75)`
      : `hsla(${this.hue}, 72%, 62%, 0.32)`;
    context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    context.fill();
  }
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor((rect.width * 9) / 16 * dpr);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  const logicalWidth = canvas.width / dpr;
  const logicalHeight = canvas.height / dpr;

  for (const p of state.particles) {
    p.width = logicalWidth;
    p.height = logicalHeight;
  }
}

function setParticleCount(nextCount) {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  while (state.particles.length < nextCount) {
    state.particles.push(new Particle(width, height));
  }

  if (state.particles.length > nextCount) {
    state.particles.length = nextCount;
  }
}

function extractContourPoints() {
  if (!state.cameraEnabled || video.readyState < 2) {
    state.targetPoints = [];
    return;
  }

  const aw = analysisCanvas.width;
  const ah = analysisCanvas.height;
  analysisCtx.drawImage(video, 0, 0, aw, ah);
  const frame = analysisCtx.getImageData(0, 0, aw, ah).data;

  const points = [];
  const step = 2;
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  for (let y = 1; y < ah - 1; y += step) {
    for (let x = 1; x < aw - 1; x += step) {
      const idx = (y * aw + x) * 4;
      const left = idx - 4;
      const right = idx + 4;
      const up = idx - aw * 4;
      const down = idx + aw * 4;

      const lum = frame[idx] * 0.299 + frame[idx + 1] * 0.587 + frame[idx + 2] * 0.114;
      const lumL = frame[left] * 0.299 + frame[left + 1] * 0.587 + frame[left + 2] * 0.114;
      const lumR = frame[right] * 0.299 + frame[right + 1] * 0.587 + frame[right + 2] * 0.114;
      const lumU = frame[up] * 0.299 + frame[up + 1] * 0.587 + frame[up + 2] * 0.114;
      const lumD = frame[down] * 0.299 + frame[down + 1] * 0.587 + frame[down + 2] * 0.114;

      const edgeStrength =
        Math.abs(lumL - lumR) +
        Math.abs(lumU - lumD) +
        Math.abs(lum - ((lumL + lumR + lumU + lumD) * 0.25));

      if (edgeStrength > 80 && Math.random() < 0.32) {
        points.push({
          x: (x / aw) * width,
          y: (y / ah) * height
        });
      }
    }
  }

  if (points.length > 1000) {
    points.length = 1000;
  }

  state.targetPoints = points;
}

function drawConnections(points, width, height) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(132, 208, 255, 0.10)';
  ctx.lineWidth = 1;

  const sampleSize = clamp(Math.floor(points.length * 0.08), 25, 120);
  for (let i = 0; i < sampleSize; i += 1) {
    const a = points[(Math.random() * points.length) | 0];
    const b = points[(Math.random() * points.length) | 0];

    if (!a || !b) continue;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dist = Math.hypot(dx, dy);

    if (dist < Math.min(width, height) * 0.25) {
      ctx.globalAlpha = 1 - dist / (Math.min(width, height) * 0.25);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function render(ts) {
  requestAnimationFrame(render);

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  state.frameCounter += 1;
  if (state.frameCounter % state.contourUpdateEvery === 0) {
    extractContourPoints();
  }

  ctx.fillStyle = 'rgba(5, 11, 28, 0.2)';
  ctx.fillRect(0, 0, width, height);

  drawConnections(state.targetPoints, width, height);

  const hasTarget = state.targetPoints.length > 0;
  for (const p of state.particles) {
    p.update(state.targetPoints, ts, width, height);
    p.draw(ctx, hasTarget);
  }

  statusLabel.textContent = state.cameraEnabled
    ? `Tracking contours (${state.targetPoints.length} points)`
    : 'Idle (no webcam)';
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    statusLabel.textContent = 'Webcam unavailable in this browser';
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 360 },
        facingMode: 'user'
      },
      audio: false
    });

    state.stream = stream;
    video.srcObject = stream;
    state.cameraEnabled = true;
    toggleBtn.textContent = 'Stop webcam';
  } catch (err) {
    console.error(err);
    statusLabel.textContent = 'Could not access webcam';
  }
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach((t) => t.stop());
  }
  state.stream = null;
  video.srcObject = null;
  state.cameraEnabled = false;
  state.targetPoints = [];
  toggleBtn.textContent = 'Start webcam';
}

toggleBtn.addEventListener('click', () => {
  if (state.cameraEnabled) {
    stopCamera();
  } else {
    startCamera();
  }
});

particleCountInput.addEventListener('input', (e) => {
  setParticleCount(Number(e.target.value));
});

window.addEventListener('resize', resizeCanvas);

resizeCanvas();
setParticleCount(Number(particleCountInput.value));
ctx.fillStyle = '#050b1c';
ctx.fillRect(0, 0, canvas.width, canvas.height);
requestAnimationFrame(render);
