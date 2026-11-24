// ============================================================================
// Real-Time Camera Lip, Tongue & Cheek Tracker (Calibrated for Real Webcams)
// Hybrid Pipeline:
//   1. MediaPipe FaceLandmarker (478 3D landmarks + 52 ARKit blendshapes)
//   2. Calibrated Inner-Mouth & Protrusion-Zone Pink-Tongue Chroma Tracker
//   3. 3D/2D Cheek-Span & Forward-Bulge Puff Detector
// ============================================================================

const OUTER_LIP = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
const INNER_LIP = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
const JAW_LINE = [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454];

// Left & Right mid-cheek landmarks for puff expansion tracking
const LEFT_CHEEK_IDX = [50, 187, 205, 207];
const RIGHT_CHEEK_IDX = [280, 411, 425, 427];

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

    // Offscreen canvas for fast inner-mouth & chin tongue chroma tracking
    this.roiCanvas = document.createElement('canvas');
    this.roiCanvas.width = 56;
    this.roiCanvas.height = 48;
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
    this.lastDetectTs = 0;
    this.lastFrameDetectWall = 0;

    this.settings = {
      practiceMode: 'moves',
      targetMove: 'openWide',
      detectionMode: 'encourage',
      sensitivity: 6,
      cooldownSec: 2.6,
      lineStyle: 'clean',
      targetShape: 'bilabial',
    };

    // Adaptive resting baseline (lips + cheeks + tongue cavity)
    this.baseline = {
      ready: false,
      openness: 0.04,
      outerH: 0.22,
      width: 0.56,
      cheekSpan: 1.05,
      cheekBulgeZ: 0.0,
      pinkRestRatio: 0.14,
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
      this.smoothScore = 0;
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
    this.rafId = requestAnimationFrame(() => this._loop());
  }

  startDemo() {
    this.stop();
    this.mode = 'demo';
    this.recalibrate();
    this.lastFrameTs = performance.now();
    this.demoBurstUntil = performance.now() + 1900;
    this.demoAutoNext = performance.now() + 5400;
    this.onStatusChange('tracking', 'Demo camera active');
    this.rafId = requestAnimationFrame(() => this._loop());
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

    const tongueInfo = this._analyzeTongueROI(landmarks, blendshapes, mapper);
    this._evaluateAndDrawLandmarks(landmarks, mapper, now, dt, blendshapes, tongueInfo);
  }

  /**
   * Calibrated Inner-Mouth & Protrusion-Zone Tongue Chroma Detector:
   * Strictly inspects pixels INSIDE the inner lip opening (excluding outer lip skin)
   * plus the protrusion zone directly below the lower lip.
   * Compares bright warm pink tongue flesh vs dark oral cavity shadow & white teeth!
   */
  _analyzeTongueROI(landmarks, blendshapes, mapPt) {
    const bsTongue = blendshapes?.tongueOut || 0;
    const bsJawOpen = blendshapes?.jawOpen || 0;
    const pLeft = landmarks[78] || landmarks[61];
    const pRight = landmarks[308] || landmarks[291];
    const pTopInner = landmarks[13];
    const pBotInner = landmarks[14];
    const pBotOuter = landmarks[17] || pBotInner;
    const pTopOuter = landmarks[0] || pTopInner;

    if (!pLeft || !pRight || !pTopInner || !pBotInner) {
      return { visible: bsTongue > 0.12, strength: bsTongue * 3.5, dirX: 0, dirY: 0, tipPt: null, upperPink: 0, lowerPink: 0 };
    }

    const vw = this.videoEl.videoWidth;
    const vh = this.videoEl.videoHeight;

    // Sample box centered tightly on inner mouth opening + slight above/below protrusion area
    const minX = Math.min(pLeft.x, pRight.x);
    const maxX = Math.max(pLeft.x, pRight.x);
    const minY = Math.min(pTopOuter.y, pTopInner.y);
    const maxY = Math.max(pBotOuter.y, pBotInner.y);
    const boxW = Math.max(0.03, maxX - minX);
    const boxH = Math.max(0.025, maxY - minY);

    const sx = Math.max(0, (minX - boxW * 0.08) * vw);
    const sy = Math.max(0, (minY - boxH * 0.12) * vh);
    const sw = Math.min(vw - sx, boxW * 1.16 * vw);
    const sh = Math.min(vh - sy, boxH * 1.55 * vh);

    if (sw < 10 || sh < 10) {
      return { visible: bsTongue > 0.12, strength: bsTongue * 3.5, dirX: 0, dirY: 0, tipPt: null, upperPink: 0, lowerPink: 0 };
    }

    const rw = this.roiCanvas.width;
    const rh = this.roiCanvas.height;
    this.roiCtx.drawImage(this.videoEl, sx, sy, sw, sh, 0, 0, rw, rh);

    let data;
    try {
      data = this.roiCtx.getImageData(0, 0, rw, rh).data;
    } catch {
      return { visible: bsTongue > 0.12, strength: bsTongue * 3.5, dirX: 0, dirY: 0, tipPt: null, upperPink: 0, lowerPink: 0 };
    }

    // Map inner lip opening Y coordinates into ROI pixel space
    const innerTopY = Math.max(0, Math.min(rh - 1, Math.round(((pTopInner.y * vh - sy) / sh) * rh)));
    const innerBotY = Math.max(innerTopY + 1, Math.min(rh - 1, Math.round(((pBotInner.y * vh - sy) / sh) * rh)));
    const innerMidY = (innerTopY + innerBotY) * 0.5;
    const innerOpenPx = innerBotY - innerTopY;

    // Sample reference cheek/chin skin luminance & redness at bottom corners of ROI to adapt to lighting/skin tone!
    let skinR = 0, skinG = 0, skinCnt = 0;
    for (let y = rh - 4; y < rh; y++) {
      for (const x of [2, 3, rw - 4, rw - 3]) {
        const i = (y * rw + x) * 4;
        skinR += data[i];
        skinG += data[i + 1];
        skinCnt++;
      }
    }
    const avgSkinRG = skinCnt > 0 ? (skinR - skinG) / skinCnt : 22;

    let sumX = 0, sumY = 0, sumW = 0;
    let totalInside = 0, pinkInside = 0, darkInside = 0;
    let upperPinkCount = 0, lowerPinkCount = 0;

    // 1. Inspect strictly INSIDE the inner-mouth ellipse (no outer lip contamination!)
    if (innerOpenPx >= 3) {
      const rx = rw * 0.36;
      const ry = Math.max(2, innerOpenPx * 0.52);
      const rcx = rw * 0.5;
      const rcy = innerMidY;

      for (let y = Math.max(0, innerTopY); y <= Math.min(rh - 1, innerBotY + 5); y++) {
        for (let x = Math.floor(rw * 0.14); x < Math.ceil(rw * 0.86); x++) {
          const ex = (x - rcx) / rx;
          const ey = (y - rcy) / (ry + 3);
          if (ex * ex + ey * ey > 1.15) continue;

          totalInside++;
          const idx = (y * rw + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;
          const rg = r - g;
          const rb = r - b;

          // Dark oral cavity
          if (luma < 56) {
            darkInside++;
            continue;
          }
          // Skip bright white teeth
          const isTeeth = luma > 148 && rg < 16 && Math.abs(g - b) < 20;
          if (isTeeth) continue;

          // Tongue pinkness: warmer/redder than neutral gray, brighter than oral cavity shadow
          const pinkThreshold = Math.max(15, Math.min(34, avgSkinRG + 5));
          if (r > 88 && rg > pinkThreshold && rb > 12 && luma > 60 && luma < 215) {
            const w = Math.max(0.2, (rg - pinkThreshold + 6) * 0.04);
            pinkInside++;
            sumX += x * w;
            sumY += y * w;
            sumW += w;
            if (y < innerMidY) upperPinkCount++;
            else lowerPinkCount++;
          }
        }
      }
    }

    const pinkFillRatio = totalInside > 6 ? pinkInside / totalInside : 0;
    const upperPink = totalInside > 6 ? upperPinkCount / (totalInside * 0.5) : 0;
    const lowerPink = totalInside > 6 ? lowerPinkCount / (totalInside * 0.5) : 0;

    // Combine MediaPipe neural tongueOut (amplified!) + inner-mouth pink chroma fill when mouth is open!
    const mouthOpenEnough = bsJawOpen > 0.09 || innerOpenPx >= 5;
    const chromaBoost = mouthOpenEnough ? Math.max(0, pinkFillRatio - 0.12) * 1.45 : 0;
    const neuralBoost = bsTongue * 3.8; // MediaPipe tongueOut peaks around 0.25-0.45 on real cams!
    const combinedStrength = Math.min(1, Math.max(neuralBoost, chromaBoost + bsTongue * 1.9));

    const visible = bsTongue > 0.08 || (mouthOpenEnough && pinkFillRatio > 0.26);

    // Estimate tongue tip point in mirrored canvas coordinates
    const centerLm = { x: (pLeft.x + pRight.x) * 0.5, y: (pTopInner.y + pBotInner.y) * 0.5 };
    const centerPt = mapPt(centerLm);
    let tipPt = null;
    let dirX = 0;
    let dirY = 0;

    if (visible) {
      if (sumW > 0.15) {
        const cxRoi = sumX / sumW;
        const cyRoi = sumY / sumW;
        const normX = (sx + (cxRoi / rw) * sw) / vw;
        const normY = (sy + (cyRoi / rh) * sh) / vh;
        tipPt = mapPt({ x: normX, y: normY });

        const leftPt = mapPt(pLeft);
        const rightPt = mapPt(pRight);
        const halfW = Math.max(10, Math.abs(rightPt.x - leftPt.x) * 0.5);
        dirX = Math.max(-1, Math.min(1, (tipPt.x - centerPt.x) / (halfW * 0.55)));
        dirY = Math.max(-1, Math.min(1, (tipPt.y - centerPt.y) / (halfW * 0.50)));
      } else {
        // If neural tongueOut fired before ROI pink pixels locked, anchor dot at center-lower mouth
        tipPt = { x: centerPt.x, y: centerPt.y + 12 };
        dirY = 0.35;
      }
    }

    return {
      visible,
      strength: combinedStrength,
      pinkFillRatio,
      upperPink,
      lowerPink,
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
      mouthRollLower: 0,
      mouthRollUpper: 0,
      tongueOut: 0,
      cheekPuff: 0,
    };

    if (isMoving) {
      if (move === 'kiss' || move === 'round') {
        openAmt = 0.06 + wave * 0.14;
        widthScale = 1.0 - wave * 0.34;
        synBlendshapes.mouthPucker = wave * 0.55;
        synBlendshapes.mouthFunnel = wave * 0.45;
      } else if (move === 'smile') {
        openAmt = 0.04 + wave * 0.12;
        widthScale = 1.0 + wave * 0.28;
        synBlendshapes.mouthSmileLeft = wave * 0.7;
        synBlendshapes.mouthSmileRight = wave * 0.7;
      } else if (move === 'cheekPuff') {
        openAmt = 0.01;
        widthScale = 0.90;
        cheekPuffAmt = wave;
        synBlendshapes.cheekPuff = wave * 0.35;
      } else if (move === 'tongueOut' || move === 'tongueWiggle' || move === 'tongueUp' || move === 'tongueDown') {
        openAmt = 0.06 + wave * 0.24;
        tongueOutAmt = wave;
        synBlendshapes.jawOpen = wave * 0.42;
        synBlendshapes.tongueOut = wave * 0.35;
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
        synBlendshapes.jawOpen = wave * 0.72;
      }
    }

    const cx = cw * 0.5;
    const cy = ch * 0.47;
    const faceR = Math.min(cw, ch) * 0.31;

    ctx.save();
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.ellipse(cx, ch * 1.03, faceR * 1.5, faceR * 0.75, 0, Math.PI, 0);
    ctx.fill();

    const skin = ctx.createRadialGradient(cx - faceR * 0.2, cy - faceR * 0.2, faceR * 0.2, cx, cy, faceR * 1.15);
    skin.addColorStop(0, '#fde2cc');
    skin.addColorStop(1, '#e8b594');
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(cx, cy, faceR * (0.78 + cheekPuffAmt * 0.14), faceR * 0.96, 0, 0, Math.PI * 2);
    ctx.fill();

    if (cheekPuffAmt > 0.15) {
      ctx.fillStyle = `rgba(244, 114, 140, ${cheekPuffAmt * 0.35})`;
      ctx.beginPath();
      ctx.ellipse(cx - faceR * 0.52, cy + faceR * 0.22, faceR * 0.22, faceR * 0.16, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + faceR * 0.52, cy + faceR * 0.22, faceR * 0.22, faceR * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#3b2417';
    ctx.beginPath();
    ctx.ellipse(cx, cy - faceR * 0.36, faceR * 0.80, faceR * 0.65, 0, Math.PI, Math.PI * 2);
    ctx.fill();

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

    const landmarks = this._buildSyntheticLandmarks(cx, cy, faceR, openAmt, widthScale, cheekPuffAmt, cw, ch);
    const identityMapper = (lm) => ({ x: lm.x * cw, y: lm.y * ch });
    const tongueInfo = {
      visible: tongueOutAmt > 0.15,
      strength: tongueOutAmt,
      pinkFillRatio: tongueOutAmt * 0.75,
      upperPink: tongueDirY < 0 ? tongueOutAmt * 0.8 : 0.1,
      lowerPink: tongueDirY >= 0 ? tongueOutAmt * 0.8 : 0.1,
      dirX: tongueDirX,
      dirY: tongueDirY,
      tipPt: demoTipPt,
    };
    this._evaluateAndDrawLandmarks(landmarks, identityMapper, ts, dt, synBlendshapes, tongueInfo);

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

  _buildSyntheticLandmarks(cx, cy, faceR, openAmt, widthScale, cheekPuffAmt, cw, ch) {
    const lms = {};
    const put = (idx, x, y, z = 0) => {
      lms[idx] = { x: x / cw, y: y / ch, z };
    };

    const eyeSpan = faceR * 0.62;
    put(33, cx - eyeSpan * 0.5, cy - faceR * 0.12, 0);
    put(263, cx + eyeSpan * 0.5, cy - faceR * 0.12, 0);
    put(1, cx, cy + faceR * 0.08, -0.05);
    put(152, cx, cy + faceR * 0.94, 0);
    put(234, cx - faceR * (0.78 + cheekPuffAmt * 0.12), cy + faceR * 0.15, 0);
    put(454, cx + faceR * (0.78 + cheekPuffAmt * 0.12), cy + faceR * 0.15, 0);

    LEFT_CHEEK_IDX.forEach((idx) => {
      put(idx, cx - faceR * (0.55 + cheekPuffAmt * 0.14), cy + faceR * 0.24, -cheekPuffAmt * 0.04);
    });
    RIGHT_CHEEK_IDX.forEach((idx) => {
      put(idx, cx + faceR * (0.55 + cheekPuffAmt * 0.14), cy + faceR * 0.24, -cheekPuffAmt * 0.04);
    });

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
    // Calibrated real-webcam thresholds: Sensitivity 6/10 -> 0.34 (friendly & responsive!)
    // Sensitivity 1 (strict) = 0.59, Sensitivity 10 (very gentle) = 0.14
    const s = Math.max(1, Math.min(10, Number(this.settings.sensitivity) || 6));
    return 0.64 - s * 0.05;
  }

  _computeCheekMetrics(landmarks, mapPt, eyeDist) {
    const lc = LEFT_CHEEK_IDX.map((i) => landmarks[i]).filter(Boolean);
    const rc = RIGHT_CHEEK_IDX.map((i) => landmarks[i]).filter(Boolean);
    const nose = landmarks[1];
    if (lc.length === 0 || rc.length === 0 || !nose) {
      return { cheekSpan: this.baseline.cheekSpan, cheekBulgeZ: 0 };
    }
    const lAvg = lc.reduce((acc, p) => ({ x: acc.x + p.x / lc.length, y: acc.y + p.y / lc.length, z: acc.z + (p.z || 0) / lc.length }), { x: 0, y: 0, z: 0 });
    const rAvg = rc.reduce((acc, p) => ({ x: acc.x + p.x / rc.length, y: acc.y + p.y / rc.length, z: acc.z + (p.z || 0) / rc.length }), { x: 0, y: 0, z: 0 });

    const ml = mapPt(lAvg);
    const mr = mapPt(rAvg);
    const cheekSpan = Math.hypot(mr.x - ml.x, mr.y - ml.y) / eyeDist;
    // Forward Z-bulge of cheeks relative to eye plane (more negative Z = closer to camera!)
    const eyeZ = ((landmarks[33]?.z || 0) + (landmarks[263]?.z || 0)) * 0.5;
    const cheekBulgeZ = eyeZ - (lAvg.z + rAvg.z) * 0.5;
    return { cheekSpan, cheekBulgeZ };
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

    const { cheekSpan, cheekBulgeZ } = this._computeCheekMetrics(landmarks, mapPt, eyeDist);

    const faceCx = (pLeftEye.x + pRightEye.x) * 0.5;
    const faceCy = (pLeftEye.y + pRightEye.y) * 0.5;
    const headJump = Math.hypot(faceCx - this.prevMetrics.cx, faceCy - this.prevMetrics.cy);

    if (!this.baseline.ready) {
      const a = this.baseline.samples === 0 ? 1 : 0.25;
      this.baseline.openness = this.baseline.openness * (1 - a) + openness * a;
      this.baseline.outerH = this.baseline.outerH * (1 - a) + outerH * a;
      this.baseline.width = this.baseline.width * (1 - a) + width * a;
      this.baseline.cheekSpan = this.baseline.cheekSpan * (1 - a) + cheekSpan * a;
      this.baseline.cheekBulgeZ = this.baseline.cheekBulgeZ * (1 - a) + cheekBulgeZ * a;
      this.baseline.samples++;
      if (this.baseline.samples >= 6) {
        this.baseline.ready = true;
      }
    } else if (headJump < 0.02 && Math.abs(openness - this.baseline.openness) < 0.035 && (blendshapes?.cheekPuff || 0) < 0.04) {
      this.baseline.openness = this.baseline.openness * 0.99 + openness * 0.01;
      this.baseline.outerH = this.baseline.outerH * 0.99 + outerH * 0.01;
      this.baseline.width = this.baseline.width * 0.99 + width * 0.01;
      this.baseline.cheekSpan = this.baseline.cheekSpan * 0.992 + cheekSpan * 0.008;
      this.baseline.cheekBulgeZ = this.baseline.cheekBulgeZ * 0.992 + cheekBulgeZ * 0.008;
    }

    const openDelta = Math.max(0, openness - this.baseline.openness);
    const pressDelta = Math.max(0, this.baseline.openness - openness) * 1.5 +
      Math.max(0, this.baseline.outerH - outerH) * 1.4;
    const widthChange = width - this.baseline.width;
    const absWidthDelta = Math.abs(widthChange);
    const vel = Math.abs(openness - this.prevMetrics.openness) + Math.abs(width - this.prevMetrics.width) * 0.6;
    const cheekSpanDelta = Math.max(0, cheekSpan - this.baseline.cheekSpan);
    const cheekBulgeDelta = Math.max(0, cheekBulgeZ - this.baseline.cheekBulgeZ);

    this.prevMetrics = { openness, width, cx: faceCx, cy: faceCy };

    const bsJawOpen = blendshapes?.jawOpen || 0;
    const bsPucker = blendshapes?.mouthPucker || 0;
    const bsFunnel = blendshapes?.mouthFunnel || 0;
    const bsPress = ((blendshapes?.mouthPressLeft || 0) + (blendshapes?.mouthPressRight || 0)) * 0.5;
    const bsRoll = ((blendshapes?.mouthRollUpper || 0) + (blendshapes?.mouthRollLower || 0)) * 0.5;
    const bsSmile = ((blendshapes?.mouthSmileLeft || 0) + (blendshapes?.mouthSmileRight || 0)) * 0.5;
    const bsStretch = ((blendshapes?.mouthStretchLeft || 0) + (blendshapes?.mouthStretchRight || 0)) * 0.5;
    const bsCheekPuff = blendshapes?.cheekPuff || 0;
    const bsTongueOut = blendshapes?.tongueOut || 0;
    const bsMouthLat = Math.abs((blendshapes?.mouthLeft || 0) - (blendshapes?.mouthRight || 0));
    const bsUpperUp = ((blendshapes?.mouthUpperUpLeft || 0) + (blendshapes?.mouthUpperUpRight || 0)) * 0.5;
    const bsLowerDown = ((blendshapes?.mouthLowerDownLeft || 0) + (blendshapes?.mouthLowerDownRight || 0)) * 0.5;

    const tongueStrength = Math.max(bsTongueOut * 3.8, tongueInfo?.strength || 0);

    if (pressDelta > 0.025 || bsPress > 0.14 || bsRoll > 0.14 || openness < 0.032) {
      this.sawClosedBeforeOpen = true;
    }

    // Track horizontal sweep for Tongue Wiggle (both tongue centroid AND lateral mouth/jaw shift!)
    if (tongueInfo?.visible || bsTongueOut > 0.06 || bsMouthLat > 0.12) {
      const dx = (tongueInfo?.dirX || 0) + ((blendshapes?.mouthRight || 0) - (blendshapes?.mouthLeft || 0)) * 0.8;
      this.tongueWiggleMinX = Math.min(this.tongueWiggleMinX, dx);
      this.tongueWiggleMaxX = Math.max(this.tongueWiggleMaxX, dx);
      this.tongueWiggleDecay = 1600;
    } else {
      this.tongueWiggleDecay = Math.max(0, this.tongueWiggleDecay - dt);
      if (this.tongueWiggleDecay === 0) {
        this.tongueWiggleMinX = 0;
        this.tongueWiggleMaxX = 0;
      }
    }

    // Combined calibrated Cheek Puff score (neural cheekPuff + landmark expansion + closed lips!)
    const lipsClosedFactor = bsJawOpen < 0.12 ? 1.0 : 0.35;
    const cheekPuffScore = Math.min(
      1,
      Math.max(
        bsCheekPuff * 4.8,
        (bsCheekPuff * 2.8 + cheekSpanDelta * 6.5 + cheekBulgeDelta * 18.0 + (bsPress + bsPucker) * 0.25) * lipsClosedFactor
      )
    );

    // Compute normalized Match / Effort Score (0..1)
    let rawScore = 0;
    let metricTag = `Open ${Math.min(100, Math.round(Math.max(openDelta * 320, bsJawOpen * 140)))}%`;

    if (headJump < 0.08) {
      if (this.settings.practiceMode === 'moves') {
        const move = this.settings.targetMove;
        if (move === 'openWide') {
          rawScore = Math.max(openDelta * 4.8, bsJawOpen * 2.0);
          metricTag = `Open ${Math.min(100, Math.round(rawScore * 100))}%`;
        } else if (move === 'kiss') {
          const narrowScore = widthChange < -0.018 ? Math.abs(widthChange) * 6.8 : 0;
          rawScore = Math.max(narrowScore, bsPucker * 2.1 + bsFunnel * 0.9);
          metricTag = `Kiss ${Math.min(100, Math.round(rawScore * 100))}%`;
        } else if (move === 'smile') {
          const wideScore = widthChange > 0.02 ? widthChange * 5.8 : 0;
          rawScore = Math.max(wideScore, bsSmile * 1.9 + bsStretch * 0.6);
          metricTag = `Smile ${Math.min(100, Math.round(rawScore * 100))}%`;
        } else if (move === 'lipPop') {
          const pressEffort = pressDelta * 3.0 + bsPress * 2.1 + bsRoll * 1.6;
          const popBonus = this.sawClosedBeforeOpen && (openDelta > 0.045 || bsJawOpen > 0.15) ? 0.55 : 0;
          rawScore = Math.max(pressEffort, popBonus + openDelta * 2.6);
          metricTag = `Pop ${Math.min(100, Math.round(rawScore * 100))}%`;
        } else if (move === 'tongueOut') {
          rawScore = tongueStrength;
          metricTag = `Tongue ${Math.min(100, Math.round(rawScore * 100))}%`;
        } else if (move === 'tongueWiggle') {
          const sweep = this.tongueWiggleMaxX - this.tongueWiggleMinX;
          rawScore = tongueStrength * 0.72 + Math.min(0.6, sweep * 0.85) + bsMouthLat * 0.75;
          metricTag = `Wiggle ${Math.min(100, Math.round(rawScore * 100))}%`;
        } else if (move === 'tongueUp') {
          const upBoost =
            (tongueInfo?.visible && tongueInfo.dirY < 0.08 ? 0.35 + Math.abs(Math.min(0, tongueInfo.dirY)) * 0.6 : 0) +
            (tongueInfo?.upperPink || 0) * 0.55 +
            bsUpperUp * 0.65;
          rawScore = Math.max(tongueStrength * 0.9, tongueStrength * 0.6 + upBoost);
          metricTag = `Up ${Math.min(100, Math.round(rawScore * 100))}%`;
        } else if (move === 'tongueDown') {
          const downBoost =
            (tongueInfo?.visible && tongueInfo.dirY > 0.05 ? 0.35 + tongueInfo.dirY * 0.55 : 0) +
            (tongueInfo?.lowerPink || 0) * 0.55 +
            bsLowerDown * 0.65;
          rawScore = Math.max(tongueStrength * 0.9, tongueStrength * 0.6 + downBoost);
          metricTag = `Down ${Math.min(100, Math.round(rawScore * 100))}%`;
        } else if (move === 'cheekPuff') {
          rawScore = cheekPuffScore;
          metricTag = `Cheeks ${Math.min(100, Math.round(rawScore * 100))}%`;
        } else {
          rawScore = Math.max(openDelta * 4.2, bsJawOpen * 1.6, tongueStrength);
        }
      } else {
        // WORDS MODE
        if (this.settings.detectionMode === 'match') {
          const shape = this.settings.targetShape;
          if (shape === 'round') {
            const roundBoost = (widthChange < -0.02 ? Math.abs(widthChange) * 5.0 : 0) + (bsPucker + bsFunnel) * 1.1;
            rawScore = Math.max(openDelta * 3.0, bsJawOpen * 1.2) + roundBoost;
          } else if (shape === 'smile') {
            const smileBoost = (widthChange > 0.02 ? widthChange * 4.8 : 0) + bsSmile * 1.2;
            rawScore = Math.max(openDelta * 2.2, bsJawOpen * 0.9) + smileBoost;
          } else if (shape === 'bilabial') {
            const cycleBoost = this.sawClosedBeforeOpen && (openDelta > 0.045 || bsJawOpen > 0.14) ? 0.32 : 0;
            rawScore = Math.max(openDelta * 4.0, bsJawOpen * 1.5) + pressDelta * 2.5 + bsPress * 1.2 + cycleBoost;
          } else {
            rawScore = Math.max(openDelta * 4.6, bsJawOpen * 1.8);
          }
        } else {
          const geoScore = openDelta * 4.5 + pressDelta * 2.4 + absWidthDelta * 2.6 + Math.min(0.2, vel * 2.0);
          const bsScore = bsJawOpen * 1.8 + (bsPucker + bsFunnel) * 1.0 + bsPress * 1.1 + bsSmile * 0.7;
          rawScore = Math.max(geoScore, bsScore);
        }
      }
    }

    rawScore = Math.max(0, Math.min(1, rawScore));
    this.smoothScore = this.smoothScore * 0.52 + rawScore * 0.48;

    const threshold = this._getThreshold();
    const cooldownMs = (Number(this.settings.cooldownSec) || 2.6) * 1000;
    const inCooldown = ts - this.lastTriggerTs < cooldownMs;
    const isRewardGlow = ts < this.rewardHighlightUntil;

    let visualState = 'tracking';
    if (isRewardGlow) {
      visualState = 'reward';
    } else if (this.smoothScore >= threshold * 0.58) {
      visualState = 'moving';
    }

    const requiredHoldMs = this.settings.practiceMode === 'moves' ? 175 : 155;
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
          cheekPuff: cheekPuffScore,
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
    this._drawTrackingOverlay(landmarks, mapPt, visualState, metricTag, tongueInfo, cheekPuffScore, holdProgress);

    this.onMetrics({
      faceFound: true,
      score: this.smoothScore,
      threshold,
      metricTag,
      openPct: Math.min(100, Math.round(Math.max(openDelta * 320, bsJawOpen * 140))),
      state: visualState,
      inCooldown,
    });
  }

  _drawTrackingOverlay(landmarks, mapPt, state, metricTag, tongueInfo, cheekPuffScore, holdProgress) {
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

    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 3 * dpr;
    ctx.setLineDash([5 * dpr, 4 * dpr]);
    ctx.beginPath();
    ctx.moveTo(topInner.x, topInner.y);
    ctx.lineTo(botInner.x, botInner.y);
    ctx.stroke();
    ctx.setLineDash([]);

    this._drawDot(ctx, leftCorner.x, leftCorner.y, 4.5 * dpr, '#fbbf24', dpr);
    this._drawDot(ctx, rightCorner.x, rightCorner.y, 4.5 * dpr, '#fbbf24', dpr);
    this._drawDot(ctx, topInner.x, topInner.y, 4.5 * dpr, '#34d399', dpr);
    this._drawDot(ctx, botInner.x, botInner.y, 4.5 * dpr, '#34d399', dpr);

    // LIVE TONGUE TRACKING LINE & GLOWING MAGENTA DOT
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

    // LIVE PUFFED CHEEK ARCS (tracked on mid-cheek landmarks 187 & 411!)
    const showCheekGuides =
      cheekPuffScore > 0.18 || (this.settings.practiceMode === 'moves' && this.settings.targetMove === 'cheekPuff');
    if (showCheekGuides && landmarks[187] && landmarks[411]) {
      const cA = mapPt(landmarks[187]);
      const cB = mapPt(landmarks[411]);
      const leftPt = cA.x < cB.x ? cA : cB;
      const rightPt = cA.x < cB.x ? cB : cA;
      const alpha = Math.min(0.95, 0.3 + cheekPuffScore * 0.9);
      ctx.save();
      ctx.strokeStyle = cheekPuffScore > 0.35 ? `rgba(16, 185, 129, ${alpha})` : `rgba(236, 72, 153, ${alpha})`;
      ctx.lineWidth = (2.8 + cheekPuffScore * 2.6) * dpr;
      ctx.lineCap = 'round';
      const r = (22 + cheekPuffScore * 14) * dpr;
      ctx.beginPath();
      ctx.arc(leftPt.x - 10 * dpr, leftPt.y, r, Math.PI * 0.65, Math.PI * 1.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rightPt.x + 10 * dpr, rightPt.y, r, -Math.PI * 0.35, Math.PI * 0.35);
      ctx.stroke();
      this._drawDot(ctx, leftPt.x, leftPt.y, 4 * dpr, '#ec4899', dpr);
      this._drawDot(ctx, rightPt.x, rightPt.y, 4 * dpr, '#ec4899', dpr);
      ctx.restore();
    }

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

    if (style !== 'minimal' && (state === 'moving' || state === 'reward' || tongueInfo?.visible || cheekPuffScore > 0.25)) {
      const pillX = Math.max(leftCorner.x, rightCorner.x) + 18 * dpr;
      const pillY = mouthCy;
      ctx.font = `800 ${12 * dpr}px Nunito, sans-serif`;
      const tw = ctx.measureText(metricTag).width;
      const bw = tw + 16 * dpr;
      const bh = 24 * dpr;

      if (pillX + bw < this.canvasEl.width - 8) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
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
