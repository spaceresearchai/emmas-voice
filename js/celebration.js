// ============================================================================
// Gentle Sensory-Safe Celebration Bubbles & Stars Overlay
// ============================================================================

const COLORS = ['#34d399', '#38bdf8', '#fbbf24', '#f472b6', '#a78bfa'];

export class CelebrationOverlay {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.particles = [];
    this.rafId = null;
    this.lastTs = 0;

    this._resizeObserver = new ResizeObserver(() => this._syncSize());
    this._resizeObserver.observe(this.canvas);
    this._syncSize();
  }

  _syncSize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
  }

  burst({ calmMode = false } = {}) {
    this._syncSize();
    const w = this.canvas.width;
    const h = this.canvas.height;
    const count = calmMode ? 10 : 24;

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: w * (0.2 + Math.random() * 0.6),
        y: h * (0.65 + Math.random() * 0.25),
        vx: (Math.random() - 0.5) * (calmMode ? 50 : 120),
        vy: -(calmMode ? 80 + Math.random() * 70 : 140 + Math.random() * 140),
        size: (calmMode ? 12 : 14) + Math.random() * 14,
        alpha: 1,
        life: 0,
        maxLife: calmMode ? 1.8 : 1.5 + Math.random() * 0.6,
        color: COLORS[i % COLORS.length],
        kind: i % 2 === 0 ? 'star' : 'bubble',
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 2.4,
      });
    }

    if (!this.rafId) {
      this.lastTs = performance.now();
      this._tick(this.lastTs);
    }
  }

  _tick(ts) {
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 45 * dt; // very gentle buoyancy gravity
      p.rot += p.vrot * dt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);

      if (p.kind === 'star') {
        this._drawStar(ctx, p.size, p.color);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.arc(-p.size * 0.18, -p.size * 0.18, p.size * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (this.particles.length > 0) {
      this.rafId = requestAnimationFrame((nextTs) => this._tick(nextTs));
    } else {
      this.rafId = null;
    }
  }

  _drawStar(ctx, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
}
