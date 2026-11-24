// ============================================================================
// Watch & Copy Articulation Coach (60fps Phoneme Lip Model + Parent Video)
// ============================================================================

const VISEME_SHAPES = {
  // open: vertical aperture (0..1), width: horizontal stretch (0.55..1.3),
  // press: lip compression for M/B/P (0..1), tongue: tongue tip lift (0..1),
  // teethLip: top teeth touching lower lip for F/V (0..1), jaw: jaw drop (0..1)
  rest:       { open: 0.04, width: 0.96, press: 0.0, tongue: 0.0, teethLip: 0.0, jaw: 0.0 },
  closed:     { open: 0.00, width: 0.92, press: 1.0, tongue: 0.0, teethLip: 0.0, jaw: 0.0 },
  openWide:   { open: 0.92, width: 1.04, press: 0.0, tongue: 0.1, teethLip: 0.0, jaw: 0.95 },
  openMid:    { open: 0.52, width: 1.02, press: 0.0, tongue: 0.15, teethLip: 0.0, jaw: 0.50 },
  roundTight: { open: 0.34, width: 0.56, press: 0.15, tongue: 0.0, teethLip: 0.0, jaw: 0.30 },
  roundOpen:  { open: 0.72, width: 0.68, press: 0.0, tongue: 0.0, teethLip: 0.0, jaw: 0.68 },
  smile:      { open: 0.24, width: 1.24, press: 0.0, tongue: 0.15, teethLip: 0.0, jaw: 0.22 },
  tongueUp:   { open: 0.38, width: 0.98, press: 0.0, tongue: 1.0, teethLip: 0.0, jaw: 0.36 },
  teethLip:   { open: 0.10, width: 1.02, press: 0.2, tongue: 0.0, teethLip: 1.0, jaw: 0.12 },
};

export class ArticulationCoach {
  constructor({ canvas, videoEl, syllableStripEl, modeBadgeEl }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.videoEl = videoEl;
    this.syllableStripEl = syllableStripEl;
    this.modeBadgeEl = modeBadgeEl;

    this.word = null;
    this.showLines = true;
    this.slowMode = false;
    this.loopEnabled = true;

    this.hasParentVideo = false;
    this.currentVideoUrl = null;

    // Animation state
    this.playing = false;
    this.elapsedMs = 0;
    this.loopWaitMs = 0;
    this.lastFrameTs = 0;
    this.blinkTimer = 2800;
    this.blinkPhase = 0;
    this.activeSylIndex = -1;

    this.currentPose = { ...VISEME_SHAPES.rest };
    this.targetPose = { ...VISEME_SHAPES.rest };

    this._raf = requestAnimationFrame((ts) => this._tick(ts));
  }

  setWord(word, parentVideoBlob = null) {
    this.word = word;
    this.elapsedMs = 0;
    this.loopWaitMs = 0;
    this.activeSylIndex = -1;

    if (this.currentVideoUrl) {
      URL.revokeObjectURL(this.currentVideoUrl);
      this.currentVideoUrl = null;
    }

    if (parentVideoBlob) {
      this.hasParentVideo = true;
      this.currentVideoUrl = URL.createObjectURL(parentVideoBlob);
      this.videoEl.src = this.currentVideoUrl;
      this.videoEl.playbackRate = this.slowMode ? 0.5 : 1.0;
      this.videoEl.loop = this.loopEnabled;
      this.videoEl.classList.remove('hidden');
      this.canvas.classList.add('hidden');
      this.modeBadgeEl.textContent = 'Parent Video';
      this.modeBadgeEl.classList.add('parent-video');
      this.videoEl.play().catch(() => {});
    } else {
      this.hasParentVideo = false;
      this.videoEl.pause();
      this.videoEl.removeAttribute('src');
      this.videoEl.classList.add('hidden');
      this.canvas.classList.remove('hidden');
      this.modeBadgeEl.textContent = 'Articulation Coach';
      this.modeBadgeEl.classList.remove('parent-video');
    }

    this._renderSyllablePills();
    this.playOnce();
  }

