// ============================================================================
// Real-Time Camera Lip, Tongue & Cheek Tracker
// Hybrid Pipeline: MediaPipe FaceLandmarker (478 landmarks + 52 blendshapes)
//                + Mouth-ROI Pink-Tongue Chroma Centroid Tracker
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

    // Offscreen tiny canvas for real-time hybrid Mouth-ROI tongue chroma analysis
    this.roiCanvas = document.createElement('canvas');
    this.roiCanvas.width = 48;
    this.roiCanvas.height = 36;
    this.roiCtx = this.roiCanvas.getContext('2d', { willReadFrequently: true });

    this.onStatusChange = onStatusChange || (() => {});
    this.onMetrics = onMetrics || (() => {});
    this.onLipTrigger = onLipTrigger || (() => {});
    this.onModelLoading = onModelLoading || (() => {});

    this.mode = 'idle'; // 'idle' | 'camera' | 'demo'
    this.stream = null;
    this.faceLandmarker = null;
    this.FaceLandmarkerClass = null;
    this.filesetResolver = null;
    this.activeDelegate = 'GPU';
    this.consecutiveFrameErrors = 0;
    this.rafId = null;
    this.lastDetectTs = 0; // Strictly monotonic ms across FaceLandmarker lifetime
    this.lastFrameDetectWall = 0;

    // Configurable settings
    this.settings = {
      practiceMode: 'moves',      // 'moves' | 'words'
      targetMove: 'openWide',     // openWide | kiss | smile | lipPop | tongueOut | tongueWiggle | tongueUp | tongueDown | cheekPuff
      detectionMode: 'encourage', // 'encourage' | 'match' (used in words mode)
      sensitivity: 6,
      cooldownSec: 2.6,
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
    this.tongueWiggleMinX = 0;
    this.tongueWiggleMaxX = 0;
    this.tongueWiggleDecay = 0;

    // Demo simulator state
    this.demoPhase = 0;
    this.demoBurstUntil = 0;
    this.demoAutoNext = 0;

    this._resizeObserver = new ResizeObserver(() => this._syncCanvasSize());
    this._resizeObserver.observe(this.canvasEl);
    this._syncCanvasSize();
  }

  updateSettings(partial) {
    const moveChanged = partial.targetMove && partial.targetMove !== this.settings.targetMove;
    Object.assign(this.settings, partial);
    if (moveChanged) {
      this.activeHoldMs = 0;
      this.tongueWiggleMinX = 0;
      this.tongueWiggleMaxX = 0;
      this.sawClosedBeforeOpen = false;
    }
  }

  recalibrate() {
    this.baseline.ready = false;
    this.baseline.samples = 0;
    this.activeHoldMs = 0;
    this.smoothScore = 0;
    this.tongueWiggleMinX = 0;
    this.tongueWiggleMaxX = 0;
  }

  triggerDemoLipMovement() {
    this.demoBurstUntil = performance.now() + 1800;
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
    this.onStatusChange('tracking', 'Watching lips & tongue');
    this.rafId = requestAnimationFrame((ts) => this._loop(ts));
  }

  startDemo() {
    this.stop();
    this.mode = 'demo';
    this.recalibrate();
    this.lastFrameTs = performance.now();
    this.demoBurstUntil = performance.now() + 1900;
    this.demoAutoNext = performance.now() + 5400;
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

    this.onModelLoading(true, 'Loading lip & tongue AI model…');
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

  _loop() {
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
      this.rafId = requestAnimationFrame(() => this._loop());
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

    if (now - this.lastFrameDetectWall < 24) return;
    this.lastFrameDetectWall = now;

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

    // Hybrid stage 2: estimate visible tongue position inside mouth ROI when mouth opens or tongueOut fires
    const tongueInfo = this._analyzeTongueROI(landmarks, blendshapes, mapper);
    this._evaluateAndDrawLandmarks(landmarks, mapper, now, dt, blendshapes, tongueInfo);
  }

  /**
   * Hybrid Mouth-ROI Tongue Estimator:
   * MediaPipe provides neural `tongueOut` (0..1) but not 3D tongue tip coordinates.
   * Here we crop a tiny 48x36 mouth region from the raw video, find strong pink/coral
   * tongue pixels inside/just below the lips, and return mirrored tip coordinates (x, y)
   * plus normalized lateral (-1..+1) and vertical (-1..+1) direction!
   */
  _analyzeTongueROI(landmarks, blendshapes, mapPt) {
    const bsTongue = blendshapes?.tongueOut || 0;
    const pLeft = landmarks[61];
    const pRight = landmarks[291];
    const pTop = landmarks[0];
    const pBot = landmarks[17];
    if (!pLeft || !pRight || !pTop || !pBot) {
      return { visible: false, strength: bsTongue, dirX: 0, dirY: 0, tipPt: null };
    }

    const vw = this.videoEl.videoWidth;
    const vh = this.videoEl.videoHeight;

    // Bounding box in raw video pixels (expanded down slightly for chin/tongue-down)
    const minX = Math.min(pLeft.x, pRight.x);
    const maxX = Math.max(pLeft.x, pRight.x);
    const minY = Math.min(pTop.y, pBot.y);
    const maxY = Math.max(pTop.y, pBot.y);
    const boxW = Math.max(0.04, maxX - minX);
    const boxH = Math.max(0.03, maxY - minY);

    const sx = Math.max(0, (minX - boxW * 0.12) * vw);
    const sy = Math.max(0, (minY - boxH * 0.15) * vh);
    const sw = Math.min(vw - sx, boxW * 1.24 * vw);
    const sh = Math.min(vh - sy, boxH * 1.55 * vh);

    if (sw < 8 || sh < 8) {
      return { visible: bsTongue > 0.2, strength: bsTongue, dirX: 0, dirY: 0, tipPt: null };
    }

    const rw = this.roiCanvas.width;
    const rh = this.roiCanvas.height;
    this.roiCtx.drawImage(this.videoEl, sx, sy, sw, sh, 0, 0, rw, rh);

    let data;
    try {
      data = this.roiCtx.getImageData(0, 0, rw, rh).data;
    } catch {
      return { visible: bsTongue > 0.2, strength: bsTongue, dirX: 0, dirY: 0, tipPt: null };
    }

    // Center mouth inner cavity mask estimate (focus on inner 72% horizontally, middle-to-lower vertically)
    let sumX = 0;
    let sumY = 0;
    let sumW = 0;
    let count = 0;

    for (let y = Math.floor(rh * 0.22); y < Math.floor(rh * 0.92); y++) {
      for (let x = Math.floor(rw * 0.14); x < Math.floor(rw * 0.86); x++) {
        const idx = (y * rw + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Tongue chroma signature: warm reddish-pink, brighter than dark mouth cavity,
        // distinctly redder than teeth (r - g > 24) and moderately saturated
        const rg = r - g;
        const rb = r - b;
        if (r > 105 && r < 248 && rg > 24 && rb > 18 && g > 45 && g < 185) {
          const weight = (rg - 20) * 0.03;
          sumX += x * weight;
          sumY += y * weight;
          sumW += weight;
          count++;
        }
      }
    }

    const areaRatio = count / (rw * rh * 0.5);
    const combinedStrength = Math.max(bsTongue, bsTongue > 0.1 ? Math.min(1, bsTongue + areaRatio * 0.45) : areaRatio * 0.65);

    if (sumW <= 0.1 || (bsTongue < 0.12 && areaRatio < 0.18)) {
      return { visible: bsTongue > 0.22, strength: bsTongue, dirX: 0, dirY: 0, tipPt: null };
    }

    const cxRoi = sumX / sumW;
    const cyRoi = sumY / sumW;

    // Convert ROI centroid back to normalized video coordinates, then map to mirrored canvas!
    const normX = (sx + (cxRoi / rw) * sw) / vw;
    const normY = (sy + (cyRoi / rh) * sh) / vh;
    const tipPt = mapPt({ x: normX, y: normY });

    // Direction relative to mouth center in mirrored space (-1 = screen left, +1 = screen right)
    const centerLm = { x: (pLeft.x + pRight.x) * 0.5, y: (pTop.y + pBot.y) * 0.5 };
    const centerPt = mapPt(centerLm);
    const leftPt = mapPt(pLeft);
    const rightPt = mapPt(pRight);
    const halfMouthPx = Math.max(12, Math.abs(rightPt.x - leftPt.x) * 0.5);

    const dirX = Math.max(-1, Math.min(1, (tipPt.x - centerPt.x) / (halfMouthPx * 0.72)));
    const dirY = Math.max(-1, Math.min(1, (tipPt.y - centerPt.y) / (halfMouthPx * 0.65)));

    return {
      visible: bsTongue > 0.16 || (areaRatio > 0.24 && (blendshapes?.jawOpen || 0) > 0.16),
      strength: Math.min(1, combinedStrength),
      dirX,
      dirY,
      tipPt,
    };
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

    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(1, '#334155');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    if (ts > this.demoAutoNext && ts > this.demoBurstUntil) {
      this.demoBurstUntil = ts + 1800;
      this.demoAutoNext = ts + 6200;
    }

    const isMoving = ts < this.demoBurstUntil;
    this.demoPhase += (dt / 1000) * (isMoving ? 4.8 : 1.3);
    const wave = isMoving ? Math.max(0, Math.sin(this.demoPhase)) : 0;

    // Synthesize exact active oral-motor move in Demo Camera!
    const move = this.settings.practiceMode === 'moves' ? this.settings.targetMove : this.settings.targetShape;
    let openAmt = 0.03;
    let widthScale = 1.0;
    let cheekPuffAmt = 0;
    let tongueOutAmt = 0;
    let tongueDirX = 0;
    let tongueDirY = 0;

    const synBlendshapes = {
      jawOpen: 0,
      mouthPucker: 0,
      mouthFunnel: 0,
      mouthSmileLeft: 0,
      mouthSmileRight: 0,
      mouthPressLeft: 0,
      mouthPressRight: 0,
      tongueOut: 0,
      cheekPuff: 0,
    };

    if (isMoving) {
      if (move === 'kiss' || move === 'round') {
        openAmt = 0.06 + wave * 0.14;
        widthScale = 1.0 - wave * 0.34;
        synBlendshapes.mouthPucker = wave * 0.85;
        synBlendshapes.mouthFunnel = wave * 0.55;
      } else if (move === 'smile') {
        openAmt = 0.04 + wave * 0.12;
        widthScale = 1.0 + wave * 0.28;
        synBlendshapes.mouthSmileLeft = wave * 0.85;
        synBlendshapes.mouthSmileRight = wave * 0.85;
      } else if (move === 'cheekPuff') {
        openAmt = 0.01;
        widthScale = 0.90;
        cheekPuffAmt = wave;
        synBlendshapes.cheekPuff = wave * 0.9;
      } else if (move === 'tongueOut' || move === 'tongueWiggle' || move === 'tongueUp' || move === 'tongueDown') {
        openAmt = 0.06 + wave * 0.24;
        tongueOutAmt = wave;
        synBlendshapes.jawOpen = wave * 0.45;
        synBlendshapes.tongueOut = wave * 0.9;
        if (move === 'tongueWiggle') {
          tongueDirX = Math.sin(this.demoPhase * 2.1) * 0.85;
          tongueDirY = 0.2;
        } else if (move === 'tongueUp') {
          tongueDirY = -0.78;
        } else if (move === 'tongueDown') {
          tongueDirY = 0.9;
        } else {
          tongueDirY = 0.35;
        }
      } else {
        openAmt = 0.03 + wave * 0.30;
        widthScale = 1.0 + wave * 0.05;
        synBlendshapes.jawOpen = wave * 0.82;
      }
    }

    const cx = cw * 0.5;
    const cy = ch * 0.47;
    const faceR = Math.min(cw, ch) * 0.31;

    ctx.save();
    // Shoulders
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.ellipse(cx, ch * 1.03, faceR * 1.5, faceR * 0.75, 0, Math.PI, 0);
    ctx.fill();

    // Head (widens slightly for cheekPuff)
    const skin = ctx.createRadialGradient(cx - faceR * 0.2, cy - faceR * 0.2, faceR * 0.2, cx, cy, faceR * 1.15);
    skin.addColorStop(0, '#fde2cc');
    skin.addColorStop(1, '#e8b594');
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(cx, cy, faceR * (0.78 + cheekPuffAmt * 0.14), faceR * 0.96, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rosy puffed cheeks in demo
    if (cheekPuffAmt > 0.15) {
      ctx.fillStyle = `rgba(244, 114, 140, ${cheekPuffAmt * 0.35})`;
      ctx.beginPath();
      ctx.ellipse(cx - faceR * 0.52, cy + faceR * 0.22, faceR * 0.22, faceR * 0.16, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + faceR * 0.52, cy + faceR * 0.22, faceR * 0.22, faceR * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hair
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

    // Synthetic mouth + protruding tongue in Demo Camera
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

    let demoTipPt = null;
    if (tongueOutAmt > 0.12) {
      const tipX = cx + tongueDirX * faceR * 0.28 * tongueOutAmt;
      const tipY = mouthY + tongueDirY * faceR * 0.26 * tongueOutAmt + faceR * 0.04;
      demoTipPt = { x: tipX, y: tipY };
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.moveTo(cx - faceR * 0.15, mouthY);
      ctx.quadraticCurveTo(tipX, tipY + faceR * 0.12, tipX, tipY);
      ctx.quadraticCurveTo(cx + faceR * 0.16, mouthY + faceR * 0.06, cx + faceR * 0.15, mouthY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    const landmarks = this._buildSyntheticLandmarks(cx, cy, faceR, openAmt, widthScale, cw, ch);
    const identityMapper = (lm) => ({ x: lm.x * cw, y: lm.y * ch });
    const tongueInfo = {
      visible: tongueOutAmt > 0.18,
      strength: tongueOutAmt,
      dirX: tongueDirX,
      dirY: tongueDirY,
      tipPt: demoTipPt,
    };
    this._evaluateAndDrawLandmarks(landmarks, identityMapper, ts, dt, synBlendshapes, tongueInfo);

    // DPR-aware Demo badge
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
    put(234, cx - faceR * 0.78, cy + faceR * 0.15);
    put(454, cx + faceR * 0.78, cy + faceR * 0.15);

    const mx = cx;
    const my = cy + faceR * 0.36;
    const halfW = faceR * 0.34 * widthScale;
    const innerH = faceR * openAmt * 1.15;
    const lipThick = faceR * 0.085;

    OUTER_LIP.forEach((idx, i) => {
      const t = (i / OUTER_LIP.length) * Math.PI * 2 - Math.PI;
      const rx = halfW;
      const ry = innerH * 0.72 + lipThick;
      const bow = i === 5 ? lipThick * 0.25 : 0;
      put(idx, mx + Math.cos(t) * rx, my + Math.sin(t) * ry + bow);
    });

    INNER_LIP.forEach((idx, i) => {
      const t = (i / INNER_LIP.length) * Math.PI * 2 - Math.PI;
      const rx = halfW * 0.78;
      const ry = Math.max(2, innerH * 0.68);
      put(idx, mx + Math.cos(t) * rx, my + Math.sin(t) * ry);
    });

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
      x: offsetX + (1 - lm.x) * renderedW,
      y: offsetY + lm.y * renderedH,
    });
  }

  _getThreshold() {
    // Sensitivity 1..10 -> threshold 0.68 (strict) down to 0.22 (very gentle)
    const s = Math.max(1, Math.min(10, Number(this.settings.sensitivity) || 6));
    return 0.72 - s * 0.05;
  }

  _evaluateAndDrawLandmarks(landmarks, mapPt, ts, dt, blendshapes = null, tongueInfo = null) {
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

    const bsJawOpen = blendshapes?.jawOpen || 0;
    const bsPucker = blendshapes?.mouthPucker || 0;
    const bsFunnel = blendshapes?.mouthFunnel || 0;
    const bsPress = ((blendshapes?.mouthPressLeft || 0) + (blendshapes?.mouthPressRight || 0)) * 0.5;
    const bsSmile = ((blendshapes?.mouthSmileLeft || 0) + (blendshapes?.mouthSmileRight || 0)) * 0.5;
    const bsCheekPuff = blendshapes?.cheekPuff || 0;
    const bsTongueOut = blendshapes?.tongueOut || 0;
    const tongueStrength = Math.max(bsTongueOut, tongueInfo?.strength || 0);

    if (pressDelta > 0.03 || bsPress > 0.20 || openness < 0.035) {
      this.sawClosedBeforeOpen = true;
    }

    // Track tongue lateral sweep for Tongue Wiggle
    if (tongueInfo?.visible || bsTongueOut > 0.16) {
      const dx = tongueInfo?.dirX || 0;
      this.tongueWiggleMinX = Math.min(this.tongueWiggleMinX, dx);
      this.tongueWiggleMaxX = Math.max(this.tongueWiggleMaxX, dx);
      this.tongueWiggleDecay = 1200;
    } else {
      this.tongueWiggleDecay = Math.max(0, this.tongueWiggleDecay - dt);
      if (this.tongueWiggleDecay === 0) {
        this.tongueWiggleMinX = 0;
        this.tongueWiggleMaxX = 0;
      }
    }

    // Compute normalized Match / Effort Score (0..1)
    let rawScore = 0;
    let metricTag = `Open ${Math.min(100, Math.round(Math.max(openDelta * 320, bsJawOpen * 130)))}%`;

    if (headJump < 0.07) {
      if (this.settings.practiceMode === 'moves') {
        const move = this.settings.targetMove;
        if (move === 'openWide') {
          rawScore = Math.max(openDelta * 4.2, bsJawOpen * 1.55);
          metricTag = `Open ${Math.min(100, Math.round(rawScore * 100))}%`;
        } else if (move === 'kiss') {
          const narrowScore = widthChange < -0.02 ? Math.abs(widthChange) * 5.2 : 0;
          rawScore = Math.max(narrowScore, bsPucker * 1.45 + bsFunnel * 0.45);
          metricTag = `Kiss ${Math.min(100, Math.round(rawScore * 100))}%`;
        } else if (move === 'smile') {
          const wideScore = widthChange > 0.025 ? widthChange * 4.8 : 0;
          rawScore = Math.max(wideScore, bsSmile * 1.45);
          metricTag = `Smile ${Math.min(100, Math.round(rawScore * 100))}%`;
        } else if (move === 'lipPop') {
          const popBonus = this.sawClosedBeforeOpen && (openDelta > 0.05 || bsJawOpen > 0.16) ? 0.35 : 0;
          rawScore = Math.max(openDelta * 3.5, bsJawOpen * 1.15) + pressDelta * 2.2 + bsPress * 0.75 + popBonus;
          metricTag = `Pop ${Math.min(100, Math.round(rawScore * 100))}%`;
        } else if (move === 'tongueOut') {
          rawScore = Math.max(bsTongueOut * 1.65, tongueStrength * 1.25);
          metricTag = `Tongue ${Math.min(100, Math.round(rawScore * 100))}%`;
        } else if (move === 'tongueWiggle') {
          const sweep = this.tongueWiggleMaxX - this.tongueWiggleMinX;
          rawScore = Math.max(bsTongueOut * 1.2, tongueStrength * 0.85) + Math.min(0.45, sweep * 0.7);
          metricTag = `Wiggle ${Math.min(100, Math.round(rawScore * 100))}%`;
        } else if (move === 'tongueUp') {
          const upBoost = tongueInfo?.visible && tongueInfo.dirY < -0.1 ? Math.abs(tongueInfo.dirY) * 0.55 : 0;
          rawScore = Math.max(bsTongueOut * 1.45, tongueStrength * 1.1) + upBoost;
          metricTag = `Up ${Math.min(100, Math.round(rawScore * 100))}%`;
        } else if (move === 'tongueDown') {
          const downBoost = tongueInfo?.visible && tongueInfo.dirY > 0.12 ? tongueInfo.dirY * 0.55 : 0;
          rawScore = Math.max(bsTongueOut * 1.45, tongueStrength * 1.1) + downBoost;
          metricTag = `Down ${Math.min(100, Math.round(rawScore * 100))}%`;
        } else if (move === 'cheekPuff') {
          rawScore = bsCheekPuff * 1.65;
          metricTag = `Puff ${Math.min(100, Math.round(rawScore * 100))}%`;
        } else {
          rawScore = Math.max(openDelta * 4.0, bsJawOpen * 1.4, bsTongueOut * 1.4);
        }
      } else {
        // WORDS MODE
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
          const geoScore = openDelta * 4.2 + pressDelta * 2.2 + absWidthDelta * 2.2 + Math.min(0.18, vel * 1.8);
          const bsScore = bsJawOpen * 1.55 + (bsPucker + bsFunnel) * 0.65 + bsPress * 0.7 + bsSmile * 0.45;
          rawScore = Math.max(geoScore, bsScore);
        }
      }
    }

    rawScore = Math.max(0, Math.min(1, rawScore));
    this.smoothScore = this.smoothScore * 0.55 + rawScore * 0.45;

    const threshold = this._getThreshold();
    const cooldownMs = (Number(this.settings.cooldownSec) || 2.6) * 1000;
    const inCooldown = ts - this.lastTriggerTs < cooldownMs;
    const isRewardGlow = ts < this.rewardHighlightUntil;

    let visualState = 'tracking';
    if (isRewardGlow) {
      visualState = 'reward';
    } else if (this.smoothScore >= threshold * 0.6) {
      visualState = 'moving';
    }

    const requiredHoldMs = this.settings.practiceMode === 'moves' ? 210 : 165;
    if (!inCooldown && this.smoothScore >= threshold) {
      this.activeHoldMs += dt;
      if (this.activeHoldMs >= requiredHoldMs) {
        this.activeHoldMs = 0;
        this.lastTriggerTs = ts;
        this.rewardHighlightUntil = ts + 1700;
        this.sawClosedBeforeOpen = false;
        this.tongueWiggleMinX = 0;
        this.tongueWiggleMaxX = 0;
        visualState = 'reward';
        this.onStatusChange('reward', 'Matched! Yay!');
        this.onLipTrigger({
          score: this.smoothScore,
          openness,
          width,
          tongueOut: tongueStrength,
        });
      }
    } else {
      this.activeHoldMs = Math.max(0, this.activeHoldMs - dt * 1.6);
      if (!isRewardGlow) {
        if (visualState === 'moving') {
          this.onStatusChange('moving', this.settings.practiceMode === 'moves' ? 'Almost there!' : 'Lips moving!');
        } else {
          this.onStatusChange('tracking', this.mode === 'demo' ? 'Demo camera active' : 'Watching lips & tongue');
        }
      }
    }

    const holdProgress = Math.min(1, this.activeHoldMs / requiredHoldMs);
    this._drawTrackingOverlay(landmarks, mapPt, visualState, metricTag, tongueInfo, bsCheekPuff, holdProgress);

    this.onMetrics({
      faceFound: true,
      score: this.smoothScore,
      threshold,
      metricTag,
      openPct: Math.min(100, Math.round(Math.max(openDelta * 320, bsJawOpen * 130))),
      state: visualState,
      inCooldown,
    });
  }

  _drawTrackingOverlay(landmarks, mapPt, state, metricTag, tongueInfo, cheekPuff, holdProgress) {
    const ctx = this.ctx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const style = this.settings.lineStyle || 'clean';

    const outerPts = OUTER_LIP.map((i) => landmarks[i]).filter(Boolean).map(mapPt);
    const innerPts = INNER_LIP.map((i) => landmarks[i]).filter(Boolean).map(mapPt);

    const topInner = mapPt(landmarks[13]);
    const botInner = mapPt(landmarks[14]);
    const leftCorner = mapPt(landmarks[61]);
    const rightCorner = mapPt(landmarks[291]);
    const mouthCx = (leftCorner.x + rightCorner.x) * 0.5;
    const mouthCy = (topInner.y + botInner.y) * 0.5;

    const mainColor =
      state === 'reward' ? '#10b981' : state === 'moving' ? '#f59e0b' : '#38bdf8';
    const glowColor =
      state === 'reward'
        ? 'rgba(16, 185, 129, 0.55)'
        : state === 'moving'
          ? 'rgba(245, 158, 11, 0.45)'
          : 'rgba(56, 189, 248, 0.45)';

    ctx.save();

    // 1. Optional Detailed Mesh
    if (style === 'detailed') {
      const jawPts = JAW_LINE.map((i) => landmarks[i]).filter(Boolean).map(mapPt);
      if (jawPts.length > 2) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.42)';
        ctx.lineWidth = 1.6 * dpr;
        ctx.beginPath();
        jawPts.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        ctx.stroke();
      }

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

    // 2. Soft bounding brackets around mouth area
    if (style !== 'minimal' && outerPts.length > 4) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      outerPts.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
      const pad = 20 * dpr;
      const bLen = 14 * dpr;
      minX -= pad; maxX += pad; minY -= pad; maxY += pad;

      ctx.strokeStyle = state === 'reward' ? 'rgba(52, 211, 153, 0.95)' : 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 2.4 * dpr;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(minX, minY + bLen); ctx.lineTo(minX, minY); ctx.lineTo(minX + bLen, minY);
      ctx.moveTo(maxX - bLen, minY); ctx.lineTo(maxX, minY); ctx.lineTo(maxX, minY + bLen);
      ctx.moveTo(minX, maxY - bLen); ctx.lineTo(minX, maxY); ctx.lineTo(minX + bLen, maxY);
      ctx.moveTo(maxX - bLen, maxY); ctx.lineTo(maxX, maxY); ctx.lineTo(maxX, maxY - bLen);
      ctx.stroke();
    }

    // 3. Translucent Inner Lip Cavity
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
      ctx.lineWidth = (state === 'reward' ? 4.4 : 3.2) * dpr;
      ctx.lineJoin = 'round';
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 14 * dpr;
      ctx.beginPath();
      outerPts.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // 5. Horizontal Lip-Width Line (Amber)
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

    // 6. Vertical Lip-Opening Line (Mint)
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 3 * dpr;
    ctx.setLineDash([5 * dpr, 4 * dpr]);
    ctx.beginPath();
    ctx.moveTo(topInner.x, topInner.y);
    ctx.lineTo(botInner.x, botInner.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 7. Anchor Dots
    this._drawDot(ctx, leftCorner.x, leftCorner.y, 4.5 * dpr, '#fbbf24', dpr);
    this._drawDot(ctx, rightCorner.x, rightCorner.y, 4.5 * dpr, '#fbbf24', dpr);
    this._drawDot(ctx, topInner.x, topInner.y, 4.5 * dpr, '#34d399', dpr);
    this._drawDot(ctx, botInner.x, botInner.y, 4.5 * dpr, '#34d399', dpr);

    // 8. LIVE TONGUE TRACKING LINE & GLOWING MAGENTA DOT!
    if (tongueInfo?.visible && tongueInfo.tipPt) {
      ctx.save();
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 3.2 * dpr;
      ctx.shadowColor = 'rgba(236, 72, 153, 0.7)';
      ctx.shadowBlur = 12 * dpr;
      ctx.beginPath();
      ctx.moveTo(mouthCx, mouthCy);
      ctx.lineTo(tongueInfo.tipPt.x, tongueInfo.tipPt.y);
      ctx.stroke();
      this._drawDot(ctx, tongueInfo.tipPt.x, tongueInfo.tipPt.y, 6.2 * dpr, '#ec4899', dpr);
      ctx.restore();
    }

    // 9. LIVE PUFFED CHEEK ARCS (when puffing cheeks!)
    if ((cheekPuff > 0.2 || (this.settings.practiceMode === 'moves' && this.settings.targetMove === 'cheekPuff')) && landmarks[234] && landmarks[454]) {
      const leftCheek = mapPt(landmarks[234]);
      const rightCheek = mapPt(landmarks[454]);
      const alpha = Math.min(0.95, 0.25 + cheekPuff * 1.1);
      ctx.save();
      ctx.strokeStyle = `rgba(236, 72, 153, ${alpha})`;
      ctx.lineWidth = (2.5 + cheekPuff * 2.5) * dpr;
      ctx.lineCap = 'round';
      const r = (22 + cheekPuff * 12) * dpr;
      ctx.beginPath();
      ctx.arc(leftCheek.x, mouthCy - 8 * dpr, r, -Math.PI * 0.35, Math.PI * 0.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rightCheek.x, mouthCy - 8 * dpr, r, Math.PI * 0.65, Math.PI * 1.35);
      ctx.stroke();
      ctx.restore();
    }

    // 10. Hold-to-Match Glowing Arc around mouth when getting close to match!
    if (holdProgress > 0.05) {
      const ringR = Math.max(36 * dpr, Math.abs(rightCorner.x - leftCorner.x) * 0.85);
      ctx.save();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 4.5 * dpr;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(mouthCx, mouthCy, ringR, -Math.PI / 2, -Math.PI / 2 + holdProgress * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 11. Live Metric Pill Next to Mouth
    if (style !== 'minimal' && (state === 'moving' || state === 'reward' || tongueInfo?.visible)) {
      const pillX = Math.max(leftCorner.x, rightCorner.x) + 18 * dpr;
      const pillY = mouthCy;
      ctx.font = `800 ${12 * dpr}px Nunito, sans-serif`;
      const tw = ctx.measureText(metricTag).width;
      const bw = tw + 16 * dpr;
      const bh = 24 * dpr;

      if (pillX + bw < this.canvasEl.width - 8) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.beginPath();
        ctx.roundRect(pillX, pillY - bh / 2, bw, bh, 12 * dpr);
        ctx.fill();
        ctx.fillStyle = state === 'reward' ? '#6ee7b7' : '#fde68a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(metricTag, pillX + bw / 2, pillY);
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
    ctx.roundRect(cw * 0.5 - 135 * dpr, ch * 0.84 - 18 * dpr, 270 * dpr, 36 * dpr, 18 * dpr);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${14 * dpr}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Move closer so I can see your lips', cw * 0.5, ch * 0.84);
    ctx.restore();
  }
}
