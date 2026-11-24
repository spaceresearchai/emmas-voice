// ============================================================================
// Three.js Realistic 3D Human Coach (Photorealistic Avaturn + Brunette GLBs)
// Drives 72 ARKit + Oculus Viseme Blendshapes + Articulated 3D Tongue Motion
// + Crisp 2D Directional Guide Overlay + Seamless Parent Video Support
// ============================================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const AVATAR_MODELS = {
  realistic: {
    label: 'Realistic 3D Person (Avaturn)',
    url: 'https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@main/avatars/avaturn.glb',
  },
  friendly: {
    label: 'Friendly 3D Coach (Brunette)',
    url: 'https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@main/avatars/brunette.glb',
  },
};

// Map each pose key from moves.js / words.js directly to rich 52-ARKit blendshapes + tongue 3D bend!
const ARKIT_POSES = {
  rest: {
    jawOpen: 0.02, mouthSmileLeft: 0.14, mouthSmileRight: 0.14,
    mouthPucker: 0, mouthFunnel: 0, mouthPressLeft: 0, mouthPressRight: 0,
    mouthClose: 0, mouthStretchLeft: 0, mouthStretchRight: 0,
    cheekPuff: 0, tongueOut: 0, browInnerUp: 0.05,
    jawLeft: 0, jawRight: 0, mouthUpperUpLeft: 0, mouthUpperUpRight: 0,
    mouthLowerDownLeft: 0, mouthLowerDownRight: 0,
    tongueBendX: 0, tongueBendY: 0, tongueExtend: 0,
  },
  closed: {
    jawOpen: 0, mouthClose: 0.55, mouthPressLeft: 0.92, mouthPressRight: 0.92,
    mouthRollLower: 0.42, mouthRollUpper: 0.35,
    mouthSmileLeft: 0, mouthSmileRight: 0, mouthPucker: 0.08,
    cheekPuff: 0, tongueOut: 0, tongueBendX: 0, tongueBendY: 0, tongueExtend: 0,
  },
  openWide: {
    jawOpen: 0.82, mouthOpen: 0.72, viseme_aa: 0.65,
    mouthLowerDownLeft: 0.35, mouthLowerDownRight: 0.35,
    browInnerUp: 0.22, mouthSmileLeft: 0.12, mouthSmileRight: 0.12,
    tongueOut: 0, tongueBendX: 0, tongueBendY: 0, tongueExtend: 0,
  },
  openBig: {
    jawOpen: 1.0, mouthOpen: 0.92, viseme_aa: 0.8,
    mouthLowerDownLeft: 0.55, mouthLowerDownRight: 0.55,
    mouthUpperUpLeft: 0.22, mouthUpperUpRight: 0.22,
    browInnerUp: 0.42, browOuterUpLeft: 0.3, browOuterUpRight: 0.3,
    tongueOut: 0, tongueBendX: 0, tongueBendY: 0, tongueExtend: 0,
  },
  openMid: {
    jawOpen: 0.46, mouthOpen: 0.38, viseme_aa: 0.35,
    mouthSmileLeft: 0.12, mouthSmileRight: 0.12,
    tongueOut: 0, tongueBendX: 0, tongueBendY: 0, tongueExtend: 0,
  },
  roundTight: {
    jawOpen: 0.18, mouthPucker: 0.88, mouthFunnel: 0.55, viseme_U: 0.6,
    browInnerUp: 0.18, tongueOut: 0, tongueBendX: 0, tongueBendY: 0, tongueExtend: 0,
  },
  kissPucker: {
    jawOpen: 0.12, mouthPucker: 1.0, mouthFunnel: 0.72, viseme_U: 0.65,
    browInnerUp: 0.28, cheekSquintLeft: 0.15, cheekSquintRight: 0.15,
    tongueOut: 0, tongueBendX: 0, tongueBendY: 0, tongueExtend: 0,
  },
  roundOpen: {
    jawOpen: 0.56, mouthFunnel: 0.82, mouthPucker: 0.48, viseme_O: 0.7,
    browInnerUp: 0.2, tongueOut: 0, tongueBendX: 0, tongueBendY: 0, tongueExtend: 0,
  },
  smile: {
    jawOpen: 0.16, mouthSmileLeft: 0.85, mouthSmileRight: 0.85,
    mouthStretchLeft: 0.32, mouthStretchRight: 0.32,
    cheekSquintLeft: 0.38, cheekSquintRight: 0.38, viseme_I: 0.4,
    tongueOut: 0, tongueBendX: 0, tongueBendY: 0, tongueExtend: 0,
  },
  bigSmile: {
    jawOpen: 0.24, mouthSmileLeft: 1.0, mouthSmileRight: 1.0, mouthSmile: 0.9,
    mouthStretchLeft: 0.58, mouthStretchRight: 0.58,
    mouthUpperUpLeft: 0.28, mouthUpperUpRight: 0.28,
    cheekSquintLeft: 0.62, cheekSquintRight: 0.62, browOuterUpLeft: 0.2, browOuterUpRight: 0.2,
    tongueOut: 0, tongueBendX: 0, tongueBendY: 0, tongueExtend: 0,
  },
  tongueUp: {
    jawOpen: 0.44, viseme_DD: 0.65, viseme_nn: 0.55, viseme_TH: 0.45,
    mouthUpperUpLeft: 0.2, mouthUpperUpRight: 0.2,
    tongueOut: 0.35, tongueBendX: 0, tongueBendY: -0.65, tongueExtend: 0.35,
  },
  teethLip: {
    jawOpen: 0.08, viseme_FF: 0.9, mouthRollLower: 0.65,
    mouthUpperUpLeft: 0.25, mouthUpperUpRight: 0.25,
    tongueOut: 0, tongueBendX: 0, tongueBendY: 0, tongueExtend: 0,
  },
  tongueOut: {
    jawOpen: 0.68, mouthOpen: 0.58, tongueOut: 1.0,
    mouthLowerDownLeft: 0.45, mouthLowerDownRight: 0.45,
    browInnerUp: 0.3, browOuterUpLeft: 0.22, browOuterUpRight: 0.22,
    tongueBendX: 0, tongueBendY: 0.15, tongueExtend: 1.0,
  },
  tongueLeft: {
    jawOpen: 0.64, mouthOpen: 0.52, tongueOut: 1.0,
    jawLeft: 0.32, mouthLeft: 0.35,
    mouthLowerDownLeft: 0.4, mouthLowerDownRight: 0.4,
    browInnerUp: 0.25,
    tongueBendX: -1.0, tongueBendY: 0.08, tongueExtend: 0.95,
  },
  tongueRight: {
    jawOpen: 0.64, mouthOpen: 0.52, tongueOut: 1.0,
    jawRight: 0.32, mouthRight: 0.35,
    mouthLowerDownLeft: 0.4, mouthLowerDownRight: 0.4,
    browInnerUp: 0.25,
    tongueBendX: 1.0, tongueBendY: 0.08, tongueExtend: 0.95,
  },
  tongueReachUp: {
    jawOpen: 0.62, mouthOpen: 0.52, tongueOut: 1.0,
    mouthUpperUpLeft: 0.38, mouthUpperUpRight: 0.38,
    browInnerUp: 0.36,
    tongueBendX: 0, tongueBendY: -1.0, tongueExtend: 0.92,
  },
  tongueReachDown: {
    jawOpen: 0.78, mouthOpen: 0.68, tongueOut: 1.0,
    mouthLowerDownLeft: 0.62, mouthLowerDownRight: 0.62,
    browInnerUp: 0.28,
    tongueBendX: 0, tongueBendY: 1.0, tongueExtend: 1.05,
  },
  cheekPuff: {
    jawOpen: 0, mouthClose: 0.52, mouthPressLeft: 0.85, mouthPressRight: 0.85,
    mouthPucker: 0.32, cheekPuff: 1.0,
    browInnerUp: 0.35, eyeWideLeft: 0.28, eyeWideRight: 0.28,
    tongueOut: 0, tongueBendX: 0, tongueBendY: 0, tongueExtend: 0,
  },
};