  setShowLines(enabled) {
    this.showLines = enabled;
  }

  setSlowMode(enabled) {
    this.slowMode = enabled;
    if (this.hasParentVideo) {
      this.videoEl.playbackRate = enabled ? 0.5 : 1.0;
    }
  }

  setLoop(enabled) {
    this.loopEnabled = enabled;
    if (this.hasParentVideo) {
      this.videoEl.loop = enabled;
      if (enabled && this.videoEl.paused) {
        this.videoEl.play().catch(() => {});
      }
    } else if (enabled && !this.playing) {
      this.playOnce();
    }
  }

  playOnce(withParentAudio = false) {
    if (this.hasParentVideo) {
      this.videoEl.muted = !withParentAudio;
      this.videoEl.currentTime = 0;
      this.videoEl.playbackRate = this.slowMode ? 0.5 : 1.0;
      this.videoEl.play().catch(() => {});
      return;
    }
    this.playing = true;
    this.elapsedMs = 0;
    this.loopWaitMs = 0;
  }

  _renderSyllablePills() {
    this.syllableStripEl.innerHTML = '';
    if (!this.word || !this.word.syllables) return;
    this.word.syllables.forEach((syl, idx) => {
      const span = document.createElement('span');
      span.className = 'syllable-pill';
      span.dataset.idx = String(idx);
      span.textContent = syl;
      this.syllableStripEl.appendChild(span);
    });
  }

  _highlightSyllable(idx) {
    if (idx === this.activeSylIndex) return;
    this.activeSylIndex = idx;
    const pills = this.syllableStripEl.querySelectorAll('.syllable-pill');
    pills.forEach((pill, i) => {
      pill.classList.toggle('active', i === idx);
    });
  }

  _tick(ts) {
    const dt = this.lastFrameTs ? Math.min(50, ts - this.lastFrameTs) : 16;
    this.lastFrameTs = ts;

    if (!this.hasParentVideo) {
      this._updateAnimation(dt);
      this._drawCoach();
    }
    this._raf = requestAnimationFrame((nextTs) => this._tick(nextTs));
  }

  _updateAnimation(dt) {
    // Gentle natural eye blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkPhase += dt / 160;
      if (this.blinkPhase >= 1) {
        this.blinkPhase = 0;
        this.blinkTimer = 2600 + Math.random() * 2400;
      }
    }

    const speed = this.slowMode ? 0.5 : 1.0;
    const timeline = this.word?.timeline || [{ v: 'rest', dur: 400, syl: -1 }];

    if (this.playing) {
      this.elapsedMs += dt * speed;
      let acc = 0;
      let found = null;
      for (const step of timeline) {
        acc += step.dur;
        if (this.elapsedMs <= acc) {
          found = step;
          break;
        }
      }
      if (found) {
        this.targetPose = VISEME_SHAPES[found.v] || VISEME_SHAPES.rest;
        this._highlightSyllable(found.syl);
      } else {
        this.playing = false;
        this.targetPose = VISEME_SHAPES.rest;
        this._highlightSyllable(-1);
        this.loopWaitMs = 1500;
      }
    } else if (this.loopEnabled) {
      this.loopWaitMs -= dt;
      if (this.loopWaitMs <= 0) {
        this.playing = true;
        this.elapsedMs = 0;
      }
    }

