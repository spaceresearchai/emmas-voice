// ============================================================================
// Pixar-Style Cute 3D Animal Buddy Coach (Three.js — Bear, Puppy & Bunny)
// Zero uncanny valley, instant 0ms load, 60fps smooth Lips, Tongue & Cheeks!
// ============================================================================

import * as THREE from 'three';

export const BUDDY_THEMES = {
  bear: {
    label: '🐻 Teddy Bear',
    fur: 0xd9955f,
    furSheen: 0xffd7b0,
    muzzle: 0xfff0dc,
    innerEar: 0xf7a8b8,
    earFur: 0xc57d47,
    nose: 0x4b2c20,
    blush: 0xfb7185,
    shirt: 0x3b82f6,
    collar: 0x93c5fd,
    earType: 'bear',
  },
  puppy: {
    label: '🐶 Sunny Puppy',
    fur: 0xe8ba82,
    furSheen: 0xfff0d4,
    muzzle: 0xfff8ed,
    innerEar: 0xf6a5b4,
    earFur: 0x9c6137,
    nose: 0x3b2419,
    blush: 0xf97592,
    shirt: 0x10b981,
    collar: 0x6ee7b7,
    earType: 'puppy',
  },
  bunny: {
    label: '🐰 Cozy Bunny',
    fur: 0xfdf5ec,
    furSheen: 0xffffff,
    muzzle: 0xffffff,
    innerEar: 0xf9a8d4,
    earFur: 0xf5e8da,
    nose: 0xf472b6,
    blush: 0xf9a8d4,
    shirt: 0x8b5cf6,
    collar: 0xc4b5fd,
    earType: 'bunny',
  },
};

// Expressive oral-motor + speech viseme pose parameters
const BUDDY_POSES = {
  // open: 0..1.1, width: 0.48..1.38, pucker: 0..1, press: 0..1, smile: 0..1,
  // cheekPuff: 0..1, tongueOut: 0..1.1, tongueX: -1..1, tongueY: -1..1,
  // tongueIn: 0..1, teethLip: 0..1, browLift: 0..1, earPerk: 0..1
  rest:            { open: 0.04, width: 0.96, pucker: 0.0, press: 0.0, smile: 0.22, cheekPuff: 0.0, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, tongueIn: 0.0, teethLip: 0.0, browLift: 0.05, earPerk: 0.0 },
  closed:          { open: 0.00, width: 0.90, pucker: 0.1, press: 1.0, smile: 0.00, cheekPuff: 0.0, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, tongueIn: 0.0, teethLip: 0.0, browLift: 0.15, earPerk: 0.1 },
  openWide:        { open: 0.88, width: 1.04, pucker: 0.0, press: 0.0, smile: 0.15, cheekPuff: 0.0, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, tongueIn: 0.15, teethLip: 0.0, browLift: 0.45, earPerk: 0.35 },
  openBig:         { open: 1.08, width: 1.08, pucker: 0.0, press: 0.0, smile: 0.18, cheekPuff: 0.0, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, tongueIn: 0.10, teethLip: 0.0, browLift: 0.72, earPerk: 0.55 },
  openMid:         { open: 0.52, width: 1.00, pucker: 0.0, press: 0.0, smile: 0.15, cheekPuff: 0.0, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, tongueIn: 0.15, teethLip: 0.0, browLift: 0.22, earPerk: 0.15 },
  roundTight:      { open: 0.26, width: 0.54, pucker: 0.85, press: 0.0, smile: 0.00, cheekPuff: 0.0, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, tongueIn: 0.0, teethLip: 0.0, browLift: 0.35, earPerk: 0.25 },
  kissPucker:      { open: 0.20, width: 0.46, pucker: 1.0, press: 0.0, smile: 0.00, cheekPuff: 0.0, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, tongueIn: 0.0, teethLip: 0.0, browLift: 0.55, earPerk: 0.45 },
  roundOpen:       { open: 0.68, width: 0.66, pucker: 0.55, press: 0.0, smile: 0.00, cheekPuff: 0.0, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, tongueIn: 0.0, teethLip: 0.0, browLift: 0.38, earPerk: 0.30 },
  smile:           { open: 0.24, width: 1.24, pucker: 0.0, press: 0.0, smile: 0.82, cheekPuff: 0.0, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, tongueIn: 0.0, teethLip: 0.0, browLift: 0.35, earPerk: 0.45 },
  bigSmile:        { open: 0.36, width: 1.38, pucker: 0.0, press: 0.0, smile: 1.00, cheekPuff: 0.0, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, tongueIn: 0.0, teethLip: 0.0, browLift: 0.58, earPerk: 0.72 },
  tongueUp:        { open: 0.48, width: 0.98, pucker: 0.0, press: 0.0, smile: 0.12, cheekPuff: 0.0, tongueOut: 0.32, tongueX: 0.0, tongueY: -0.75, tongueIn: 0.9, teethLip: 0.0, browLift: 0.30, earPerk: 0.25 },
  teethLip:        { open: 0.10, width: 1.02, pucker: 0.0, press: 0.2, smile: 0.10, cheekPuff: 0.0, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, tongueIn: 0.0, teethLip: 1.0, browLift: 0.15, earPerk: 0.10 },
  // Explicit Tongue & Cheek Moves!
  tongueOut:       { open: 0.74, width: 1.02, pucker: 0.0, press: 0.0, smile: 0.24, cheekPuff: 0.0, tongueOut: 1.0, tongueX: 0.0, tongueY: 0.22, tongueIn: 0.0, teethLip: 0.0, browLift: 0.55, earPerk: 0.60 },
  tongueLeft:      { open: 0.70, width: 1.02, pucker: 0.0, press: 0.0, smile: 0.22, cheekPuff: 0.0, tongueOut: 0.96, tongueX: -0.95, tongueY: 0.12, tongueIn: 0.0, teethLip: 0.0, browLift: 0.48, earPerk: 0.55 },
  tongueRight:     { open: 0.70, width: 1.02, pucker: 0.0, press: 0.0, smile: 0.22, cheekPuff: 0.0, tongueOut: 0.96, tongueX: 0.95, tongueY: 0.12, tongueIn: 0.0, teethLip: 0.0, browLift: 0.48, earPerk: 0.55 },
  tongueReachUp:   { open: 0.74, width: 1.00, pucker: 0.0, press: 0.0, smile: 0.18, cheekPuff: 0.0, tongueOut: 0.95, tongueX: 0.0, tongueY: -0.95, tongueIn: 0.0, teethLip: 0.0, browLift: 0.65, earPerk: 0.65 },
  tongueReachDown: { open: 0.82, width: 1.00, pucker: 0.0, press: 0.0, smile: 0.15, cheekPuff: 0.0, tongueOut: 1.08, tongueX: 0.0, tongueY: 1.0, tongueIn: 0.0, teethLip: 0.0, browLift: 0.52, earPerk: 0.55 },
  cheekPuff:       { open: 0.00, width: 0.78, pucker: 0.35, press: 0.92, smile: 0.05, cheekPuff: 1.0, tongueOut: 0.0, tongueX: 0.0, tongueY: 0.0, tongueIn: 0.0, teethLip: 0.0, browLift: 0.68, earPerk: 0.70 },
};