const ALL_MORPH_KEYS = Array.from(
  new Set(Object.values(ARKIT_POSES).flatMap((p) => Object.keys(p)))
).filter((k) => !k.startsWith('tongueBend') && k !== 'tongueExtend');

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
    this.avatarKey = 'realistic';

    this.hasParentVideo = false;
    this.currentVideoUrl = null;

    // Animation timeline state
    this.playing = false;
    this.elapsedMs = 0;
    this.loopWaitMs = 0;
    this.lastFrameTs = 0;
    this.clockSec = 0;
    this.blinkTimer = 2600;
    this.blinkPhase = 0;
    this.activeStepIdx = -1;

    // Smooth current morph & tongue values
    this.currentValues = {};
    this.targetValues = { ...ARKIT_POSES.rest };
    ALL_MORPH_KEYS.forEach((k) => (this.currentValues[k] = ARKIT_POSES.rest[k] || 0));
    this.currentValues.tongueBendX = 0;
    this.currentValues.tongueBendY = 0;
    this.currentValues.tongueExtend = 0;

    // Subtle pointer tilt so user can inspect lips/tongue from a slight side angle
    this.pointerYaw = 0;
    this.pointerPitch = 0;
    this.targetYaw = 0;
    this.targetPitch = 0;

    // Three.js scene objects
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.avatarRoot = null;
    this.headBone = null;
    this.morphMeshes = [];
    this.customTongueGroup = null;
    this.customTongueMesh = null;
    this.mouthAnchorLocal = new THREE.Vector3(0, -0.045, 0.085);
    this.mouthScreenPos = { x: 0.5, y: 0.62 };
    this.modelReady = false;
    this.webglOk = false;

    this._initThree();
    this._bindStageInteraction();

    this._resizeObserver = new ResizeObserver(() => this._syncSize());
    this._resizeObserver.observe(this.stageEl);
    this._syncSize();

    this.loadAvatar(this.avatarKey);
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
      this.renderer.toneMappingExposure = 1.12;

      this.scene = new THREE.Scene();

      // Portrait lens (28° FOV = flattering natural face proportions, zero fisheye!)
      this.camera = new THREE.PerspectiveCamera(26, 4 / 3, 0.05, 20);
      this.camera.position.set(0, 1.62, 0.72);
      this.camera.lookAt(0, 1.60, 0);

      // Soft warm 3-point photography studio lighting
      const hemi = new THREE.HemisphereLight(0xf4f9ff, 0xffe0c2, 1.35);
      this.scene.add(hemi);

      const keyLight = new THREE.DirectionalLight(0xfffaf2, 1.75);
      keyLight.position.set(0.65, 1.9, 1.45);
      this.scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.9);
      fillLight.position.set(-0.9, 1.65, 1.1);
      this.scene.add(fillLight);

      // Gentle mouth-interior fill light so teeth & tongue are vividly lit!
      const mouthLight = new THREE.PointLight(0xfff1f2, 0.55, 1.2);
      mouthLight.position.set(0, 1.54, 0.45);
      this.scene.add(mouthLight);
      this.mouthLight = mouthLight;

      const rimLight = new THREE.DirectionalLight(0xe0f2fe, 0.65);
      rimLight.position.set(0, 2.2, -1.2);
      this.scene.add(rimLight);

      this.webglOk = true;
    } catch (err) {
      console.warn('Three.js WebGL init failed:', err);
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
      this.targetYaw = THREE.MathUtils.clamp(dx * 0.55, -0.52, 0.52);
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

  async loadAvatar(avatarKey = 'realistic') {
    if (!this.webglOk) return;
    this.avatarKey = AVATAR_MODELS[avatarKey] ? avatarKey : 'realistic';
    const meta = AVATAR_MODELS[this.avatarKey];

    this.modelReady = false;
    this._setLoading(true, `Loading ${meta.label}…`);

    const loader = new GLTFLoader();
    loader.setCrossOrigin('anonymous');

    const tryLoad = (url) =>
      new Promise((resolve, reject) => {
        loader.load(
          url,
          (gltf) => resolve(gltf),
          (xhr) => {
            if (xhr.total > 0) {
              const pct = Math.min(99, Math.round((xhr.loaded / xhr.total) * 100));
              this._setLoading(true, `Loading 3D coach (${pct}%)…`);
            }
          },
          (err) => reject(err)
        );
      });

    try {
      let gltf;
      try {
        gltf = await tryLoad(meta.url);
      } catch (err) {
        if (this.avatarKey === 'realistic') {
          console.warn('Avaturn load failed, falling back to Brunette GLB:', err);
          gltf = await tryLoad(AVATAR_MODELS.friendly.url);
        } else {
          throw err;
        }
      }

      this._mountAvatar(gltf.scene);
      this.modelReady = true;
      this._setLoading(false);
    } catch (err) {
      console.error('Could not load 3D avatar:', err);
      this._setLoading(true, '3D model offline — try Record Video');
    }
  }

  _mountAvatar(root) {
    if (this.avatarRoot) {
      this.scene.remove(this.avatarRoot);
    }
    this.avatarRoot = root;
    this.morphMeshes = [];
    this.headBone = null;
    let headMesh = null;
    let teethMesh = null;
    let nativeTongueMesh = null;

    root.traverse((obj) => {
      if (obj.isBone) {
        if (obj.name === 'Head' || obj.name === 'mixamorigHead') {
          this.headBone = obj;
        }
        // Relax T-pose arms naturally down at her sides for a clean studio portrait!
        if (obj.name === 'LeftArm' || obj.name === 'mixamorigLeftArm') {
          obj.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), -1.18);
          obj.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), 0.08);
        }
        if (obj.name === 'RightArm' || obj.name === 'mixamorigRightArm') {
          obj.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), 1.18);
          obj.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), 0.08);
        }
      }
      if (obj.isMesh) {
        // Hide glasses if present so eyes are super clear and expressive for the child!
        if (obj.name.toLowerCase().includes('glasses')) {
          obj.visible = false;
        }
        if (obj.morphTargetDictionary && obj.morphTargetInfluences) {
          this.morphMeshes.push(obj);
        }
        if (obj.name === 'Head_Mesh' || obj.name === 'Wolf3D_Head') headMesh = obj;
        if (obj.name === 'Teeth_Mesh' || obj.name === 'Wolf3D_Teeth') teethMesh = obj;
        if (obj.name === 'Tongue_Mesh') nativeTongueMesh = obj;

        // Warm realistic skin/tongue shading tweaks
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            if (obj.name === 'Tongue_Mesh') {
              m.roughness = 0.28;
              m.metalness = 0.0;
            }
          });
        }
      }
    });

    this.scene.add(root);
    root.updateMatrixWorld(true);

    // Compute exact framing around the real human head & mouth!
    const focusBox = new THREE.Box3();
    if (headMesh) {
      focusBox.setFromObject(headMesh);
    } else {
      focusBox.setFromObject(root);
    }
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    focusBox.getCenter(center);
    focusBox.getSize(size);

    // Frame portrait cleanly with comfortable headroom above the hair and clear focus on lips/tongue
    const headHeight = Math.max(0.22, Math.min(0.40, size.y));
    const lookY = center.y + headHeight * 0.01;
    const camDist = headHeight * 2.18;
    this.cameraBasePos = new THREE.Vector3(center.x, lookY + headHeight * 0.015, center.z + camDist);
    this.cameraLookTarget = new THREE.Vector3(center.x, lookY, center.z);

    this.camera.position.copy(this.cameraBasePos);
    this.camera.lookAt(this.cameraLookTarget);
    if (this.mouthLight) {
      this.mouthLight.position.set(center.x, lookY - 0.03, center.z + camDist * 0.55);
    }

    // Build an articulated 3D curved tongue mesh anchored inside the mouth so
    // Tongue Out / Wiggle (Left <-> Right) / Up / Down are vividly, clearly visible!
    this._attachArticulatedTongue(teethMesh || headMesh, center, size, Boolean(nativeTongueMesh));
  }

  _attachArticulatedTongue(refMesh, headCenter, headSize, hasNativeTongue) {
    if (this.customTongueGroup && this.customTongueGroup.parent) {
      this.customTongueGroup.parent.remove(this.customTongueGroup);
    }

    // Find mouth world center from Teeth_Mesh bounding box if available (super exact!)
    const mouthWorld = new THREE.Vector3(
      headCenter.x,
      headCenter.y - headSize.y * 0.20,
      headCenter.z + headSize.z * 0.34
    );
    if (refMesh && (refMesh.name === 'Teeth_Mesh' || refMesh.name === 'Wolf3D_Teeth')) {
      const tb = new THREE.Box3().setFromObject(refMesh);
      const tc = new THREE.Vector3();
      const ts = new THREE.Vector3();
      tb.getCenter(tc);
      tb.getSize(ts);
      mouthWorld.set(tc.x, tc.y - ts.y * 0.08, tc.z + ts.z * 0.05);
    }

    this.mouthWorldBase = mouthWorld.clone();

    // Sculpt a smooth organic wet-pink 3D tongue with rounded tip and subtle midline groove
    const geo = new THREE.SphereGeometry(1, 24, 18);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      // Taper gently toward tip (+z), flatten slightly vertically, indent subtle center groove on top
      const tipFactor = z > 0 ? 1 - z * 0.28 : 1;
      x *= 0.0175 * tipFactor;
      const groove = y > 0 ? Math.exp(-Math.pow(x / 0.0055, 2)) * 0.0022 : 0;
      y = y * 0.0078 - groove;
      z = (z + 0.65) * 0.028; // anchor near base (z=0), tip extends forward (+z)
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xe86b82,
      roughness: 0.26,
      metalness: 0.0,
      clearcoat: 0.65,
      clearcoatRoughness: 0.22,
      sheen: 0.35,
      sheenColor: new THREE.Color(0xffb4c2),
    });

    const tongueMesh = new THREE.Mesh(geo, mat);
    const group = new THREE.Group();
    group.add(tongueMesh);
    group.visible = false;

    if (this.headBone) {
      this.headBone.add(group);
      const localPos = this.headBone.worldToLocal(mouthWorld.clone());
      group.position.copy(localPos);
    } else {
      this.scene.add(group);
      group.position.copy(mouthWorld);
    }

    this.customTongueGroup = group;
    this.customTongueMesh = tongueMesh;
    this.hasNativeTongue = hasNativeTongue;
  }

  _setLoading(show, text = '') {
    if (!this.loadingEl) return;
    this.loadingEl.classList.toggle('hidden', !show);
    if (text) {
      const span = this.loadingEl.querySelector('span:last-child');
      if (span) span.textContent = text;
    }
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

    // Retract tongue immediately when switching to a non-tongue move so it never lingers in slow-mo
    if (!item?.detector || !item.detector.startsWith('tongue')) {
      this.currentValues.tongueOut = 0;
      this.currentValues.tongueExtend = 0;
      this.currentValues.tongueBendX = 0;
      this.currentValues.tongueBendY = 0;
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
      this.modeBadgeEl.textContent = isMoveMode ? '3D Real Coach' : '3D Speech Coach';
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
      this._applyPoseTo3D();
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
      this._drawGuideOverlay();
    }

    this._raf = requestAnimationFrame((nextTs) => this._tick(nextTs));
  }

  _updateAnimation(dt) {
    // Natural eye blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkPhase += dt / 160;
      if (this.blinkPhase >= 1) {
        this.blinkPhase = 0;
        this.blinkTimer = 2600 + Math.random() * 2600;
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
        this.targetValues = ARKIT_POSES[found.v] || ARKIT_POSES.rest;
        const idx = found.step !== undefined ? found.step : (found.syl ?? -1);
        this._highlightStep(idx);
      } else {
        this.playing = false;
        this.targetValues = ARKIT_POSES.rest;
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

    // Smooth organic interpolation of all blendshapes + 3D tongue bend
    const alpha = Math.min(1, (dt / 1000) * (this.slowMode ? 6.0 : 11.0));
    for (const k of ALL_MORPH_KEYS) {
      const goal = this.targetValues[k] || 0;
      this.currentValues[k] += (goal - this.currentValues[k]) * alpha;
    }
    for (const tk of ['tongueBendX', 'tongueBendY', 'tongueExtend']) {
      const goal = this.targetValues[tk] || 0;
      this.currentValues[tk] += (goal - this.currentValues[tk]) * alpha;
    }

    this.pointerYaw += (this.targetYaw - this.pointerYaw) * Math.min(1, (dt / 1000) * 8);
    this.pointerPitch += (this.targetPitch - this.pointerPitch) * Math.min(1, (dt / 1000) * 8);
  }

  _applyPoseTo3D() {
    if (!this.modelReady) return;

    const blinkVal = this.blinkPhase > 0 ? Math.sin(this.blinkPhase * Math.PI) : 0;

    // Apply all ARKit + Oculus blendshapes across Head, Teeth, Eyelashes, Eyes, Tongue
    for (const mesh of this.morphMeshes) {
      const dict = mesh.morphTargetDictionary;
      const inf = mesh.morphTargetInfluences;

      for (const k of ALL_MORPH_KEYS) {
        const idx = dict[k];
        if (idx !== undefined) {
          inf[idx] = this.currentValues[k];
        }
      }
      if (dict.eyeBlinkLeft !== undefined) inf[dict.eyeBlinkLeft] = blinkVal;
      if (dict.eyeBlinkRight !== undefined) inf[dict.eyeBlinkRight] = blinkVal;
    }

    // Subtle alive head micro-motion (gentle breathing nod & warm engagement tilt)
    if (this.headBone) {
      const idleYaw = Math.sin(this.clockSec * 0.9) * 0.035;
      const idlePitch = Math.sin(this.clockSec * 1.4) * 0.02 - (this.currentValues.jawOpen || 0) * 0.03;
      const idleRoll = Math.sin(this.clockSec * 0.65) * 0.022 + (this.currentValues.tongueBendX || 0) * 0.03;
      this.headBone.rotation.y = idleYaw + this.pointerYaw;
      this.headBone.rotation.x = idlePitch + this.pointerPitch;
      this.headBone.rotation.z = idleRoll;
    } else if (this.avatarRoot) {
      this.avatarRoot.rotation.y = Math.sin(this.clockSec * 0.9) * 0.04 + this.pointerYaw;
    }

    // Drive articulated 3D tongue mesh (curves vividly left/right/up/down!)
    if (this.customTongueGroup && this.customTongueMesh) {
      const ext = this.currentValues.tongueExtend || 0;
      const bx = this.currentValues.tongueBendX || 0;
      const by = this.currentValues.tongueBendY || 0;

      if (ext > 0.08) {
        this.customTongueGroup.visible = true;
        // Extend forward out of the mouth and steer toward target direction
        this.customTongueMesh.scale.set(
          0.95 + ext * 0.22,
          0.85 + ext * 0.18,
          0.45 + ext * 1.15
        );
        this.customTongueMesh.position.set(
          bx * 0.014 * ext,
          -0.004 - by * 0.011 * ext,
          0.008 + ext * 0.022
        );
        this.customTongueMesh.rotation.set(
          0.18 + by * 0.48,  // tilt down (+y) or curl up (-y)
          bx * 0.55,         // sweep left / right!
          -bx * 0.15
        );
      } else {
        this.customTongueGroup.visible = false;
      }
    }

    // Project 3D mouth center to normalized 2D screen coordinates for crisp guide arrows!
    if (this.mouthWorldBase && this.camera) {
      const proj = this.mouthWorldBase.clone().project(this.camera);
      this.mouthScreenPos.x = (proj.x + 1) * 0.5;
      this.mouthScreenPos.y = (1 - proj.y) * 0.5;
    }
  }

  _drawGuideOverlay() {
    const ctx = this.guideCtx;
    const w = this.guideCanvas.width;
    const h = this.guideCanvas.height;
    const dpr = w / Math.max(1, this.guideCanvas.clientWidth);

    ctx.clearRect(0, 0, w, h);

    if (this.showLines && this.isMoveMode && this.item?.guide && this.modelReady) {
      const mx = w * this.mouthScreenPos.x;
      const my = h * Math.min(0.78, Math.max(0.45, this.mouthScreenPos.y + 0.055));
      const pulse = Math.sin(this.clockSec * 5) * 4 * dpr;
      const guide = this.item.guide;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (guide === 'openWide' || guide === 'lipPop') {
        this._drawArrow(ctx, mx, my - 22 * dpr - pulse, mx, my - 46 * dpr - pulse, '#10b981', dpr);
        this._drawArrow(ctx, mx, my + 22 * dpr + pulse, mx, my + 46 * dpr + pulse, '#10b981', dpr);
      } else if (guide === 'smile') {
        this._drawArrow(ctx, mx - 38 * dpr - pulse, my, mx - 64 * dpr - pulse, my, '#f59e0b', dpr);
        this._drawArrow(ctx, mx + 38 * dpr + pulse, my, mx + 64 * dpr + pulse, my, '#f59e0b', dpr);
      } else if (guide === 'kiss') {
        this._drawArrow(ctx, mx - 62 * dpr + pulse, my, mx - 36 * dpr + pulse, my, '#ec4899', dpr);
        this._drawArrow(ctx, mx + 62 * dpr - pulse, my, mx + 36 * dpr - pulse, my, '#ec4899', dpr);
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.72)';
        ctx.lineWidth = 3 * dpr;
        ctx.beginPath();
        ctx.arc(mx, my, 24 * dpr + pulse * 0.4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (guide === 'tongueOut' || guide === 'tongueDown') {
        this._drawArrow(ctx, mx, my + 24 * dpr + pulse, mx, my + 52 * dpr + pulse, '#ec4899', dpr);
      } else if (guide === 'tongueUp') {
        this._drawArrow(ctx, mx, my - 12 * dpr - pulse, mx, my - 42 * dpr - pulse, '#ec4899', dpr);
      } else if (guide === 'tongueWiggle') {
        this._drawArrow(ctx, mx - 24 * dpr - pulse, my + 18 * dpr, mx - 58 * dpr - pulse, my + 18 * dpr, '#ec4899', dpr);
        this._drawArrow(ctx, mx + 24 * dpr + pulse, my + 18 * dpr, mx + 58 * dpr + pulse, my + 18 * dpr, '#ec4899', dpr);
      } else if (guide === 'cheekPuff') {
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 3.5 * dpr;
        ctx.beginPath();
        ctx.arc(mx - 62 * dpr - pulse * 0.6, my - 16 * dpr, 22 * dpr, Math.PI * 0.68, Math.PI * 1.32);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(mx + 62 * dpr + pulse * 0.6, my - 16 * dpr, 22 * dpr, -Math.PI * 0.32, Math.PI * 0.32);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Slow-motion badge
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
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
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