    // Smooth organic easing toward target viseme
    const alpha = Math.min(1, (dt / 1000) * (this.slowMode ? 9 : 16));
    for (const k of Object.keys(this.currentPose)) {
      this.currentPose[k] += (this.targetPose[k] - this.currentPose[k]) * alpha;
    }
  }

  _drawCoach() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const p = this.currentPose;

    ctx.clearRect(0, 0, w, h);

    // Warm soft studio backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#dbeafe');
    bgGrad.addColorStop(1, '#f0f9ff');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle soft bokeh circles in background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.arc(w * 0.14, h * 0.22, 42, 0, Math.PI * 2);
    ctx.arc(w * 0.87, h * 0.26, 34, 0, Math.PI * 2);
    ctx.fill();

    const cx = w * 0.5;
    const cy = h * 0.49;
    const jawDrop = p.jaw * 14;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(0.88, 0.88);
    ctx.translate(-cx, -cy);

    // Shoulders / cozy shirt
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.ellipse(cx, h + 18, 148, 72, 0, Math.PI, 0);
    ctx.fill();

    // Neck
    ctx.fillStyle = '#eab696';
    ctx.beginPath();
    ctx.roundRect(cx - 34, cy + 72, 68, 56, 20);
    ctx.fill();

    // Neck shadow
    ctx.fillStyle = 'rgba(180, 110, 74, 0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 92, 34, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Back Hair
    ctx.fillStyle = '#4a2c20';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 12, 116, 126, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.fillStyle = '#f2c1a2';
    ctx.beginPath();
    ctx.ellipse(cx - 96, cy + 4, 14, 22, -0.1, 0, Math.PI * 2);
    ctx.ellipse(cx + 96, cy + 4, 14, 22, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Face contour (stretches slightly with jawDrop!)
    const faceGrad = ctx.createRadialGradient(cx - 18, cy - 26, 20, cx, cy, 118);
    faceGrad.addColorStop(0, '#fde0c8');
    faceGrad.addColorStop(0.7, '#f5c7a7');
    faceGrad.addColorStop(1, '#e7b18e');
    ctx.fillStyle = faceGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 94, cy - 18);
    ctx.bezierCurveTo(cx - 96, cy - 102, cx + 96, cy - 102, cx + 94, cy - 18);
    ctx.bezierCurveTo(cx + 92, cy + 62 + jawDrop * 0.4, cx + 48, cy + 102 + jawDrop, cx, cy + 104 + jawDrop);
    ctx.bezierCurveTo(cx - 48, cy + 102 + jawDrop, cx - 92, cy + 62 + jawDrop * 0.4, cx - 94, cy - 18);
    ctx.closePath();
    ctx.fill();

    // Hair bangs / framing
    ctx.fillStyle = '#4a2c20';
    ctx.beginPath();
    ctx.moveTo(cx - 98, cy - 12);
    ctx.bezierCurveTo(cx - 102, cy - 114, cx + 102, cy - 114, cx + 98, cy - 12);
    ctx.bezierCurveTo(cx + 84, cy - 58, cx + 38, cy - 72, cx - 8, cy - 64);
    ctx.bezierCurveTo(cx - 56, cy - 56, cx - 82, cy - 42, cx - 98, cy - 12);
    ctx.closePath();
    ctx.fill();

    // Soft warm cheeks
    ctx.fillStyle = 'rgba(244, 114, 140, 0.16)';
    ctx.beginPath();
    ctx.ellipse(cx - 56, cy + 18, 22, 13, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 56, cy + 18, 22, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // Friendly eyebrows (subtle lift when speaking!)
    const browLift = p.open * 4;
    ctx.strokeStyle = '#4a2c20';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 56, cy - 36 - browLift);
    ctx.quadraticCurveTo(cx - 38, cy - 44 - browLift, cx - 20, cy - 36 - browLift);
    ctx.moveTo(cx + 20, cy - 36 - browLift);
    ctx.quadraticCurveTo(cx + 38, cy - 44 - browLift, cx + 56, cy - 36 - browLift);
    ctx.stroke();

    // Eyes (with natural blink)
    const blinkScale = this.blinkPhase > 0 ? Math.abs(Math.cos(this.blinkPhase * Math.PI)) : 1;
    this._drawEye(ctx, cx - 38, cy - 16, blinkScale);
    this._drawEye(ctx, cx + 38, cy - 16, blinkScale);

    // Gentle nose
    ctx.strokeStyle = 'rgba(165, 102, 70, 0.45)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 14);
    ctx.quadraticCurveTo(cx, cy + 20, cx + 8, cy + 14);
    ctx.stroke();

    // =========================================================================
    // REALISTIC ARTICULATING MOUTH (Focus area — slightly enlarged for clarity!)
    // =========================================================================
    const mx = cx;
    const my = cy + 52 + jawDrop * 0.25;
    const mouthHalfW = 46 * p.width;
    const innerHalfW = mouthHalfW * 0.80;
    const openH = Math.max(0, p.open * 34);
    const upperThick = 11 - p.press * 2.5;
    const lowerThick = 13.5 - p.press * 2.5;

    const topInnerY = my - openH * 0.42;
    const botInnerY = my + openH * 0.58;
    const topOuterY = topInnerY - upperThick;
    const botOuterY = botInnerY + lowerThick;

    // 1. Mouth Interior Cavity (visible when open)
    if (openH > 1.5) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(mx - innerHalfW, my);
      ctx.quadraticCurveTo(mx, topInnerY - 2, mx + innerHalfW, my);
      ctx.quadraticCurveTo(mx, botInnerY + 3, mx - innerHalfW, my);
      ctx.closePath();
      ctx.fillStyle = '#5c1926';
      ctx.fill();
      ctx.clip();

      // Upper teeth (realistic bright subtle curve)
      ctx.fillStyle = '#fffdf9';
      ctx.beginPath();
      ctx.roundRect(mx - innerHalfW * 0.72, topInnerY - 3, innerHalfW * 1.44, 11, 4);
      ctx.fill();

      // Lower teeth (visible on wide open)
      if (openH > 18) {
        ctx.fillStyle = '#f8f5f0';
        ctx.beginPath();
        ctx.roundRect(mx - innerHalfW * 0.62, botInnerY - 6, innerHalfW * 1.24, 9, 4);
        ctx.fill();
      }

      // Tongue (lifts clearly behind upper teeth for L / T / D / N!)
      const tongueY = botInnerY - 2 - p.tongue * Math.min(openH * 0.78, 18);
      ctx.fillStyle = '#e56b7d';
      ctx.beginPath();
      ctx.ellipse(mx, tongueY + 8, innerHalfW * 0.68, 14, 0, Math.PI, 0);
      ctx.fill();
      if (p.tongue > 0.35) {
        ctx.fillStyle = '#f28495';
        ctx.beginPath();
        ctx.ellipse(mx, tongueY + 2, innerHalfW * 0.36, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 2. Upper Lip (with natural Cupid's bow)
    const upperGrad = ctx.createLinearGradient(mx, topOuterY, mx, topInnerY + 4);
    upperGrad.addColorStop(0, '#e06377');
    upperGrad.addColorStop(1, '#c94c63');
    ctx.fillStyle = upperGrad;
    ctx.beginPath();
    ctx.moveTo(mx - mouthHalfW, my);
    ctx.bezierCurveTo(mx - mouthHalfW * 0.55, topOuterY - 2, mx - 12, topOuterY - 4, mx, topOuterY + 3);
    ctx.bezierCurveTo(mx + 12, topOuterY - 4, mx + mouthHalfW * 0.55, topOuterY - 2, mx + mouthHalfW, my);
    ctx.quadraticCurveTo(mx, topInnerY + (openH < 2 ? 2 : 0), mx - mouthHalfW, my);
    ctx.closePath();
    ctx.fill();

    // 3. Lower Lip
    const lowerGrad = ctx.createLinearGradient(mx, botInnerY, mx, botOuterY);
    lowerGrad.addColorStop(0, '#ec7587');
    lowerGrad.addColorStop(1, '#d3566d');
    ctx.fillStyle = lowerGrad;
    ctx.beginPath();
    ctx.moveTo(mx - mouthHalfW, my);
    ctx.quadraticCurveTo(mx, botInnerY + (openH < 2 ? 2 : 1), mx + mouthHalfW, my);
    ctx.bezierCurveTo(mx + mouthHalfW * 0.65, botOuterY + 2, mx - mouthHalfW * 0.65, botOuterY + 2, mx - mouthHalfW, my);
    ctx.closePath();
    ctx.fill();

    // Subtle soft highlight on lower lip
    ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.beginPath();
    ctx.ellipse(mx, botInnerY + lowerThick * 0.45, mouthHalfW * 0.32, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Teeth-on-lip visual cue for F/V
    if (p.teethLip > 0.35) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(mx - mouthHalfW * 0.36, my - 3, mouthHalfW * 0.72, 6, 2);
      ctx.fill();
    }

    // Closed-lip seam line when pressed (M/B/P)
    if (openH < 2) {
      ctx.strokeStyle = p.press > 0.5 ? '#881337' : '#9f2c46';
      ctx.lineWidth = p.press > 0.5 ? 3 : 1.8;
      ctx.beginPath();
      ctx.moveTo(mx - mouthHalfW * 0.9, my + 1);
      ctx.quadraticCurveTo(mx, my + 2.5, mx + mouthHalfW * 0.9, my + 1);
      ctx.stroke();
    }

    // 4. Optional Synchronized Lip-Tracking Guide Lines (matches Emma's live camera!)
    if (this.showLines) {
      const isMoving = p.open > 0.16 || p.press > 0.45 || Math.abs(p.width - 0.96) > 0.16;
      const contourColor = isMoving ? '#10b981' : '#38bdf8';

      ctx.save();
      // Outer lip contour tracking loop
      ctx.strokeStyle = contourColor;
      ctx.lineWidth = 2.6;
      ctx.shadowColor = contourColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(mx - mouthHalfW, my);
      ctx.bezierCurveTo(mx - mouthHalfW * 0.55, topOuterY - 2, mx - 12, topOuterY - 4, mx, topOuterY + 3);
      ctx.bezierCurveTo(mx + 12, topOuterY - 4, mx + mouthHalfW * 0.55, topOuterY - 2, mx + mouthHalfW, my);
      ctx.bezierCurveTo(mx + mouthHalfW * 0.65, botOuterY + 2, mx - mouthHalfW * 0.65, botOuterY + 2, mx - mouthHalfW, my);
      ctx.closePath();
      ctx.stroke();

      // Horizontal width measurement line (amber)
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(mx - mouthHalfW, my);
      ctx.lineTo(mx + mouthHalfW, my);
      ctx.stroke();

      // Vertical aperture measurement line (mint)
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.6;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(mx, topInnerY);
      ctx.lineTo(mx, botInnerY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Anchor dots
      this._dot(ctx, mx - mouthHalfW, my, 4.2, '#f59e0b');
      this._dot(ctx, mx + mouthHalfW, my, 4.2, '#f59e0b');
      this._dot(ctx, mx, topInnerY, 4.2, '#10b981');
      this._dot(ctx, mx, botInnerY, 4.2, '#10b981');
      ctx.restore();
    }

    ctx.restore();

    // Slow-motion pill indicator in top-left of canvas
    if (this.slowMode) {
      ctx.fillStyle = 'rgba(37, 99, 235, 0.88)';
      ctx.beginPath();
      ctx.roundRect(12, 12, 92, 26, 13);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 12px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🐢 0.5× SLOW', 58, 25);
    }
  }

  _drawEye(ctx, x, y, blinkScale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, Math.max(0.08, blinkScale));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3b2417';
    ctx.beginPath();
    ctx.arc(0, 0, 7.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-2.5, -2.5, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _dot(ctx, x, y, r, color) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
