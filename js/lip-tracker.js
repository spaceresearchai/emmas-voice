// ============================================================================
// Real-Time Camera Lip Tracker (MediaPipe FaceLandmarker + Line Overlay + Demo)
// ============================================================================

const OUTER_LIP = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
const INNER_LIP = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
const JAW_LINE = [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454];

const MP_CDNS = [
  {
    moduleUrl: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs',
    wasmBase: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
  },
  {
    moduleUrl: 'https://unpkg.com/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs',
    wasmBase: 'https://unpkg.com/@mediapipe/tasks-vision@0.10.14/wasm',
  },
];

const FACE_LANDMARKER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export class LipTracker {
  constructor({
    videoEl,
    canvasEl,
    onStatusChange,
    onMetrics,
    onLipTrigger,
    onModelLoading,
  }) {
    this.videoEl = videoEl;
    this.canvasEl = canvasEl;
    this.ctx = canvasEl.getContext('2d');

    this.onStatusChange = onStatusChange || (() => {});
    this.onMetrics = onMetrics || (() => {});
    this.onLipTrigger = onLipTrigger || (() => {});
    this.onModelLoading = onModelLoading || (() => {});

    this.mode = 'idle'; // 'idle' | 'camera' | 'demo'
    this.stream = null;
    this.faceLandmarker = null;
    this.filesetResolver = null;
    this.activeDelegate = 'GPU';
    this.consecutiveFrameErrors = 0;
    this.rafId = null;
    this.lastDetectTs = 0; // Strictly monotonic ms across FaceLandmarker lifetime
    this.lastFrameDetectWall = 0;

    // Configurable settings
    this.settings = {
      detectionMode: 'encourage',
      sensitivity: 6,
      cooldownSec: 2.5,
      lineStyle: 'clean',
      targetShape: 'bilabial',
    };

    // Adaptive baseline & movement state
    this.baseline = {
      ready: false,
      openness: 0.04,
      outerH: 0.22,
      width: 0.56,
      samples: 0,
    };
    this.prevMetrics = { openness: 0, width: 0, cx: 0.5, cy: 0.5 };
    this.smoothScore = 0;
    this.activeHoldMs = 0;
    this.lastFrameTs = 0;
    this.lastTriggerTs = 0;
    this.rewardHighlightUntil = 0;
    this.sawClosedBeforeOpen = false;

    // Demo simulator state
    this.demoPhase = 0;
    this.demoBurstUntil = 0;
    this.demoAutoNext = 0;

    this._resizeObserver = new ResizeObserver(() => this._syncCanvasSize());
    this._resizeObserver.observe(this.canvasEl);
    this._syncCanvasSize();
  }

  updateSettings(partial) {
    Object.assign(this.settings, partial);
  }

  recalibrate() {
    this.baseline.ready = false;
    this.baseline.samples = 0;
    this.activeHoldMs = 0;
    this.smoothScore = 0;
  }

  triggerDemoLipMovement() {
    this.demoBurstUntil = performance.now() + 1400;
  }

  async startCamera() {
    this.stop();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera access is not available in this browser context. Please open over HTTPS or try Demo Camera.');
    }

    this.onModelLoading(true, 'Starting front camera…');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (err) {
      this.onModelLoading(false);
      if (err.name === 'NotAllowedError') {
        throw new Error('Camera permission was blocked. Please allow camera access in your tablet browser settings, or tap "Try Demo Camera".');
      }
      throw new Error(`Could not start camera: ${err.message || err.name}`);
    }

    this.videoEl.srcObject = this.stream;
    await this.videoEl.play();

    await this._ensureFaceLandmarker();

    this.mode = 'camera';
    this.recalibrate();
    this.lastFrameTs = performance.now();
    this.lastFrameDetectWall = 0;
    this.onModelLoading(false);
    this.onStatusChange('tracking', 'Watching lips');
    this.rafId = requestAnimationFrame((ts) => this._loop(ts));
  }

  startDemo() {
    this.stop();
    this.mode = 'demo';
    this.recalibrate();
    this.lastFrameTs = performance.now();
    this.demoBurstUntil = performance.now() + 1600;
    this.demoAutoNext = performance.now() + 5200;
    this.onStatusChange('tracking', 'Demo camera active');
    this.rafId = requestAnimationFrame((ts) => this._loop(ts));
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.videoEl.srcObject = null;
    this.mode = 'idle';
    this.ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
    this.onStatusChange('idle', 'Camera paused');
  }

  async _ensureFaceLandmarker() {
    if (this.faceLandmarker) return;

    this.onModelLoading(true, 'Loading lip-tracking AI model…');
    let lastErr = null;

    for (const cdn of MP_CDNS) {
      try {
        const vision = await import(cdn.moduleUrl);
        const { FaceLandmarker, FilesetResolver } = vision;
        this.FaceLandmarkerClass = FaceLandmarker;
        this.filesetResolver = await FilesetResolver.forVisionTasks(cdn.wasmBase);

        await this._createLandmarker('GPU');
        return;
      } catch (err) {
        lastErr = err;
        console.warn('MediaPipe CDN attempt failed:', cdn.moduleUrl, err);
      }
    }

    this.onModelLoading(false);
    throw new Error(
      `Could not load the lip-tracking model (${lastErr?.message || 'network error'}). Check internet connection or try Demo Camera.`
    );
  }

  async _createLandmarker(preferredDelegate) {
    const commonOptions = {
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      minFaceDetectionConfidence: 0.35,
      minFacePresenceConfidence: 0.35,
      minTrackingConfidence: 0.35,
    };

    if (this.faceLandmarker && typeof this.faceLandmarker.close === 'function') {
      try { this.faceLandmarker.close(); } catch { /* ignore */ }
    }

    try {
      this.faceLandmarker = await this.FaceLandmarkerClass.createFromOptions(this.filesetResolver, {
        baseOptions: {
          modelAssetPath: FACE_LANDMARKER_MODEL,
          delegate: preferredDelegate,
        },
        ...commonOptions,
      });
      this.activeDelegate = preferredDelegate;
      this.consecutiveFrameErrors = 0;
    } catch (err) {
      if (preferredDelegate === 'GPU') {
        this.faceLandmarker = await this.FaceLandmarkerClass.createFromOptions(this.filesetResolver, {
          baseOptions: {
            modelAssetPath: FACE_LANDMARKER_MODEL,
            delegate: 'CPU',
          },
          ...commonOptions,
        });
        this.activeDelegate = 'CPU';
        this.consecutiveFrameErrors = 0;
      } else {
        throw err;
      }
    }
  }

  _syncCanvasSize() {
    const rect = this.canvasEl.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvasEl.width !== w || this.canvasEl.height !== h) {
      this.canvasEl.width = w;
      this.canvasEl.height = h;
    }
  }

  _loop(ts) {
    if (this.mode === 'idle') return;
    const now = performance.now();
    const dt = Math.min(60, Math.max(8, now - this.lastFrameTs));
    this.lastFrameTs = now;

    try {
      this._syncCanvasSize();

      if (this.mode === 'camera') {
        this._processCameraFrame(now, dt);
      } else if (this.mode === 'demo') {
        this._processDemoFrame(now, dt);
      }
      this.consecutiveFrameErrors = 0;
    } catch (err) {
      this.consecutiveFrameErrors++;
      console.warn('Lip tracking frame error (recovering):', err);
      if (this.consecutiveFrameErrors >= 3 && this.activeDelegate === 'GPU' && this.filesetResolver) {
        this.consecutiveFrameErrors = 0;
        this.activeDelegate = 'CPU';
        this.onModelLoading(true, 'Switching to high-compatibility CPU tracking…');
        this._createLandmarker('CPU')
          .catch((e) => console.error('CPU fallback failed:', e))
          .finally(() => this.onModelLoading(false));
      }
    }

    if (this.mode !== 'idle') {
      this.rafId = requestAnimationFrame((nextTs) => this._loop(nextTs));
    }
  }

  _processCameraFrame(now, dt) {
    const ctx = this.ctx;
    const cw = this.canvasEl.width;
    const ch = this.canvasEl.height;

    if (
      !this.faceLandmarker ||
      this.videoEl.readyState < 2 ||
      this.videoEl.videoWidth === 0 ||
      this.videoEl.videoHeight === 0
    ) {
      return;
    }

    // Throttle detection cleanly (~40fps max) without relying on video.currentTime
    if (now - this.lastFrameDetectWall < 24) return;
    this.lastFrameDetectWall = now;

    // MediaPipe VIDEO mode strictly requires monotonically increasing integer ms timestamps
    const detectTs = Math.max(this.lastDetectTs + 1, Math.floor(now));
    this.lastDetectTs = detectTs;

    const result = this.faceLandmarker.detectForVideo(this.videoEl, detectTs);
    ctx.clearRect(0, 0, cw, ch);

    if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
      this.activeHoldMs = Math.max(0, this.activeHoldMs - dt * 2);
      this.smoothScore *= 0.85;
      this._drawFindFaceGuide(ctx, cw, ch);
      this.onStatusChange('noface', 'Bring face into view');
      this.onMetrics({
        faceFound: false,
        score: 0,
        threshold: this._getThreshold(),
        openPct: 0,
        state: 'noface',
      });
      return;
    }

    const landmarks = result.faceLandmarks[0];
    const blendshapes = this._extractBlendshapes(result.faceBlendshapes?.[0]?.categories);
    const mapper = this._createCoverMapper(cw, ch, this.videoEl.videoWidth, this.videoEl.videoHeight);
    this._evaluateAndDrawLandmarks(landmarks, mapper, now, dt, blendshapes);
  }

  _extractBlendshapes(categories) {
    if (!categories || categories.length === 0) return null;
    const map = {};
    for (const c of categories) {
      map[c.categoryName] = c.score;
    }
    return map;
  }

  _processDemoFrame(ts, dt) {
    const ctx = this.ctx;
    const cw = this.canvasEl.width;
    const ch = this.canvasEl.height;
    ctx.clearRect(0, 0, cw, ch);

    // Gentle soft studio background simulating front-facing mirror
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(1, '#334155');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    // Periodically simulate a natural lip movement attempt so demo feels alive
    if (ts > this.demoAutoNext && ts > this.demoBurstUntil) {
      this.demoBurstUntil = ts + 1450;
      this.demoAutoNext = ts + 6200;
    }

    const isSpeaking = ts < this.demoBurstUntil;
    this.demoPhase += (dt / 1000) * (isSpeaking ? 6.5 : 1.4);

    // Compute synthetic openness/width wave matching target shape
    let openAmt = 0.03 + Math.sin(this.demoPhase) * 0.008;
    let widthScale = 1.0;

    if (isSpeaking) {
      const wave = Math.max(0, Math.sin(this.demoPhase));
      if (this.settings.targetShape === 'round') {
        openAmt = 0.05 + wave * 0.24;
        widthScale = 1.0 - wave * 0.24;
      } else if (this.settings.targetShape === 'smile') {
        openAmt = 0.04 + wave * 0.14;
        widthScale = 1.0 + wave * 0.22;
      } else {
        openAmt = 0.02 + wave * 0.28;
        widthScale = 1.0 + wave * 0.06;
      }
    }

    // Draw friendly silhouette head on demo mirror so tracking lines sit on a face
    const cx = cw * 0.5;
    const cy = ch * 0.47;
    const faceR = Math.min(cw, ch) * 0.31;

    ctx.save();
    // Shoulders
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.ellipse(cx, ch * 1.03, faceR * 1.5, faceR * 0.75, 0, Math.PI, 0);
    ctx.fill();

    // Head
    const skin = ctx.createRadialGradient(cx - faceR * 0.2, cy - faceR * 0.2, faceR * 0.2, cx, cy, faceR * 1.15);
    skin.addColorStop(0, '#fde2cc');
    skin.addColorStop(1, '#e8b594');
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(cx, cy, faceR * 0.78, faceR * 0.96, 0, 0, Math.PI * 2);
    ctx.fill();

    // Soft hair arc
    ctx.fillStyle = '#3b2417';
    ctx.beginPath();
    ctx.ellipse(cx, cy - faceR * 0.36, faceR * 0.80, faceR * 0.65, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(cx - faceR * 0.28, cy - faceR * 0.12, faceR * 0.065, 0, Math.PI * 2);
    ctx.arc(cx + faceR * 0.28, cy - faceR * 0.12, faceR * 0.065, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - faceR * 0.30, cy - faceR * 0.14, faceR * 0.022, 0, Math.PI * 2);
    ctx.arc(cx + faceR * 0.26, cy - faceR * 0.14, faceR * 0.022, 0, Math.PI * 2);
    ctx.fill();

    // Synthetic mouth fill under tracking lines
    const mouthY = cy + faceR * 0.36;
    const mouthW = faceR * 0.34 * widthScale;
    const innerH = faceR * openAmt * 1.15;

    ctx.fillStyle = '#dc5b72';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY, mouthW, Math.max(faceR * 0.09, innerH * 0.85 + faceR * 0.08), 0, 0, Math.PI * 2);
    ctx.fill();

    if (innerH > 4) {
      ctx.fillStyle = '#5c1926';
      ctx.beginPath();
      ctx.ellipse(cx, mouthY, mouthW * 0.76, innerH * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Build synthetic normalized 468-landmark subset matching MediaPipe indices!
    const landmarks = this._buildSyntheticLandmarks(cx, cy, faceR, openAmt, widthScale, cw, ch);
    const identityMapper = (lm) => ({ x: lm.x * cw, y: lm.y * ch });
    this._evaluateAndDrawLandmarks(landmarks, identityMapper, ts, dt);

    // Demo badge watermark (DPR-aware)
    const dpr = cw / Math.max(1, this.canvasEl.clientWidth);
    ctx.save();
    ctx.fillStyle = 'rgba(37, 99, 235, 0.88)';
    ctx.beginPath();
    ctx.roundRect(14 * dpr, ch - 40 * dpr, 152 * dpr, 26 * dpr, 13 * dpr);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round(11.5 * dpr)}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DEMO CAMERA MODE', 90 * dpr, ch - 27 * dpr);
    ctx.restore();
  }

  _buildSyntheticLandmarks(cx, cy, faceR, openAmt, widthScale, cw, ch) {
    const lms = {};
    const put = (idx, x, y) => {
      lms[idx] = { x: x / cw, y: y / ch };
    };

    const eyeSpan = faceR * 0.62;
    put(33, cx - eyeSpan * 0.5, cy - faceR * 0.12);
    put(263, cx + eyeSpan * 0.5, cy - faceR * 0.12);
    put(1, cx, cy + faceR * 0.08);
    put(152, cx, cy + faceR * 0.94);

    const mx = cx;
    const my = cy + faceR * 0.36;
    const halfW = faceR * 0.34 * widthScale;
    const innerH = faceR * openAmt * 1.15;
    const lipThick = faceR * 0.085;

    // Outer lip 20 points around ellipse
    OUTER_LIP.forEach((idx, i) => {
      const t = (i / OUTER_LIP.length) * Math.PI * 2 - Math.PI;
      const rx = halfW;
      const ry = innerH * 0.72 + lipThick;
      const bow = i === 5 ? lipThick * 0.25 : 0;
      put(idx, mx + Math.cos(t) * rx, my + Math.sin(t) * ry + bow);
    });

    // Inner lip 20 points
    INNER_LIP.forEach((idx, i) => {
      const t = (i / INNER_LIP.length) * Math.PI * 2 - Math.PI;
      const rx = halfW * 0.78;
      const ry = Math.max(2, innerH * 0.68);
      put(idx, mx + Math.cos(t) * rx, my + Math.sin(t) * ry);
    });

    // Jaw line
    JAW_LINE.forEach((idx, i) => {
      const frac = i / (JAW_LINE.length - 1);
      const angle = Math.PI * (0.1 + frac * 0.8);
      put(idx, cx - Math.cos(angle) * faceR * 0.78, cy + Math.sin(angle) * faceR * 0.94);
    });

    return lms;
  }

  _createCoverMapper(cw, ch, vw, vh) {
    const safeVW = vw || 640;
    const safeVH = vh || 480;
    const scale = Math.max(cw / safeVW, ch / safeVH);
    const renderedW = safeVW * scale;
    const renderedH = safeVH * scale;
    const offsetX = (cw - renderedW) / 2;
    const offsetY = (ch - renderedH) / 2;

    return (lm) => ({
      x: offsetX + (1 - lm.x) * renderedW, // Mirror horizontally to match <video>
      y: offsetY + lm.y * renderedH,
    });
  }

  _getThreshold() {
    // Sensitivity 1..10 -> threshold 0.68 (strict) down to 0.22 (very gentle)
    const s = Math.max(1, Math.min(10, Number(this.settings.sensitivity) || 6));
    return 0.72 - s * 0.05;
  }

  _evaluateAndDrawLandmarks(landmarks, mapPt, ts, dt, blendshapes = null) {
    const pLeftEye = landmarks[33];
    const pRightEye = landmarks[263];
    const pTopInner = landmarks[13];
    const pBotInner = landmarks[14];
    const pTopOuter = landmarks[0];
    const pBotOuter = landmarks[17];
    const pLeftCorner = landmarks[61];
    const pRightCorner = landmarks[291];

    if (!pLeftEye || !pRightEye || !pTopInner || !pBotInner || !pLeftCorner || !pRightCorner) {
      return;
    }

    // Use aspect-ratio-accurate pixel coordinates for true geometric measurements
    const mLeftEye = mapPt(pLeftEye);
    const mRightEye = mapPt(pRightEye);
    const mTopInner = mapPt(pTopInner);
    const mBotInner = mapPt(pBotInner);
    const mLeftCorner = mapPt(pLeftCorner);
    const mRightCorner = mapPt(pRightCorner);
    const mTopOuter = pTopOuter ? mapPt(pTopOuter) : null;
    const mBotOuter = pBotOuter ? mapPt(pBotOuter) : null;

    const eyeDist = Math.max(8, Math.hypot(mRightEye.x - mLeftEye.x, mRightEye.y - mLeftEye.y));
    const openness = Math.hypot(mBotInner.x - mTopInner.x, mBotInner.y - mTopInner.y) / eyeDist;
    const outerH = mTopOuter && mBotOuter
      ? Math.hypot(mBotOuter.x - mTopOuter.x, mBotOuter.y - mTopOuter.y) / eyeDist
      : openness + 0.14;
    const width = Math.hypot(mRightCorner.x - mLeftCorner.x, mRightCorner.y - mLeftCorner.y) / eyeDist;

    const faceCx = (pLeftEye.x + pRightEye.x) * 0.5;
    const faceCy = (pLeftEye.y + pRightEye.y) * 0.5;
    const headJump = Math.hypot(faceCx - this.prevMetrics.cx, faceCy - this.prevMetrics.cy);

    // Initialize or softly adapt resting baseline
    if (!this.baseline.ready) {
      this.baseline.openness = this.baseline.samples === 0
        ? openness
        : this.baseline.openness * 0.8 + openness * 0.2;
      this.baseline.outerH = this.baseline.samples === 0
        ? outerH
        : this.baseline.outerH * 0.8 + outerH * 0.2;
      this.baseline.width = this.baseline.samples === 0
        ? width
        : this.baseline.width * 0.8 + width * 0.2;
      this.baseline.samples++;
      if (this.baseline.samples >= 6) {
        this.baseline.ready = true;
      }
    } else if (headJump < 0.02 && Math.abs(openness - this.baseline.openness) < 0.04) {
      // Very gentle drift adaptation when mouth is resting
      this.baseline.openness = this.baseline.openness * 0.988 + openness * 0.012;
      this.baseline.outerH = this.baseline.outerH * 0.988 + outerH * 0.012;
      this.baseline.width = this.baseline.width * 0.988 + width * 0.012;
    }

    const openDelta = Math.max(0, openness - this.baseline.openness);
    const pressDelta = Math.max(0, this.baseline.openness - openness) * 1.4 +
      Math.max(0, this.baseline.outerH - outerH) * 1.1;
    const widthChange = width - this.baseline.width;
    const absWidthDelta = Math.abs(widthChange);
    const vel = Math.abs(openness - this.prevMetrics.openness) + Math.abs(width - this.prevMetrics.width) * 0.6;

    this.prevMetrics = { openness, width, cx: faceCx, cy: faceCy };

    // Neural Face Blendshapes boost when available (from MediaPipe FaceLandmarker)
    const bsJawOpen = blendshapes?.jawOpen || 0;
    const bsPucker = blendshapes?.mouthPucker || 0;
    const bsFunnel = blendshapes?.mouthFunnel || 0;
    const bsPress = ((blendshapes?.mouthPressLeft || 0) + (blendshapes?.mouthPressRight || 0)) * 0.5;
    const bsSmile = ((blendshapes?.mouthSmileLeft || 0) + (blendshapes?.mouthSmileRight || 0)) * 0.5;

    // Track lip-close press for bilabial words (Mama, More, Ball, Bye)
    if (pressDelta > 0.03 || bsPress > 0.22 || openness < 0.035) {
      this.sawClosedBeforeOpen = true;
    }

    // Compute normalized activity score (0..1)
    let rawScore = 0;
    if (headJump < 0.065) {
      if (this.settings.detectionMode === 'match') {
        const shape = this.settings.targetShape;
        if (shape === 'round') {
          const roundBoost = (widthChange < -0.02 ? Math.abs(widthChange) * 4.2 : 0) + (bsPucker + bsFunnel) * 0.65;
          rawScore = Math.max(openDelta * 3.0, bsJawOpen * 1.1) + roundBoost;
        } else if (shape === 'smile') {
          const smileBoost = (widthChange > 0.02 ? widthChange * 4.4 : 0) + bsSmile * 0.7;
          rawScore = Math.max(openDelta * 2.2, bsJawOpen * 0.85) + smileBoost;
        } else if (shape === 'bilabial') {
          const cycleBoost = this.sawClosedBeforeOpen && (openDelta > 0.045 || bsJawOpen > 0.14) ? 0.25 : 0;
          rawScore = Math.max(openDelta * 3.8, bsJawOpen * 1.3) + pressDelta * 2.2 + bsPress * 0.6 + cycleBoost;
        } else {
          rawScore = Math.max(openDelta * 4.4, bsJawOpen * 1.6);
        }
      } else {
        // Default "Encourage Any Effort": rewards opening, pressing, rounding, or smiling!
        const geoScore = openDelta * 4.2 + pressDelta * 2.2 + absWidthDelta * 2.2 + Math.min(0.18, vel * 1.8);
        const bsScore = bsJawOpen * 1.55 + (bsPucker + bsFunnel) * 0.65 + bsPress * 0.7 + bsSmile * 0.45;
        rawScore = Math.max(geoScore, bsScore);
      }
    }

    rawScore = Math.max(0, Math.min(1, rawScore));
    this.smoothScore = this.smoothScore * 0.58 + rawScore * 0.42;

    const threshold = this._getThreshold();
    const cooldownMs = (Number(this.settings.cooldownSec) || 2.5) * 1000;
    const inCooldown = ts - this.lastTriggerTs < cooldownMs;
    const isRewardGlow = ts < this.rewardHighlightUntil;

    let visualState = 'tracking';
    if (isRewardGlow) {
      visualState = 'reward';
    } else if (this.smoothScore >= threshold * 0.65) {
      visualState = 'moving';
    }

    if (!inCooldown && this.smoothScore >= threshold) {
      this.activeHoldMs += dt;
      if (this.activeHoldMs >= 165) {
        this.activeHoldMs = 0;
        this.lastTriggerTs = ts;
        this.rewardHighlightUntil = ts + 1400;
        this.sawClosedBeforeOpen = false;
        visualState = 'reward';
        this.onStatusChange('reward', 'Awesome lip movement!');
        this.onLipTrigger({
          score: this.smoothScore,
          openness,
          width,
        });
      }
    } else {
      this.activeHoldMs = Math.max(0, this.activeHoldMs - dt * 1.6);
      if (!isRewardGlow) {
        if (visualState === 'moving') {
          this.onStatusChange('moving', 'Lips moving!');
        } else {
          this.onStatusChange('tracking', this.mode === 'demo' ? 'Demo camera active' : 'Watching lips');
        }
      }
    }

    const openPct = Math.min(100, Math.round(Math.max(openDelta * 320, bsJawOpen * 130)));
    this._drawTrackingOverlay(landmarks, mapPt, visualState, openPct);

    this.onMetrics({
      faceFound: true,
      score: this.smoothScore,
      threshold,
      openPct,
      state: visualState,
      inCooldown,
    });
  }

  _drawTrackingOverlay(landmarks, mapPt, state, openPct) {
    const ctx = this.ctx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const style = this.settings.lineStyle || 'clean';

    const outerPts = OUTER_LIP.map((i) => landmarks[i]).filter(Boolean).map(mapPt);
    const innerPts = INNER_LIP.map((i) => landmarks[i]).filter(Boolean).map(mapPt);

    const topInner = mapPt(landmarks[13]);
    const botInner = mapPt(landmarks[14]);
    const leftCorner = mapPt(landmarks[61]);
    const rightCorner = mapPt(landmarks[291]);

    const mainColor =
      state === 'reward' ? '#10b981' : state === 'moving' ? '#f59e0b' : '#38bdf8';
    const glowColor =
      state === 'reward'
        ? 'rgba(16, 185, 129, 0.55)'
        : state === 'moving'
          ? 'rgba(245, 158, 11, 0.45)'
          : 'rgba(56, 189, 248, 0.45)';

    ctx.save();

    // 1. Optional Detailed Face Mesh & Jawline
    if (style === 'detailed') {
      const jawPts = JAW_LINE.map((i) => landmarks[i]).filter(Boolean).map(mapPt);
      if (jawPts.length > 2) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.42)';
        ctx.lineWidth = 1.6 * dpr;
        ctx.beginPath();
        jawPts.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        ctx.stroke();
      }

      // Cross-struts between outer and inner lip landmarks
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.2 * dpr;
      const n = Math.min(outerPts.length, innerPts.length);
      for (let i = 0; i < n; i += 2) {
        ctx.beginPath();
        ctx.moveTo(outerPts[i].x, outerPts[i].y);
        ctx.lineTo(innerPts[i].x, innerPts[i].y);
        ctx.stroke();
      }
    }

    // 2. Soft bounding brackets around the mouth area in Clean / Detailed modes
    if (style !== 'minimal' && outerPts.length > 4) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      outerPts.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
      const pad = 18 * dpr;
      const bLen = 14 * dpr;
      minX -= pad; maxX += pad; minY -= pad; maxY += pad;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 2.2 * dpr;
      ctx.lineCap = 'round';
      // 4 subtle corner brackets
      ctx.beginPath();
      // Top-left
      ctx.moveTo(minX, minY + bLen); ctx.lineTo(minX, minY); ctx.lineTo(minX + bLen, minY);
      // Top-right
      ctx.moveTo(maxX - bLen, minY); ctx.lineTo(maxX, minY); ctx.lineTo(maxX, minY + bLen);
      // Bottom-left
      ctx.moveTo(minX, maxY - bLen); ctx.lineTo(minX, maxY); ctx.lineTo(minX + bLen, maxY);
      // Bottom-right
      ctx.moveTo(maxX - bLen, maxY); ctx.lineTo(maxX, maxY); ctx.lineTo(maxX, maxY - bLen);
      ctx.stroke();
    }

    // 3. Translucent Inner Lip Fill (shows detected mouth opening!)
    if (innerPts.length > 3) {
      ctx.fillStyle =
        state === 'reward'
          ? 'rgba(16, 185, 129, 0.28)'
          : state === 'moving'
            ? 'rgba(245, 158, 11, 0.24)'
            : 'rgba(56, 189, 248, 0.14)';
      ctx.beginPath();
      innerPts.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.8 * dpr;
      ctx.stroke();
    }

    // 4. Primary Glowing Outer Lip Contour Line
    if (outerPts.length > 3) {
      ctx.save();
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = (state === 'reward' ? 4.2 : 3.2) * dpr;
      ctx.lineJoin = 'round';
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 14 * dpr;
      ctx.beginPath();
      outerPts.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // 5. Horizontal Lip-Width Measurement Line (Amber dashed)
    if (style !== 'minimal') {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.2 * dpr;
      ctx.setLineDash([6 * dpr, 5 * dpr]);
      ctx.beginPath();
      ctx.moveTo(leftCorner.x, leftCorner.y);
      ctx.lineTo(rightCorner.x, rightCorner.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 6. Vertical Lip-Opening Measurement Line (Mint dashed)
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 3 * dpr;
    ctx.setLineDash([5 * dpr, 4 * dpr]);
    ctx.beginPath();
    ctx.moveTo(topInner.x, topInner.y);
    ctx.lineTo(botInner.x, botInner.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 7. Crisp Anchor Dots at Corners & Center Opening
    this._drawDot(ctx, leftCorner.x, leftCorner.y, 4.5 * dpr, '#fbbf24', dpr);
    this._drawDot(ctx, rightCorner.x, rightCorner.y, 4.5 * dpr, '#fbbf24', dpr);
    this._drawDot(ctx, topInner.x, topInner.y, 4.5 * dpr, '#34d399', dpr);
    this._drawDot(ctx, botInner.x, botInner.y, 4.5 * dpr, '#34d399', dpr);

    // 8. Live Aperture Pill Next to Mouth (Clean/Detailed)
    if (style !== 'minimal' && openPct > 6) {
      const pillX = Math.max(leftCorner.x, rightCorner.x) + 18 * dpr;
      const pillY = (topInner.y + botInner.y) * 0.5;
      const label = `Open ${openPct}%`;
      ctx.font = `800 ${12 * dpr}px Nunito, sans-serif`;
      const tw = ctx.measureText(label).width;
      const bw = tw + 16 * dpr;
      const bh = 24 * dpr;

      if (pillX + bw < this.canvasEl.width - 8) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
        ctx.beginPath();
        ctx.roundRect(pillX, pillY - bh / 2, bw, bh, 12 * dpr);
        ctx.fill();
        ctx.fillStyle = state === 'reward' ? '#6ee7b7' : '#fde68a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, pillX + bw / 2, pillY);
      }
    }

    ctx.restore();
  }

  _drawDot(ctx, x, y, r, color, dpr) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r + 1.6 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawFindFaceGuide(ctx, cw, ch) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 3 * dpr;
    ctx.setLineDash([10 * dpr, 10 * dpr]);
    ctx.beginPath();
    ctx.ellipse(cw * 0.5, ch * 0.47, Math.min(cw, ch) * 0.24, Math.min(cw, ch) * 0.31, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.beginPath();
    ctx.roundRect(cw * 0.5 - 125 * dpr, ch * 0.84 - 18 * dpr, 250 * dpr, 36 * dpr, 18 * dpr);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${14 * dpr}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Move closer so I can see your lips', cw * 0.5, ch * 0.84);
    ctx.restore();
  }
}