export class ThreeCoach {
  constructor({ stageEl, guideCanvas, videoEl, syllableStripEl, modeBadgeEl, loadingEl }) {
    this.stageEl = stageEl;
    this.guideCanvas = guideCanvas;
    this.guideCtx = guideCanvas.getContext('2d');
    this.videoEl = videoEl;
    this.syllableStripEl = syllableStripEl;
    this.modeBadgeEl = modeBadgeEl;
    this.loadingEl = loadingEl;

    this.item = null;
    this.isMoveMode = true;
    this.showLines = true;
    this.slowMode = false;
    this.loopEnabled = true;
    this.buddyKey = 'bear';

    this.hasParentVideo = false;
    this.currentVideoUrl = null;

    // Animation state
    this.playing = false;
    this.elapsedMs = 0;
    this.loopWaitMs = 0;
    this.lastFrameTs = 0;
    this.clockSec = 0;
    this.blinkTimer = 2600;
    this.blinkPhase = 0;
    this.activeStepIdx = -1;

    this.currentPose = { ...BUDDY_POSES.rest };
    this.targetPose = { ...BUDDY_POSES.rest };

    // Interactive peek tilt
    this.pointerYaw = 0;
    this.pointerPitch = 0;
    this.targetYaw = 0;
    this.targetPitch = 0;

    this.mouthScreenPos = { x: 0.5, y: 0.64 };
    this.parts = {};
    this.webglOk = false;

    this._initThree();
    this._bindStageInteraction();

    this._resizeObserver = new ResizeObserver(() => this._syncSize());
    this._resizeObserver.observe(this.stageEl);
    this._syncSize();

    this.loadAvatar(this.buddyKey);
    if (this.loadingEl) this.loadingEl.classList.add('hidden');

    this._raf = requestAnimationFrame((ts) => this._tick(ts));
  }

