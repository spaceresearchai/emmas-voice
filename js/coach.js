// ============================================================================
// Amplified Watch & Copy Oral-Motor & Speech Articulation Coach (60fps)
// Shows enlarged, crystal-clear Lips, Teeth, Cheeks, Tongue & Animated Arrows
// ============================================================================

const POSE_SHAPES = {
  // open: vertical opening (0..1.1), width: horizontal width (0.50..1.35),
  // press: lip press (0..1), pucker: kiss protrusion (0..1),
  // cheekPuff: cheek inflation (0..1),
  // tongueIn: internal tip lift for L/T/D (0..1),
  // tongueOut: external protrusion (0..1), tongueX: (-1 left .. +1 right), tongueY: (-1 up .. +1 down)
  // teethLip: top teeth on bottom lip (0..1), jaw: jaw drop (0..1.1)
  rest:            { open: 0.04, width: 0.96, press: 0.0, pucker: 0.0, cheekPuff: 0.0, tongueIn: 0.0, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, teethLip: 0.0, jaw: 0.0 },
  closed:          { open: 0.00, width: 0.90, press: 1.0, pucker: 0.0, cheekPuff: 0.0, tongueIn: 0.0, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, teethLip: 0.0, jaw: 0.0 },
  openWide:        { open: 0.90, width: 1.04, press: 0.0, pucker: 0.0, cheekPuff: 0.0, tongueIn: 0.1, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, teethLip: 0.0, jaw: 0.92 },
  openBig:         { open: 1.08, width: 1.06, press: 0.0, pucker: 0.0, cheekPuff: 0.0, tongueIn: 0.0, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, teethLip: 0.0, jaw: 1.08 },
  openMid:         { open: 0.54, width: 1.00, press: 0.0, pucker: 0.0, cheekPuff: 0.0, tongueIn: 0.15, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, teethLip: 0.0, jaw: 0.52 },
  roundTight:      { open: 0.32, width: 0.56, press: 0.1, pucker: 0.75, cheekPuff: 0.0, tongueIn: 0.0, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, teethLip: 0.0, jaw: 0.28 },
  kissPucker:      { open: 0.22, width: 0.48, press: 0.2, pucker: 1.0, cheekPuff: 0.0, tongueIn: 0.0, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, teethLip: 0.0, jaw: 0.22 },
  roundOpen:       { open: 0.70, width: 0.68, press: 0.0, pucker: 0.45, cheekPuff: 0.0, tongueIn: 0.0, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, teethLip: 0.0, jaw: 0.66 },
  smile:           { open: 0.24, width: 1.24, press: 0.0, pucker: 0.0, cheekPuff: 0.0, tongueIn: 0.1, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, teethLip: 0.0, jaw: 0.20 },
  bigSmile:        { open: 0.34, width: 1.36, press: 0.0, pucker: 0.0, cheekPuff: 0.0, tongueIn: 0.0, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, teethLip: 0.0, jaw: 0.26 },
  tongueUp:        { open: 0.44, width: 0.98, press: 0.0, pucker: 0.0, cheekPuff: 0.0, tongueIn: 1.0, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, teethLip: 0.0, jaw: 0.42 },
  teethLip:        { open: 0.10, width: 1.02, press: 0.2, pucker: 0.0, cheekPuff: 0.0, tongueIn: 0.0, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, teethLip: 1.0, jaw: 0.12 },
  // Explicit Tongue & Cheek Oral-Motor Poses!
  tongueOut:       { open: 0.72, width: 1.02, press: 0.0, pucker: 0.0, cheekPuff: 0.0, tongueIn: 0.0, tongueOut: 1.0, tongueX: 0.0, tongueY: 0.28, teethLip: 0.0, jaw: 0.68 },
  tongueLeft:      { open: 0.66, width: 1.02, press: 0.0, pucker: 0.0, cheekPuff: 0.0, tongueIn: 0.0, tongueOut: 0.92, tongueX: -0.92, tongueY: 0.12, teethLip: 0.0, jaw: 0.62 },
  tongueRight:     { open: 0.66, width: 1.02, press: 0.0, pucker: 0.0, cheekPuff: 0.0, tongueIn: 0.0, tongueOut: 0.92, tongueX: 0.92, tongueY: 0.12, teethLip: 0.0, jaw: 0.62 },
  tongueReachUp:   { open: 0.74, width: 1.00, press: 0.0, pucker: 0.0, cheekPuff: 0.0, tongueIn: 0.0, tongueOut: 0.95, tongueX: 0.0, tongueY: -0.95, teethLip: 0.0, jaw: 0.68 },
  tongueReachDown: { open: 0.78, width: 1.00, press: 0.0, pucker: 0.0, cheekPuff: 0.0, tongueIn: 0.0, tongueOut: 1.08, tongueX: 0.0, tongueY: 1.0, teethLip: 0.0, jaw: 0.76 },
  cheekPuff:       { open: 0.00, width: 0.84, press: 0.9, pucker: 0.25, cheekPuff: 1.0, tongueIn: 0.0, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, teethLip: 0.0, jaw: 0.08 },
};

