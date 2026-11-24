// ============================================================================
// Joyful Felicitation Celebration Overlay (Stars, Confetti Ribbons, Halos)
// ============================================================================

const COLORS = ['#34d399', '#38bdf8', '#fbbf24', '#f472b6', '#a78bfa', '#fb7185'];

export class CelebrationOverlay {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.particles = [];
    this.rings = [];
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

  burst({ calmMode = false, festive = true } = {}) {
    this._syncSize();
    const w = this.canvas.width;
    const h = this.canvas.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Expanding radiant celebration halo ring from center!
    this.rings.push({
      x: w * 0.5,
      y: h * 0.52,
      r: 30 * dpr,
      maxR: Math.min(w, h) * (calmMode ? 0.36 : 0.52),
      life: 0,
      maxLife: calmMode ? 1.1 : 0.85,
      color: '#34d399',
    });

    if (!calmMode && festive) {
      this.rings.push({
        x: w * 0.5,
        y: h * 0.52,
        r: 18 * dpr,
        maxR: Math.min(w, h) * 0.42,
        life: -0.14,
        maxLife: 0.9,
        color: '#fbbf24',
      });
    }

    const count = calmMode ? 12 : festive ? 46 : 26;
    for (let i = 0; i < count; i++) {
      const fromCenter = festive && !calmMode && i % 3 === 0;
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = (140 + Math.random() * 200) * dpr;

      this.particles.push({
        x: fromCenter ? w * 0.5 : w * (0.14 + Math.random() * 0.72),
        y: fromCenter ? h * 0.52 : h * (0.62 + Math.random() * 0.28),
        vx: fromCenter ? Math.cos(angle) * speed : (Math.random() - 0.5) * (calmMode ? 55 : 150) * dpr,
        vy: fromCenter ? Math.sin(angle) * speed - 60 * dpr : -(calmMode ? 80 + Math.random() * 65 : 170 + Math.random() * 190) * dpr,
        size: ((calmMode ? 11 : 12) + Math.random() * 12) * dpr,
        alpha: 1,
        life: 0,
        maxLife: calmMode ? 1.85 : 1.55 + Math.random() * 0.75,
        color: COLORS[i % COLORS.length],
        kind: calmMode ? (i % 2 === 0 ? 'bubble' : 'star') : (i % 3 === 0 ? 'star' : i % 3 === 1 ? 'ribbon' : 'bubble'),
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * (calmMode ? 1.5 : 5.2),
        gravity: (calmMode ? 35 : 150) * dpr,
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

    // Draw expanding celebration rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const rg = this.rings[i];
      rg.life += dt;
      if (rg.life < 0) continue;
      if (rg.life >= rg.maxLife) {
        this.rings.splice(i, 1);
        continue;
      }
      const t = rg.life / rg.maxLife;
      const ease = 1 - Math.pow(1 - t, 3);
      const currR = rg.r + (rg.maxR - rg.r) * ease;
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.65;
      ctx.strokeStyle = rg.color;
      ctx.lineWidth = Math.max(2, (1 - t) * 14);
      ctx.beginPath();
      ctx.arc(rg.x, rg.y, currR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Draw particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= 0.99;
      p.rot += p.vrot * dt;
      p.alpha = Math.max(0, 1 - Math.pow(p.life / p.maxLife, 1.4));

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);

      if (p.kind === 'star') {
        this._drawStar(ctx, p.size * 0.75, p.color);
      } else if (p.kind === 'ribbon') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.roundRect(-p.size * 0.55, -p.size * 0.24, p.size * 1.1, p.size * 0.48, p.size * 0.14);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.48, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.arc(-p.size * 0.16, -p.size * 0.16, p.size * 0.15, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (this.particles.length > 0 || this.rings.length > 0) {
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