  _initThree() {
    try {
      this.webglCanvas = document.createElement('canvas');
      this.webglCanvas.className = 'coach-webgl-canvas';
      this.stageEl.insertBefore(this.webglCanvas, this.guideCanvas);

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.webglCanvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;

      this.scene = new THREE.Scene();

      this.camera = new THREE.PerspectiveCamera(30, 4 / 3, 0.1, 30);
      this.camera.position.set(0, 0.12, 4.35);
      this.camera.lookAt(0, 0.04, 0);

      // Warm Pixar 3-point soft lighting
      const hemi = new THREE.HemisphereLight(0xf6fbff, 0xffe4c4, 1.35);
      this.scene.add(hemi);

      const keyLight = new THREE.DirectionalLight(0xfffaf0, 1.55);
      keyLight.position.set(2.4, 3.2, 4.2);
      this.scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.85);
      fillLight.position.set(-3.0, 1.4, 3.2);
      this.scene.add(fillLight);

      const rimLight = new THREE.DirectionalLight(0xfff7ed, 0.95);
      rimLight.position.set(0.2, 2.8, -3.5);
      this.scene.add(rimLight);

      // Soft floating pastel sparkles in background
      this.sparkles = new THREE.Group();
      const sparkleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 });
      const sparklePos = [
        [-1.75, 0.88, -1.6, 0.16],
        [1.82, 0.72, -1.5, 0.13],
        [-1.55, -0.62, -1.8, 0.11],
        [1.62, -0.52, -1.4, 0.14],
      ];
      sparklePos.forEach(([x, y, z, r]) => {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), sparkleMat);
        dot.position.set(x, y, z);
        this.sparkles.add(dot);
      });
      this.scene.add(this.sparkles);

      this.webglOk = true;
    } catch (err) {
      console.warn('Three.js init error:', err);
      this.webglOk = false;
    }
  }

  _bindStageInteraction() {
    let dragging = false;
    let startX = 0;
    let startY = 0;

    this.stageEl.addEventListener('pointerdown', (e) => {
      if (this.hasParentVideo) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = (e.clientX - startX) / 140;
      const dy = (e.clientY - startY) / 160;
      this.targetYaw = THREE.MathUtils.clamp(dx * 0.58, -0.58, 0.58);
      this.targetPitch = THREE.MathUtils.clamp(dy * 0.25, -0.22, 0.22);
    });

    const endDrag = () => {
      dragging = false;
      this.targetYaw = 0;
      this.targetPitch = 0;
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  }

  loadAvatar(buddyKey = 'bear') {
    if (!this.webglOk) return;
    this.buddyKey = BUDDY_THEMES[buddyKey] ? buddyKey : 'bear';
    const theme = BUDDY_THEMES[this.buddyKey];

    if (this.buddyRoot) {
      this.scene.remove(this.buddyRoot);
    }

    const root = new THREE.Group();
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.16, 0);
    root.add(headGroup);

    // Plush Velvet Materials
    const furMat = new THREE.MeshPhysicalMaterial({
      color: theme.fur,
      roughness: 0.78,
      metalness: 0.0,
      sheen: 0.88,
      sheenRoughness: 0.68,
      sheenColor: new THREE.Color(theme.furSheen),
    });

    const earFurMat = new THREE.MeshPhysicalMaterial({
      color: theme.earFur,
      roughness: 0.80,
      metalness: 0.0,
      sheen: 0.75,
      sheenRoughness: 0.72,
      sheenColor: new THREE.Color(theme.furSheen),
    });

    const muzzleMat = new THREE.MeshPhysicalMaterial({
      color: theme.muzzle,
      roughness: 0.74,
      metalness: 0.0,
      sheen: 0.65,
      sheenRoughness: 0.70,
      sheenColor: new THREE.Color(0xffffff),
    });

    const innerEarMat = new THREE.MeshPhysicalMaterial({
      color: theme.innerEar,
      roughness: 0.62,
      metalness: 0.0,
      sheen: 0.5,
      sheenColor: new THREE.Color(0xffe4e6),
    });

    const blushMat = new THREE.MeshPhysicalMaterial({
      color: theme.blush,
      roughness: 0.65,
      transparent: true,
      opacity: 0.34,
    });

    const shirtMat = new THREE.MeshPhysicalMaterial({
      color: theme.shirt,
      roughness: 0.72,
      sheen: 0.6,
      sheenColor: new THREE.Color(theme.collar),
    });

    // 1. Cozy Shoulders & Sweater Collar
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.95, 32, 24), shirtMat);
    torso.scale.set(1.22, 0.78, 0.85);
    torso.position.set(0, -1.16, -0.06);
    root.add(torso);

    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.09, 16, 32),
      new THREE.MeshPhysicalMaterial({ color: theme.collar, roughness: 0.65 })
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, -0.68, 0.02);
    root.add(collar);

    // 2. Plush Head (slightly pear-shaped chubby toddler-plush silhouette!)
    const headGeo = new THREE.SphereGeometry(0.92, 42, 34);
    const hp = headGeo.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      let x = hp.getX(i);
      let y = hp.getY(i);
      let z = hp.getZ(i);
      // Softly wider cheeks below midline, gently rounded forehead
      const lowerBulge = y < 0 ? 1 + Math.min(0.11, -y * 0.14) : 1 - y * 0.04;
      x *= 1.07 * lowerBulge;
      y *= 0.97;
      z *= 0.96;
      hp.setXYZ(i, x, y, z);
    }
    headGeo.computeVertexNormals();
    const headMesh = new THREE.Mesh(headGeo, furMat);
    headGroup.add(headMesh);

    // Cute soft forehead hair tuft
    const tuftGroup = new THREE.Group();
    const tuft1 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 16), furMat);
    tuft1.scale.set(1.2, 0.75, 0.9);
    tuft1.position.set(-0.04, 0.88, 0.22);
    const tuft2 = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 16), furMat);
    tuft2.scale.set(1.0, 0.9, 0.85);
    tuft2.position.set(0.09, 0.87, 0.18);
    tuftGroup.add(tuft1, tuft2);
    headGroup.add(tuftGroup);

    // 3. Animal-Specific Ears (Bear / Puppy / Bunny!)
    const leftEarPivot = new THREE.Group();
    const rightEarPivot = new THREE.Group();
    if (theme.earType === 'bear') {
      leftEarPivot.position.set(-0.76, 0.64, -0.06);
      rightEarPivot.position.set(0.76, 0.64, -0.06);
      [leftEarPivot, rightEarPivot].forEach((piv) => {
        const outer = new THREE.Mesh(new THREE.SphereGeometry(0.32, 26, 20), earFurMat);
        outer.scale.set(1.0, 1.0, 0.52);
        const inner = new THREE.Mesh(new THREE.SphereGeometry(0.20, 22, 18), innerEarMat);
        inner.scale.set(1.0, 1.0, 0.40);
        inner.position.set(0, -0.02, 0.10);
        piv.add(outer, inner);
      });
    } else if (theme.earType === 'puppy') {
      leftEarPivot.position.set(-0.84, 0.42, -0.02);
      rightEarPivot.position.set(0.84, 0.42, -0.02);
      [
        { piv: leftEarPivot, sign: -1 },
        { piv: rightEarPivot, sign: 1 },
      ].forEach(({ piv, sign }) => {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 20), earFurMat);
        ear.scale.set(0.68, 1.52, 0.44);
        ear.position.set(sign * 0.14, -0.34, 0.04);
        ear.rotation.z = sign * 0.24;
        piv.add(ear);
      });
    } else {
      // Cozy Bunny velvety ears (proportioned cleanly inside the portrait frame!)
      leftEarPivot.position.set(-0.36, 0.72, -0.06);
      rightEarPivot.position.set(0.36, 0.72, -0.06);
      [
        { piv: leftEarPivot, sign: -1 },
        { piv: rightEarPivot, sign: 1 },
      ].forEach(({ piv, sign }) => {
        const outer = new THREE.Mesh(new THREE.SphereGeometry(0.23, 24, 20), earFurMat);
        outer.scale.set(0.84, 1.62, 0.46);
        outer.position.set(sign * 0.12, 0.28, 0);
        outer.rotation.z = -sign * 0.28;
        const inner = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16), innerEarMat);
        inner.scale.set(0.76, 1.40, 0.35);
        inner.position.set(sign * 0.12, 0.27, 0.075);
        inner.rotation.z = -sign * 0.28;
        piv.add(outer, inner);
      });
    }
    headGroup.add(leftEarPivot, rightEarPivot);

    // 4. Soft Muzzle & Inflatable Rosy Cheeks (for Puff Cheeks!)
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.56, 34, 26), muzzleMat);
    muzzle.scale.set(1.16, 0.88, 0.72);
    muzzle.position.set(0, -0.24, 0.56);
    headGroup.add(muzzle);

    // Inflatable 3D Cheek Puffs (smoothly blend into sides of muzzle & pop out when puffing!)
    const cheekLeft = new THREE.Mesh(new THREE.SphereGeometry(0.32, 26, 20), furMat);
    cheekLeft.position.set(-0.62, -0.18, 0.52);
    cheekLeft.scale.set(0.85, 0.76, 0.62);
    const cheekRight = cheekLeft.clone();
    cheekRight.position.x = 0.62;
    headGroup.add(cheekLeft, cheekRight);

    const blushLeft = new THREE.Mesh(new THREE.SphereGeometry(0.20, 20, 16), blushMat);
    blushLeft.scale.set(1.05, 0.68, 0.16);
    blushLeft.position.set(-0.58, -0.10, 0.72);
    blushLeft.rotation.y = -0.45;
    const blushRight = blushLeft.clone();
    blushRight.position.x = 0.58;
    blushRight.rotation.y = 0.45;
    headGroup.add(blushLeft, blushRight);

    // 5. Big Glossy Pixar Eyes with Dual Sparkle Catchlights + Blinking Lids
    const leftEye = this._buildPixarEye(furMat);
    leftEye.group.position.set(-0.37, 0.20, 0.78);
    leftEye.group.rotation.y = -0.16;

    const rightEye = this._buildPixarEye(furMat);
    rightEye.group.position.set(0.37, 0.20, 0.78);
    rightEye.group.rotation.y = 0.16;
    headGroup.add(leftEye.group, rightEye.group);

    // Expressive Friendly Gently-Arched Eyebrows (warm Disney/Pixar angle!)
    const browMat = new THREE.MeshPhysicalMaterial({ color: 0x6b442e, roughness: 0.72 });
    const leftBrow = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.16, 8, 14), browMat);
    leftBrow.rotation.z = Math.PI / 2 + 0.16;
    leftBrow.position.set(-0.38, 0.48, 0.78);

    const rightBrow = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.16, 8, 14), browMat);
    rightBrow.rotation.z = Math.PI / 2 - 0.16;
    rightBrow.position.set(0.38, 0.48, 0.78);
    headGroup.add(leftBrow, rightBrow);

    // Cute Rounded Glossy Nose
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 24, 18),
      new THREE.MeshPhysicalMaterial({
        color: theme.nose,
        roughness: 0.22,
        clearcoat: 0.75,
        clearcoatRoughness: 0.18,
      })
    );
    nose.scale.set(1.24, 0.88, 0.85);
    nose.position.set(0, -0.02, 0.96);
    headGroup.add(nose);

    // =========================================================================
    // 6. ULTRA-CLEAR 3D MOUTH, PLUSH LIPS, TEETH & ARTICULATED PINK TONGUE!
    // =========================================================================
    const mouthAnchor = new THREE.Group();
    mouthAnchor.position.set(0, -0.34, 0.89);
    headGroup.add(mouthAnchor);

    // Dark warm oral cavity backdrop
    const cavityMat = new THREE.MeshStandardMaterial({ color: 0x581322, roughness: 0.9 });
    const mouthCavity = new THREE.Mesh(new THREE.SphereGeometry(0.28, 26, 20), cavityMat);
    mouthCavity.scale.set(1.0, 0.15, 0.42);
    mouthCavity.position.set(0, 0, -0.05);
    mouthAnchor.add(mouthCavity);

    // Cute rounded upper teeth (bright soft ivory)
    const teethMat = new THREE.MeshPhysicalMaterial({
      color: 0xfffef9,
      roughness: 0.18,
      clearcoat: 0.5,
    });
    const upperTeeth = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.085, 0.08), teethMat);
    upperTeeth.position.set(0, 0.07, 0.02);
    mouthAnchor.add(upperTeeth);

    // Continuous Seamless 3D Plush Lip Ring (zero corner gaps at every pose!)
    const lipMat = new THREE.MeshPhysicalMaterial({
      color: 0xe66a81,
      roughness: 0.36,
      clearcoat: 0.3,
      clearcoatRoughness: 0.35,
      sheen: 0.45,
      sheenColor: new THREE.Color(0xffc2ce),
    });

    const lipRing = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.042, 20, 48), lipMat);
    lipRing.position.set(0, 0, 0.035);
    mouthAnchor.add(lipRing);

    // Soft closed-lip pill bar (used cleanly when lips are pressed tight shut!)
    const closedLipBar = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.36, 10, 18), lipMat);
    closedLipBar.rotation.z = Math.PI / 2;
    closedLipBar.position.set(0, 0, 0.05);
    closedLipBar.visible = false;
    mouthAnchor.add(closedLipBar);

    // Expressive Glossy 3D Pink Tongue (articulated pivot inside mouth!)
    const tonguePivot = new THREE.Group();
    tonguePivot.position.set(0, -0.03, -0.02);
    mouthAnchor.add(tonguePivot);

    const tGeo = new THREE.SphereGeometry(1, 28, 22);
    const tp = tGeo.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      let x = tp.getX(i);
      let y = tp.getY(i);
      let z = tp.getZ(i);
      const tipTaper = z > 0 ? 1 - z * 0.24 : 1;
      x *= 0.175 * tipTaper;
      const groove = y > 0 ? Math.exp(-Math.pow(x / 0.055, 2)) * 0.022 : 0;
      y = y * 0.072 - groove;
      z = (z + 0.72) * 0.26;
      tp.setXYZ(i, x, y, z);
    }
    tGeo.computeVertexNormals();

    const tongueMat = new THREE.MeshPhysicalMaterial({
      color: 0xfb7185,
      roughness: 0.24,
      clearcoat: 0.65,
      clearcoatRoughness: 0.2,
      sheen: 0.45,
      sheenColor: new THREE.Color(0xffcad4),
    });
    const tongueMesh = new THREE.Mesh(tGeo, tongueMat);
    tonguePivot.add(tongueMesh);

    this.scene.add(root);
    this.buddyRoot = root;
    this.parts = {
      headGroup,
      leftEarPivot,
      rightEarPivot,
      muzzle,
      cheekLeft,
      cheekRight,
      blushLeft,
      blushRight,
      blushMat,
      leftEye,
      rightEye,
      leftBrow,
      rightBrow,
      nose,
      mouthAnchor,
      mouthCavity,
      upperTeeth,
      lipRing,
      closedLipBar,
      tonguePivot,
      tongueMesh,
      earType: theme.earType,
    };

    // Generous portrait headroom so full ears and chin fit cleanly above the bottom step pill!
    if (theme.earType === 'bunny') {
      this.camera.position.set(0, 0.24, 5.45);
      this.camera.lookAt(0, 0.20, 0);
    } else {
      this.camera.position.set(0, 0.10, 4.95);
      this.camera.lookAt(0, 0.06, 0);
    }
  }

  _buildPixarEye(lidMat) {
    const group = new THREE.Group();

    // Soft white sclera
    const sclera = new THREE.Mesh(
      new THREE.SphereGeometry(0.185, 26, 20),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.14, clearcoat: 0.7 })
    );
    sclera.scale.set(1.0, 1.08, 0.68);
    group.add(sclera);

    // Warm deep-amber/chocolate iris + dark pupil
    const iris = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 24, 18),
      new THREE.MeshPhysicalMaterial({ color: 0x3f2314, roughness: 0.12, clearcoat: 0.9 })
    );
    iris.scale.set(1.0, 1.05, 0.45);
    iris.position.set(0, 0, 0.085);
    group.add(iris);

    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.088, 20, 16),
      new THREE.MeshBasicMaterial({ color: 0x110c0a })
    );
    pupil.scale.set(1.0, 1.05, 0.35);
    pupil.position.set(0, 0, 0.125);
    group.add(pupil);

    // Dual Pixar sparkle catchlights!
    const catchMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const bigSparkle = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 12), catchMat);
    bigSparkle.position.set(-0.048, 0.055, 0.155);
    const smallSparkle = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 10), catchMat);
    smallSparkle.position.set(0.045, -0.042, 0.155);
    group.add(bigSparkle, smallSparkle);

    // Upper eyelid dome (closes softly on blink!)
    const lid = new THREE.Mesh(
      new THREE.SphereGeometry(0.195, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
      lidMat
    );
    lid.scale.set(1.04, 1.08, 0.74);
    lid.rotation.x = -Math.PI * 0.58; // open by default
    group.add(lid);

    return { group, lid };
  }

  _syncSize() {
    const rect = this.stageEl.getBoundingClientRect();
    const w = Math.max(240, Math.round(rect.width));
    const h = Math.max(180, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (this.renderer && this.camera) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    const gw = Math.round(w * dpr);
    const gh = Math.round(h * dpr);
    if (this.guideCanvas.width !== gw || this.guideCanvas.height !== gh) {
      this.guideCanvas.width = gw;
      this.guideCanvas.height = gh;
    }
  }

  setItem(item, { isMoveMode = true, parentVideoBlob = null } = {}) {
    this.item = item;
    this.isMoveMode = isMoveMode;
    this.elapsedMs = 0;
    this.loopWaitMs = 0;
    this.activeStepIdx = -1;

    if (!item?.detector || !item.detector.startsWith('tongue')) {
      this.currentPose.tongueOut = 0;
      this.currentPose.tongueX = 0;
      this.currentPose.tongueY = 0;
    }

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
      if (this.webglCanvas) this.webglCanvas.classList.add('hidden');
      this.guideCanvas.classList.add('hidden');
      this.modeBadgeEl.textContent = 'Parent Video';
      this.modeBadgeEl.classList.add('parent-video');
      this.videoEl.play().catch(() => {});
    } else {
      this.hasParentVideo = false;
      this.videoEl.pause();
      this.videoEl.removeAttribute('src');
      this.videoEl.classList.add('hidden');
      if (this.webglCanvas) this.webglCanvas.classList.remove('hidden');
      this.guideCanvas.classList.remove('hidden');
      this.modeBadgeEl.textContent = BUDDY_THEMES[this.buddyKey]?.label || '3D Buddy';
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
      this._updateAnimation(dt);
      this._applyPoseToBuddy();
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
      this._drawGuideOverlay();
    }

    this._raf = requestAnimationFrame((nextTs) => this._tick(nextTs));
  }

  _updateAnimation(dt) {
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkPhase += dt / 150;
      if (this.blinkPhase >= 1) {
        this.blinkPhase = 0;
        this.blinkTimer = 2500 + Math.random() * 2500;
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
        this.targetPose = BUDDY_POSES[found.v] || BUDDY_POSES.rest;
        const idx = found.step !== undefined ? found.step : (found.syl ?? -1);
        this._highlightStep(idx);
      } else {
        this.playing = false;
        this.targetPose = BUDDY_POSES.rest;
        this._highlightStep(-1);
        this.loopWaitMs = this.isMoveMode ? 850 : 1250;
      }
    } else if (this.loopEnabled) {
      this.loopWaitMs -= dt;
      if (this.loopWaitMs <= 0) {
        this.playing = true;
        this.elapsedMs = 0;
      }
    }

    const alpha = Math.min(1, (dt / 1000) * (this.slowMode ? 6.5 : 12.0));
    for (const k of Object.keys(this.currentPose)) {
      this.currentPose[k] += ((this.targetPose[k] || 0) - this.currentPose[k]) * alpha;
    }

    this.pointerYaw += (this.targetYaw - this.pointerYaw) * Math.min(1, (dt / 1000) * 8);
    this.pointerPitch += (this.targetPitch - this.pointerPitch) * Math.min(1, (dt / 1000) * 8);
  }

  _applyPoseToBuddy() {
    const pt = this.parts;
    if (!pt.headGroup) return;
    const p = this.currentPose;

    // Gentle alive breathing + playful head lean
    const breath = Math.sin(this.clockSec * 1.9) * 0.022;
    pt.headGroup.position.y = 0.16 + breath;
    pt.headGroup.rotation.y = Math.sin(this.clockSec * 0.9) * 0.055 + p.tongueX * 0.10 + this.pointerYaw;
    pt.headGroup.rotation.x = Math.sin(this.clockSec * 1.3) * 0.025 + p.pucker * 0.06 - p.open * 0.04 + this.pointerPitch;
    pt.headGroup.rotation.z = Math.sin(this.clockSec * 0.7) * 0.03 + p.tongueX * 0.07;

    // Happy ear wiggle / perk!
    const earBounce = Math.sin(this.clockSec * 2.4) * 0.035 + p.earPerk * 0.14;
    if (pt.earType === 'puppy') {
      pt.leftEarPivot.rotation.z = -earBounce * 1.3;
      pt.rightEarPivot.rotation.z = earBounce * 1.3;
    } else {
      pt.leftEarPivot.rotation.z = earBounce;
      pt.rightEarPivot.rotation.z = -earBounce;
    }

    // Blinking eyes + happy eye crinkle on big smile
    const blink = this.blinkPhase > 0 ? Math.sin(this.blinkPhase * Math.PI) : 0;
    const lidRot = -Math.PI * 0.58 + blink * Math.PI * 0.62;
    pt.leftEye.lid.rotation.x = lidRot;
    pt.rightEye.lid.rotation.x = lidRot;

    const eyeSmileScale = 1 - p.smile * 0.10;
    pt.leftEye.group.scale.set(1, eyeSmileScale, 1);
    pt.rightEye.group.scale.set(1, eyeSmileScale, 1);

    // Eyebrow lift
    const browY = 0.48 + p.browLift * 0.085;
    pt.leftBrow.position.y = browY;
    pt.rightBrow.position.y = browY;

    // Nose cute slight wiggle
    pt.nose.position.y = -0.02 + p.pucker * 0.025 + p.smile * 0.02;

    // Inflatable 3D Cheek Puffs!
    const puff = p.cheekPuff;
    const cheekS = 0.85 + puff * 0.56;
    pt.cheekLeft.scale.set(cheekS, 0.76 + puff * 0.46, 0.62 + puff * 0.52);
    pt.cheekRight.scale.set(cheekS, 0.76 + puff * 0.46, 0.62 + puff * 0.52);
    pt.cheekLeft.position.set(-0.62 - puff * 0.16, -0.18, 0.52 + puff * 0.16);
    pt.cheekRight.position.set(0.62 + puff * 0.16, -0.18, 0.52 + puff * 0.16);

    pt.blushMat.opacity = 0.30 + puff * 0.38 + p.smile * 0.18;
    pt.blushLeft.position.set(-0.64 - puff * 0.18, -0.09, 0.70 + puff * 0.16);
    pt.blushRight.position.set(0.64 + puff * 0.18, -0.09, 0.70 + puff * 0.16);

    // =========================================================================
    // Seamless Continuous 3D Lips, Teeth & Mouth Cavity Animation
    // =========================================================================
    const open = p.open;
    const wScale = p.width;
    const pucker = p.pucker;
    const smile = p.smile;
    const isClosedTight = open < 0.06 && pucker < 0.4;

    // Pucker pushes lips visibly forward (+Z)
    pt.mouthAnchor.position.z = 0.89 + pucker * 0.14;
    pt.mouthAnchor.position.y = -0.34 - open * 0.035 + smile * 0.03;

    if (isClosedTight) {
      pt.lipRing.visible = false;
      pt.closedLipBar.visible = true;
      pt.closedLipBar.scale.set(1.0 + p.press * 0.15, wScale * (0.95 - p.cheekPuff * 0.14), 1.0 + pucker * 0.5);
    } else {
      pt.closedLipBar.visible = false;
      pt.lipRing.visible = true;
      const ringW = pucker > 0.45 ? 0.56 + (1 - pucker) * 0.22 : wScale;
      const ringH = pucker > 0.45
        ? 0.56 + open * 0.35
        : Math.max(0.18, 0.18 + open * 0.88 + smile * 0.12);
      const ringZ = 1.0 + pucker * 0.85;
      pt.lipRing.scale.set(ringW, ringH, ringZ);
      pt.lipRing.position.z = 0.035 + pucker * 0.05;
    }

    // Mouth dark interior cavity (completely hidden when lips are closed!)
    if (!isClosedTight && open > 0.08) {
      pt.mouthCavity.visible = true;
      const cavW = pucker > 0.45 ? 0.48 : wScale * 0.86;
      pt.mouthCavity.scale.set(cavW, Math.max(0.14, open * 0.78), 0.42);
      pt.mouthCavity.position.y = 0;
    } else {
      pt.mouthCavity.visible = false;
    }

    // Upper teeth (cleanly hidden when lips pressed shut!)
    pt.upperTeeth.visible = !isClosedTight && (open > 0.18 || smile > 0.55 || p.teethLip > 0.35);
    pt.upperTeeth.scale.set(Math.min(1.18, wScale * 0.88), 0.85 + open * 0.16, 1);
    pt.upperTeeth.position.set(0, 0.04 + open * 0.075, 0.025 + p.teethLip * 0.05);

    // =========================================================================
    // Articulated Glossy 3D Pink Tongue!
    // =========================================================================
    const tOut = p.tongueOut;
    if (tOut > 0.05 || p.tongueIn > 0.15) {
      pt.tonguePivot.visible = true;
      const ext = Math.max(tOut, p.tongueIn * 0.35);
      pt.tonguePivot.position.set(
        p.tongueX * 0.14 * ext,
        -0.05 - p.tongueY * 0.08 * ext + p.tongueIn * 0.08,
        0.02 + ext * 0.18
      );
      pt.tonguePivot.rotation.set(
        0.16 + p.tongueY * 0.55 - p.tongueIn * 0.45,
        p.tongueX * 0.58,
        -p.tongueX * 0.18
      );
      pt.tongueMesh.scale.set(
        0.92 + ext * 0.18,
        0.88 + ext * 0.18,
        0.55 + ext * 0.88
      );
    } else {
      pt.tonguePivot.visible = false;
    }

    // Project mouth center to 2D screen space for pulsing directional guide arrows
    const mouthWorld = new THREE.Vector3();
    pt.mouthAnchor.getWorldPosition(mouthWorld);
    const proj = mouthWorld.project(this.camera);
    this.mouthScreenPos.x = (proj.x + 1) * 0.5;
    this.mouthScreenPos.y = (1 - proj.y) * 0.5;

    // Gentle sparkle drift
    if (this.sparkles) {
      this.sparkles.position.y = Math.sin(this.clockSec * 1.1) * 0.06;
    }
  }

  _drawGuideOverlay() {
    const ctx = this.guideCtx;
    const w = this.guideCanvas.width;
    const h = this.guideCanvas.height;
    const dpr = w / Math.max(1, this.guideCanvas.clientWidth);

    ctx.clearRect(0, 0, w, h);

    if (this.showLines && this.isMoveMode && this.item?.guide) {
      const mx = w * this.mouthScreenPos.x;
      const my = h * Math.min(0.76, Math.max(0.45, this.mouthScreenPos.y));
      const pulse = Math.sin(this.clockSec * 5) * 4 * dpr;
      const guide = this.item.guide;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (guide === 'openWide' || guide === 'lipPop') {
        this._drawArrow(ctx, mx, my - 24 * dpr - pulse, mx, my - 48 * dpr - pulse, '#10b981', dpr);
        this._drawArrow(ctx, mx, my + 24 * dpr + pulse, mx, my + 48 * dpr + pulse, '#10b981', dpr);
      } else if (guide === 'smile') {
        this._drawArrow(ctx, mx - 42 * dpr - pulse, my, mx - 68 * dpr - pulse, my, '#f59e0b', dpr);
        this._drawArrow(ctx, mx + 42 * dpr + pulse, my, mx + 68 * dpr + pulse, my, '#f59e0b', dpr);
      } else if (guide === 'kiss') {
        this._drawArrow(ctx, mx - 66 * dpr + pulse, my, mx - 38 * dpr + pulse, my, '#ec4899', dpr);
        this._drawArrow(ctx, mx + 66 * dpr - pulse, my, mx + 38 * dpr - pulse, my, '#ec4899', dpr);
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.72)';
        ctx.lineWidth = 3 * dpr;
        ctx.beginPath();
        ctx.arc(mx, my, 24 * dpr + pulse * 0.4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (guide === 'tongueOut' || guide === 'tongueDown') {
        this._drawArrow(ctx, mx, my + 16 * dpr + pulse * 0.6, mx, my + 40 * dpr + pulse * 0.6, '#ec4899', dpr);
      } else if (guide === 'tongueUp') {
        this._drawArrow(ctx, mx, my - 12 * dpr - pulse, mx, my - 40 * dpr - pulse, '#ec4899', dpr);
      } else if (guide === 'tongueWiggle') {
        this._drawArrow(ctx, mx - 28 * dpr - pulse, my + 20 * dpr, mx - 62 * dpr - pulse, my + 20 * dpr, '#ec4899', dpr);
        this._drawArrow(ctx, mx + 28 * dpr + pulse, my + 20 * dpr, mx + 62 * dpr + pulse, my + 20 * dpr, '#ec4899', dpr);
      } else if (guide === 'cheekPuff') {
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 3.5 * dpr;
        ctx.beginPath();
        ctx.arc(mx - 76 * dpr - pulse * 0.6, my - 14 * dpr, 24 * dpr, Math.PI * 0.68, Math.PI * 1.32);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(mx + 76 * dpr + pulse * 0.6, my - 14 * dpr, 24 * dpr, -Math.PI * 0.32, Math.PI * 0.32);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (this.slowMode) {
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

  _drawArrow(ctx, x1, y1, x2, y2, color, dpr) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = 10 * dpr;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.lineWidth = 6.5 * dpr;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = 3.6 * dpr;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }
}