export class ArticulationCoach {
  constructor({ canvas, videoEl, syllableStripEl, modeBadgeEl }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.videoEl = videoEl;
    this.syllableStripEl = syllableStripEl;
    this.modeBadgeEl = modeBadgeEl;

    this.item = null; // Either a Move or a Word object
    this.isMoveMode = true;
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
    this.clockSec = 0;
    this.blinkTimer = 2800;
    this.blinkPhase = 0;
    this.activeStepIdx = -1;

    this.currentPose = { ...POSE_SHAPES.rest };
    this.targetPose = { ...POSE_SHAPES.rest };

    this._resizeObserver = new ResizeObserver(() => this._syncSize());
    this._resizeObserver.observe(this.canvas);
    this._syncSize();

    this._raf = requestAnimationFrame((ts) => this._tick(ts));
  }

  _syncSize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(360, Math.round(rect.width * dpr));
    const h = Math.max(260, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  setItem(item, { isMoveMode = true, parentVideoBlob = null } = {}) {
    this.item = item;
    this.isMoveMode = isMoveMode;
    this.elapsedMs = 0;
    this.loopWaitMs = 0;
    this.activeStepIdx = -1;

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
      this.modeBadgeEl.textContent = isMoveMode ? 'Lips & Tongue Coach' : 'Speech Coach';
      this.modeBadgeEl.classList.remove('parent-video');
    }

    this._renderStepPills();
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

  _renderStepPills() {
    this.syllableStripEl.innerHTML = '';
    const labels = this.item?.steps || this.item?.syllables || [];
    labels.forEach((txt, idx) => {
      const span = document.createElement('span');
      span.className = 'syllable-pill';
      span.dataset.idx = String(idx);
      span.textContent = txt;
      this.syllableStripEl.appendChild(span);
    });
  }

  _highlightStep(idx) {
    if (idx === this.activeStepIdx) return;
    this.activeStepIdx = idx;
    const pills = this.syllableStripEl.querySelectorAll('.syllable-pill');
    pills.forEach((pill, i) => {
      pill.classList.toggle('active', i === idx);
    });
  }

  _tick(ts) {
    const dt = this.lastFrameTs ? Math.min(50, ts - this.lastFrameTs) : 16;
    this.lastFrameTs = ts;
    this.clockSec += dt / 1000;

    if (!this.hasParentVideo) {
      this._syncSize();
      this._updateAnimation(dt);
      this._drawCoach();
    }
    this._raf = requestAnimationFrame((nextTs) => this._tick(nextTs));
  }

  _updateAnimation(dt) {
    // Gentle blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkPhase += dt / 160;
      if (this.blinkPhase >= 1) {
        this.blinkPhase = 0;
        this.blinkTimer = 2500 + Math.random() * 2400;
      }
    }

    const speed = this.slowMode ? 0.5 : 1.0;
    const timeline = this.item?.timeline || [{ v: 'rest', dur: 400, step: -1 }];

    if (this.playing) {
      this.elapsedMs += dt * speed;
      let acc = 0;
      let found = null;
      for (const frame of timeline) {
        acc += frame.dur;
        if (this.elapsedMs <= acc) {
          found = frame;
          break;
        }
      }
      if (found) {
        this.targetPose = POSE_SHAPES[found.v] || POSE_SHAPES.rest;
        const idx = found.step !== undefined ? found.step : (found.syl ?? -1);
        this._highlightStep(idx);
      } else {
        this.playing = false;
        this.targetPose = POSE_SHAPES.rest;
        this._highlightStep(-1);
        this.loopWaitMs = this.isMoveMode ? 900 : 1350;
      }
    } else if (this.loopEnabled) {
      this.loopWaitMs -= dt;
      if (this.loopWaitMs <= 0) {
        this.playing = true;
        this.elapsedMs = 0;
      }
    }

    // Smooth organic spring interpolation
    const alpha = Math.min(1, (dt / 1000) * (this.slowMode ? 6.5 : 11.5));
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

    // Soft bright studio gradient
    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.45, w * 0.08, w * 0.5, h * 0.5, w * 0.72);
    bgGrad.addColorStop(0, '#f0f9ff');
    bgGrad.addColorStop(0.65, '#e0f2fe');
    bgGrad.addColorStop(1, '#dbeafe');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle soft background bubbles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(w * 0.12, h * 0.18, Math.min(w, h) * 0.11, 0, Math.PI * 2);
    ctx.arc(w * 0.89, h * 0.22, Math.min(w, h) * 0.09, 0, Math.PI * 2);
    ctx.arc(w * 0.86, h * 0.80, Math.min(w, h) * 0.07, 0, Math.PI * 2);
    ctx.fill();

    // Scale everything cleanly with comfortable headroom in the enlarged coach stage
    const unit = Math.min(w / 460, h / 320);
    const cx = w * 0.5;
    const cy = h * 0.48;
    const jawDrop = p.jaw * 16;
    const puff = p.cheekPuff;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(unit * 1.03, unit * 1.03);

    // Shoulders
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.ellipse(0, 152, 140, 62, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath();
    ctx.ellipse(0, 134, 48, 16, 0, 0, Math.PI);
    ctx.fill();

    // Neck
    ctx.fillStyle = '#eab696';
    ctx.beginPath();
    ctx.roundRect(-34, 72, 68, 56, 20);
    ctx.fill();
    ctx.fillStyle = 'rgba(180, 110, 74, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 96, 36, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Back Hair
    ctx.fillStyle = '#4a2c20';
    ctx.beginPath();
    ctx.ellipse(0, -14, 118, 118, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.fillStyle = '#f2c1a2';
    ctx.beginPath();
    ctx.ellipse(-98, 2, 14, 21, -0.08, 0, Math.PI * 2);
    ctx.ellipse(98, 2, 14, 21, 0.08, 0, Math.PI * 2);
    ctx.fill();

    // Face contour (stretches with jawDrop AND widens cheeks with cheekPuff!)
    const cheekOut = puff * 20;
    const faceGrad = ctx.createRadialGradient(-20, -28, 18, 0, 8, 125);
    faceGrad.addColorStop(0, '#ffe3cb');
    faceGrad.addColorStop(0.68, '#f6c8a8');
    faceGrad.addColorStop(1, '#e4ae89');
    ctx.fillStyle = faceGrad;
    ctx.beginPath();
    ctx.moveTo(-95, -24);
    ctx.bezierCurveTo(-96, -104, 96, -104, 95, -24);
    ctx.bezierCurveTo(96 + cheekOut, 48 + jawDrop * 0.35, 58 + cheekOut * 0.45, 98 + jawDrop, 0, 102 + jawDrop);
    ctx.bezierCurveTo(-58 - cheekOut * 0.45, 98 + jawDrop, -96 - cheekOut, 48 + jawDrop * 0.35, -95, -24);
    ctx.closePath();
    ctx.fill();

    // Soft Hair Bangs (neatly framed with headroom!)
    ctx.fillStyle = '#4a2c20';
    ctx.beginPath();
    ctx.moveTo(-100, -16);
    ctx.bezierCurveTo(-104, -110, 104, -110, 100, -16);
    ctx.bezierCurveTo(84, -64, 40, -78, -6, -68);
    ctx.bezierCurveTo(-56, -58, -84, -46, -100, -16);
    ctx.closePath();
    ctx.fill();

    // Warm Cheeks (inflate & glow pinker when puffing cheeks!)
    const cheekRadiusX = 22 + puff * 14;
    const cheekRadiusY = 14 + puff * 10;
    ctx.fillStyle = `rgba(244, 114, 140, ${0.18 + puff * 0.26})`;
    ctx.beginPath();
    ctx.ellipse(-60 - puff * 6, 26, cheekRadiusX, cheekRadiusY, 0, 0, Math.PI * 2);
    ctx.ellipse(60 + puff * 6, 26, cheekRadiusX, cheekRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Puffed Cheek Highlight Shine & Curves
    if (puff > 0.25) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${puff * 0.7})`;
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(-66 - puff * 6, 26, 22, Math.PI * 0.72, Math.PI * 1.28);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(66 + puff * 6, 26, 22, -Math.PI * 0.28, Math.PI * 0.28);
      ctx.stroke();
    }

    // Friendly Eyebrows (expressive lift!)
    const browLift = p.open * 4.5 + p.tongueOut * 3 + puff * 3;
    ctx.strokeStyle = '#4a2c20';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-58, -44 - browLift);
    ctx.quadraticCurveTo(-40, -52 - browLift, -22, -44 - browLift);
    ctx.moveTo(22, -44 - browLift);
    ctx.quadraticCurveTo(40, -52 - browLift, 58, -44 - browLift);
    ctx.stroke();

    // Expressive Blinking Eyes (shifted slightly higher to give HUGE focus to lips & tongue!)
    const blinkScale = this.blinkPhase > 0 ? Math.abs(Math.cos(this.blinkPhase * Math.PI)) : 1;
    this._drawEye(ctx, -40, -24, blinkScale);
    this._drawEye(ctx, 40, -24, blinkScale);

    // Gentle Nose
    ctx.strokeStyle = 'rgba(165, 102, 70, 0.45)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-8, 4);
    ctx.quadraticCurveTo(0, 10, 8, 4);
    ctx.stroke();

    // =========================================================================
    // ENLARGED, CRYSTAL-CLEAR LIPS & TONGUE STAGE (Hero Area!)
    // =========================================================================
    const mx = 0;
    const my = 46 + jawDrop * 0.22;
    const mouthHalfW = 54 * p.width;
    const innerHalfW = mouthHalfW * 0.80;
    const openH = Math.max(0, p.open * 42);
    const upperThick = 12.5 + p.pucker * 4.5 - p.press * 2.5;
    const lowerThick = 15.5 + p.pucker * 4.5 - p.press * 2.5;

    const topInnerY = my - openH * 0.42;
    const botInnerY = my + openH * 0.58;
    const topOuterY = topInnerY - upperThick;
    const botOuterY = botInnerY + lowerThick;

    // 1. Mouth Interior Cavity (dark warm maroon + teeth + internal tongue)
    if (openH > 1.5) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(mx - innerHalfW, my);
      ctx.quadraticCurveTo(mx, topInnerY - 2, mx + innerHalfW, my);
      ctx.quadraticCurveTo(mx, botInnerY + 3, mx - innerHalfW, my);
      ctx.closePath();
      ctx.fillStyle = '#581523';
      ctx.fill();
      ctx.clip();

      // Upper teeth
      ctx.fillStyle = '#fffdf9';
      ctx.beginPath();
      ctx.roundRect(mx - innerHalfW * 0.74, topInnerY - 3, innerHalfW * 1.48, 12, 4);
      ctx.fill();

      // Lower teeth (when open wide & tongue not covering them)
      if (openH > 20 && p.tongueOut < 0.3) {
        ctx.fillStyle = '#f8f5f0';
        ctx.beginPath();
        ctx.roundRect(mx - innerHalfW * 0.64, botInnerY - 6, innerHalfW * 1.28, 10, 4);
        ctx.fill();
      }

      // Internal tongue base (visible inside mouth even before sticking out)
      const innerTongueY = botInnerY - 2 - p.tongueIn * Math.min(openH * 0.8, 22);
      ctx.fillStyle = '#e5637b';
      ctx.beginPath();
      ctx.ellipse(mx, innerTongueY + 8, innerHalfW * 0.7, 16, 0, Math.PI, 0);
      ctx.fill();
      if (p.tongueIn > 0.35) {
        ctx.fillStyle = '#f48498';
        ctx.beginPath();
        ctx.ellipse(mx, innerTongueY + 1, innerHalfW * 0.38, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 2. Upper Lip (rich 3D vermilion gradient with Cupid's bow)
    const upperGrad = ctx.createLinearGradient(mx, topOuterY, mx, topInnerY + 4);
    upperGrad.addColorStop(0, '#e8617a');
    upperGrad.addColorStop(1, '#c9455f');
    ctx.fillStyle = upperGrad;
    ctx.beginPath();
    ctx.moveTo(mx - mouthHalfW, my);
    ctx.bezierCurveTo(mx - mouthHalfW * 0.55, topOuterY - 2, mx - 14, topOuterY - 5, mx, topOuterY + 3.5);
    ctx.bezierCurveTo(mx + 14, topOuterY - 5, mx + mouthHalfW * 0.55, topOuterY - 2, mx + mouthHalfW, my);
    ctx.quadraticCurveTo(mx, topInnerY + (openH < 2 ? 2 : 0), mx - mouthHalfW, my);
    ctx.closePath();
    ctx.fill();

    // 3. Lower Lip
    const lowerGrad = ctx.createLinearGradient(mx, botInnerY, mx, botOuterY);
    lowerGrad.addColorStop(0, '#f07188');
    lowerGrad.addColorStop(1, '#d14d68');
    ctx.fillStyle = lowerGrad;
    ctx.beginPath();
    ctx.moveTo(mx - mouthHalfW, my);
    ctx.quadraticCurveTo(mx, botInnerY + (openH < 2 ? 2 : 1), mx + mouthHalfW, my);
    ctx.bezierCurveTo(mx + mouthHalfW * 0.65, botOuterY + 3, mx - mouthHalfW * 0.65, botOuterY + 3, mx - mouthHalfW, my);
    ctx.closePath();
    ctx.fill();

    // Soft glossy highlight on lower lip
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.beginPath();
    ctx.ellipse(mx, botInnerY + lowerThick * 0.45, mouthHalfW * 0.34, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Teeth-on-lip cue for F/V
    if (p.teethLip > 0.35) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(mx - mouthHalfW * 0.36, my - 3, mouthHalfW * 0.72, 6, 2);
      ctx.fill();
    }

    // Closed lip seam line
    if (openH < 2) {
      ctx.strokeStyle = p.press > 0.5 ? '#881337' : '#9f2c46';
      ctx.lineWidth = p.press > 0.5 ? 3.5 : 2;
      ctx.beginPath();
      ctx.moveTo(mx - mouthHalfW * 0.9, my + 1);
      ctx.quadraticCurveTo(mx, my + 2.5, mx + mouthHalfW * 0.9, my + 1);
      ctx.stroke();
    }

    // =========================================================================
    // 4. EXPRESSIVE 3D PROTRUDING TONGUE (Draws OVER lips when sticking out!)
    // =========================================================================
    let tongueTipX = mx;
    let tongueTipY = my;
    if (p.tongueOut > 0.06) {
      const tOut = p.tongueOut;
      const baseW = 24 + tOut * 6;
      const tipX = mx + p.tongueX * 44 * tOut;
      const tipY = my + 6 + p.tongueY * 36 * tOut + (p.tongueY >= 0 ? tOut * 14 : -tOut * 6);
      tongueTipX = tipX;
      tongueTipY = tipY;

      ctx.save();
      // Subtle cast shadow under protruding tongue onto chin/lip
      ctx.shadowColor = 'rgba(136, 19, 55, 0.32)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;

      const tGrad = ctx.createLinearGradient(mx, my - 6, tipX, tipY);
      tGrad.addColorStop(0, '#e14d6c');
      tGrad.addColorStop(0.55, '#fb7185');
      tGrad.addColorStop(1, '#fda4af');
      ctx.fillStyle = tGrad;

      // Smooth organic tongue silhouette from mouth center curving to (tipX, tipY)
      const dx = tipX - mx;
      const dy = tipY - my;
      const len = Math.max(12, Math.hypot(dx, dy));
      const nx = -dy / len;
      const ny = dx / len;
      const midX = mx + dx * 0.56;
      const midY = my + dy * 0.56;
      const tipW = baseW * 0.72;

      ctx.beginPath();
      ctx.moveTo(mx - baseW * 0.85, my + 2);
      ctx.quadraticCurveTo(midX + nx * tipW, midY + ny * tipW, tipX, tipY);
      ctx.quadraticCurveTo(midX - nx * tipW, midY - ny * tipW, mx + baseW * 0.85, my + 2);
      ctx.closePath();
      ctx.fill();

      // Natural soft tongue center groove line
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = 'rgba(190, 24, 93, 0.35)';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(mx, my + 2);
      ctx.quadraticCurveTo(midX, midY, mx + dx * 0.76, my + dy * 0.76);
      ctx.stroke();

      // Glossy highlight dot near tongue tip
      ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
      ctx.beginPath();
      ctx.ellipse(mx + dx * 0.65 - 5, my + dy * 0.65 - 3, 6, 3, Math.atan2(dy, dx), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // =========================================================================
    // 5. SYNCHRONIZED TRACKING LINES & ANIMATED DIRECTIONAL GUIDE ARROWS
    // =========================================================================
    if (this.showLines) {
      const isActive =
        p.open > 0.16 || p.press > 0.45 || p.pucker > 0.35 || p.tongueOut > 0.15 || p.cheekPuff > 0.25 || Math.abs(p.width - 0.96) > 0.16;
      const contourColor = isActive ? '#10b981' : '#38bdf8';

      ctx.save();
      // Outer lip contour tracking loop
      ctx.strokeStyle = contourColor;
      ctx.lineWidth = 2.8;
      ctx.shadowColor = contourColor;
      ctx.shadowBlur = 9;
      ctx.beginPath();
      ctx.moveTo(mx - mouthHalfW, my);
      ctx.bezierCurveTo(mx - mouthHalfW * 0.55, topOuterY - 2, mx - 14, topOuterY - 5, mx, topOuterY + 3.5);
      ctx.bezierCurveTo(mx + 14, topOuterY - 5, mx + mouthHalfW * 0.55, topOuterY - 2, mx + mouthHalfW, my);
      ctx.bezierCurveTo(mx + mouthHalfW * 0.65, botOuterY + 3, mx - mouthHalfW * 0.65, botOuterY + 3, mx - mouthHalfW, my);
      ctx.closePath();
      ctx.stroke();

      ctx.shadowBlur = 0;
      // Horizontal width line
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(mx - mouthHalfW, my);
      ctx.lineTo(mx + mouthHalfW, my);
      ctx.stroke();

      // Vertical aperture line
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.6;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(mx, topInnerY);
      ctx.lineTo(mx, botInnerY);
      ctx.stroke();
      ctx.setLineDash([]);

      this._dot(ctx, mx - mouthHalfW, my, 4.4, '#f59e0b');
      this._dot(ctx, mx + mouthHalfW, my, 4.4, '#f59e0b');
      this._dot(ctx, mx, topInnerY, 4.4, '#10b981');
      this._dot(ctx, mx, botInnerY, 4.4, '#10b981');

      // Glowing Pink Tongue Tip Marker when tongue moves!
      if (p.tongueOut > 0.15) {
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 2.8;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(tongueTipX, tongueTipY);
        ctx.stroke();
        ctx.setLineDash([]);
        this._dot(ctx, tongueTipX, tongueTipY, 6, '#ec4899');
      }

      // Draw intuitive pulsing directional arrows for Oral-Motor Moves!
      if (this.isMoveMode && this.item?.guide) {
        this._drawMoveGuideArrows(ctx, this.item.guide, mx, my, mouthHalfW, topOuterY, botOuterY, puff);
      }

      ctx.restore();
    }

    ctx.restore();

    // Slow-motion badge (DPR-aware)
    if (this.slowMode) {
      const dpr = w / Math.max(1, this.canvas.clientWidth);
      ctx.fillStyle = 'rgba(37, 99, 235, 0.9)';
      ctx.beginPath();
      ctx.roundRect(12 * dpr, 12 * dpr, 98 * dpr, 26 * dpr, 13 * dpr);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 ${Math.round(12 * dpr)}px Nunito, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🐢 0.5× SLOW', 61 * dpr, 25 * dpr);
    }
  }

  _drawMoveGuideArrows(ctx, guide, mx, my, mouthHalfW, topOuterY, botOuterY, puff) {
    const pulse = Math.sin(this.clockSec * 5) * 4;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (guide === 'openWide' || guide === 'lipPop') {
      this._drawArrow(ctx, mx, topOuterY - 12 - pulse, mx, topOuterY - 30 - pulse, '#10b981');
      this._drawArrow(ctx, mx, botOuterY + 12 + pulse, mx, botOuterY + 30 + pulse, '#10b981');
    } else if (guide === 'smile') {
      this._drawArrow(ctx, mx - mouthHalfW - 10 - pulse, my, mx - mouthHalfW - 30 - pulse, my, '#f59e0b');
      this._drawArrow(ctx, mx + mouthHalfW + 10 + pulse, my, mx + mouthHalfW + 30 + pulse, my, '#f59e0b');
    } else if (guide === 'kiss') {
      // Inward arrows + pulsing "O" circle
      this._drawArrow(ctx, mx - mouthHalfW - 32 + pulse, my, mx - mouthHalfW - 12 + pulse, my, '#ec4899');
      this._drawArrow(ctx, mx + mouthHalfW + 32 - pulse, my, mx + mouthHalfW + 12 - pulse, my, '#ec4899');
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(mx, my, 24 + pulse * 0.4, 0, Math.PI * 2);
      ctx.stroke();
    } else if (guide === 'tongueOut' || guide === 'tongueDown') {
      this._drawArrow(ctx, mx, botOuterY + 16 + pulse, mx, botOuterY + 38 + pulse, '#ec4899');
    } else if (guide === 'tongueUp') {
      this._drawArrow(ctx, mx, topOuterY - 6 - pulse, mx, topOuterY - 28 - pulse, '#ec4899');
    } else if (guide === 'tongueWiggle') {
      this._drawArrow(ctx, mx - 26 - pulse, my + 24, mx - 54 - pulse, my + 24, '#ec4899');
      this._drawArrow(ctx, mx + 26 + pulse, my + 24, mx + 54 + pulse, my + 24, '#ec4899');
    } else if (guide === 'cheekPuff') {
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(-86 - puff * 6 - pulse * 0.6, 26, 18, Math.PI * 0.68, Math.PI * 1.32);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(86 + puff * 6 + pulse * 0.6, 26, 18, -Math.PI * 0.32, Math.PI * 0.32);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawArrow(ctx, x1, y1, x2, y2, color) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = 9;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
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
