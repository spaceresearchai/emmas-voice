// ============================================================================
// Emma's Voice — Main App Orchestration, Parent Studio & Video Recorder
// ============================================================================

import { DEFAULT_WORDS, SHAPE_LABELS, buildVisemeTimeline } from './words.js';
import {
  loadSettings,
  saveSettings,
  loadCustomWords,
  saveCustomWords,
  loadProgress,
  saveProgress,
  saveWordVideo,
  getWordVideo,
  deleteWordVideo,
  listSavedVideoWordIds,
} from './storage.js';
import { SpeechEngine } from './speech.js';
import { ArticulationCoach } from './coach.js';
import { LipTracker } from './lip-tracker.js?v=2';
import { CelebrationOverlay } from './celebration.js';

const LINE_STYLES = ['clean', 'detailed', 'minimal'];
const LINE_STYLE_NAMES = {
  clean: 'Lip Lines',
  detailed: 'Full Mesh',
  minimal: 'Soft Halo',
};

const state = {
  settings: loadSettings(),
  customWords: loadCustomWords(),
  progress: loadProgress(),
  savedVideoIds: new Set(),
  activeCategory: 'all',
  activeWordId: 'mama',
  bannerTimer: null,
  // Video recorder modal state
  recWordId: null,
  recStream: null,
  mediaRecorder: null,
  recChunks: [],
  recBlob: null,
  recPreviewUrl: null,
  recTimerInterval: null,
  recStartTs: 0,
  wasCameraRunningBeforeRec: false,
};

// DOM References
const dom = {
  appTitle: document.getElementById('appTitle'),
  trackingStatusPill: document.getElementById('trackingStatusPill'),
  trackingStatusText: document.getElementById('trackingStatusText'),
  totalStarsValue: document.getElementById('totalStarsValue'),
  calmModeQuickBtn: document.getElementById('calmModeQuickBtn'),
  parentSettingsBtn: document.getElementById('parentSettingsBtn'),
  parentBtnLabel: document.getElementById('parentBtnLabel'),

  cameraVideo: document.getElementById('cameraVideo'),
  trackingCanvas: document.getElementById('trackingCanvas'),
  celebrationCanvas: document.getElementById('celebrationCanvas'),
  viewportHudTop: document.getElementById('viewportHudTop'),
  trackingLegend: document.getElementById('trackingLegend'),
  liveMetricsText: document.getElementById('liveMetricsText'),
  viewportControls: document.getElementById('viewportControls'),
  toggleLinesStyleBtn: document.getElementById('toggleLinesStyleBtn'),
  linesStyleLabel: document.getElementById('linesStyleLabel'),
  recalibrateBtn: document.getElementById('recalibrateBtn'),
  demoSpeakTriggerBtn: document.getElementById('demoSpeakTriggerBtn'),
  stopCameraBtn: document.getElementById('stopCameraBtn'),

  reinforcementBanner: document.getElementById('reinforcementBanner'),
  reinforcementEmoji: document.getElementById('reinforcementEmoji'),
  reinforcementWord: document.getElementById('reinforcementWord'),
  reinforcementSub: document.getElementById('reinforcementSub'),

  cameraStartOverlay: document.getElementById('cameraStartOverlay'),
  startCameraBtn: document.getElementById('startCameraBtn'),
  startDemoBtn: document.getElementById('startDemoBtn'),
  cameraErrorMsg: document.getElementById('cameraErrorMsg'),
  modelLoadingToast: document.getElementById('modelLoadingToast'),
  modelLoadingText: document.getElementById('modelLoadingText'),

  activeWordSpeakBtn: document.getElementById('activeWordSpeakBtn'),
  activeWordEmoji: document.getElementById('activeWordEmoji'),
  activeWordText: document.getElementById('activeWordText'),
  activeWordCue: document.getElementById('activeWordCue'),
  activeWordStars: document.getElementById('activeWordStars'),
  lipStateBadge: document.getElementById('lipStateBadge'),
  lipMeterFill: document.getElementById('lipMeterFill'),
  lipThresholdMarker: document.getElementById('lipThresholdMarker'),
  lipShapeHint: document.getElementById('lipShapeHint'),

  coachCanvas: document.getElementById('coachCanvas'),
  parentVideoPlayer: document.getElementById('parentVideoPlayer'),
  syllableStrip: document.getElementById('syllableStrip'),
  coachModeBadge: document.getElementById('coachModeBadge'),
  coachLinesToggle: document.getElementById('coachLinesToggle'),
  coachPlayBtn: document.getElementById('coachPlayBtn'),
  coachSlowBtn: document.getElementById('coachSlowBtn'),
  coachLoopBtn: document.getElementById('coachLoopBtn'),
  quickRecordVideoBtn: document.getElementById('quickRecordVideoBtn'),

  openAddWordBtn: document.getElementById('openAddWordBtn'),
  categoryTabs: document.getElementById('categoryTabs'),
  wordGrid: document.getElementById('wordGrid'),

  // Parent Modal
  parentModalBackdrop: document.getElementById('parentModalBackdrop'),
  closeParentModalBtn: document.getElementById('closeParentModalBtn'),
  detectionModeSelect: document.getElementById('detectionModeSelect'),
  sensitivityRange: document.getElementById('sensitivityRange'),
  sensitivityValueLabel: document.getElementById('sensitivityValueLabel'),
  cooldownRange: document.getElementById('cooldownRange'),
  cooldownValueLabel: document.getElementById('cooldownValueLabel'),
  lineStyleSelect: document.getElementById('lineStyleSelect'),
  calmModeSetting: document.getElementById('calmModeSetting'),
  childLockSetting: document.getElementById('childLockSetting'),

  childNameInput: document.getElementById('childNameInput'),
  languageSelect: document.getElementById('languageSelect'),
  voiceSelect: document.getElementById('voiceSelect'),
  speechRateRange: document.getElementById('speechRateRange'),
  speechRateLabel: document.getElementById('speechRateLabel'),
  chimeSetting: document.getElementById('chimeSetting'),
  praiseSetting: document.getElementById('praiseSetting'),
  testVoiceBtn: document.getElementById('testVoiceBtn'),

  addWordForm: document.getElementById('addWordForm'),
  newWordText: document.getElementById('newWordText'),
  newWordEmoji: document.getElementById('newWordEmoji'),
  newWordShape: document.getElementById('newWordShape'),
  newWordCategory: document.getElementById('newWordCategory'),
  newWordCue: document.getElementById('newWordCue'),
  manageWordsList: document.getElementById('manageWordsList'),

  statTotalAttempts: document.getElementById('statTotalAttempts'),
  statWordsPracticed: document.getElementById('statWordsPracticed'),
  statCustomVideos: document.getElementById('statCustomVideos'),
  progressWordList: document.getElementById('progressWordList'),
  resetProgressBtn: document.getElementById('resetProgressBtn'),

  // Video Recorder Modal
  recorderModalBackdrop: document.getElementById('recorderModalBackdrop'),
  recorderModalTitle: document.getElementById('recorderModalTitle'),
  closeRecorderModalBtn: document.getElementById('closeRecorderModalBtn'),
  recorderPreviewVideo: document.getElementById('recorderPreviewVideo'),
  recorderCountdown: document.getElementById('recorderCountdown'),
  recIndicator: document.getElementById('recIndicator'),
  recTimer: document.getElementById('recTimer'),
  startRecBtn: document.getElementById('startRecBtn'),
  stopRecBtn: document.getElementById('stopRecBtn'),
  saveRecBtn: document.getElementById('saveRecBtn'),
  retakeRecBtn: document.getElementById('retakeRecBtn'),
  uploadVideoInput: document.getElementById('uploadVideoInput'),
  recorderErrorMsg: document.getElementById('recorderErrorMsg'),
};

// Core Engines
const speech = new SpeechEngine();
const celebration = new CelebrationOverlay(dom.celebrationCanvas);
const coach = new ArticulationCoach({
  canvas: dom.coachCanvas,
  videoEl: dom.parentVideoPlayer,
  syllableStripEl: dom.syllableStrip,
  modeBadgeEl: dom.coachModeBadge,
});

const tracker = new LipTracker({
  videoEl: dom.cameraVideo,
  canvasEl: dom.trackingCanvas,
  onStatusChange: (statusState, label) => {
    dom.trackingStatusPill.dataset.state = statusState;
    dom.trackingStatusText.textContent = label;
  },
  onMetrics: (m) => {
    const pct = Math.min(100, Math.round(m.score * 100));
    const thrPct = Math.min(95, Math.max(10, Math.round(m.threshold * 100)));
    dom.lipMeterFill.style.width = `${pct}%`;
    dom.lipThresholdMarker.style.left = `${thrPct}%`;
    dom.liveMetricsText.textContent = m.faceFound ? `Open ${m.openPct}%` : 'No face';

    dom.lipStateBadge.classList.remove('moving', 'triggered');
    if (!m.faceFound) {
      dom.lipStateBadge.textContent = 'Find face';
    } else if (m.state === 'reward') {
      dom.lipStateBadge.textContent = 'Spoken! ★';
      dom.lipStateBadge.classList.add('triggered');
    } else if (m.state === 'moving') {
      dom.lipStateBadge.textContent = 'Lips moving!';
      dom.lipStateBadge.classList.add('moving');
    } else if (m.inCooldown) {
      dom.lipStateBadge.textContent = 'Ready soon…';
    } else {
      dom.lipStateBadge.textContent = 'Watching';
    }
  },
  onLipTrigger: () => {
    handleLipReinforcement();
  },
  onModelLoading: (isLoading, msg) => {
    dom.modelLoadingToast.classList.toggle('hidden', !isLoading);
    if (msg) dom.modelLoadingText.textContent = msg;
  },
});

// ============================================================================
// Helpers
// ============================================================================

function getAllWords() {
  return [...DEFAULT_WORDS, ...state.customWords];
}

function getActiveWord() {
  return getAllWords().find((w) => w.id === state.activeWordId) || DEFAULT_WORDS[0];
}

function formatStars(count) {
  const filled = Math.min(5, count || 0);
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

function applySettingsToUI() {
  const s = state.settings;
  const displayName = (s.childName || 'Emma').trim();
  dom.appTitle.textContent = `${displayName}'s Voice`;
  document.title = `${displayName}'s Voice — Lip-Tracking Speech Companion`;

  document.body.classList.toggle('calm-mode', Boolean(s.calmMode));
  dom.calmModeQuickBtn.setAttribute('aria-pressed', String(Boolean(s.calmMode)));
  dom.parentBtnLabel.textContent = s.childLock ? 'Parent (Hold)' : 'Parent';

  // Sync tracker & speech & coach
  tracker.updateSettings({
    detectionMode: s.detectionMode,
    sensitivity: s.sensitivity,
    cooldownSec: s.cooldownSec,
    lineStyle: s.lineStyle,
    targetShape: getActiveWord().shape,
  });
  dom.linesStyleLabel.textContent = LINE_STYLE_NAMES[s.lineStyle] || 'Lip Lines';

  speech.updateConfig(s);

  dom.coachLinesToggle.checked = Boolean(s.coachLines);
  coach.setShowLines(Boolean(s.coachLines));
  dom.coachSlowBtn.classList.toggle('active', Boolean(s.coachSlow));
  dom.coachSlowBtn.setAttribute('aria-pressed', String(Boolean(s.coachSlow)));
  coach.setSlowMode(Boolean(s.coachSlow));
  dom.coachLoopBtn.classList.toggle('active', Boolean(s.coachLoop));
  dom.coachLoopBtn.setAttribute('aria-pressed', String(Boolean(s.coachLoop)));
  coach.setLoop(Boolean(s.coachLoop));

  // Sync Parent Studio form controls
  dom.detectionModeSelect.value = s.detectionMode;
  dom.sensitivityRange.value = String(s.sensitivity);
  const sensDesc = s.sensitivity >= 8 ? 'Very Gentle' : s.sensitivity >= 5 ? 'Medium' : 'Focused';
  dom.sensitivityValueLabel.textContent = `${sensDesc} (${s.sensitivity}/10)`;
  dom.cooldownRange.value = String(s.cooldownSec);
  dom.cooldownValueLabel.textContent = `${Number(s.cooldownSec).toFixed(1)}s`;
  dom.lineStyleSelect.value = s.lineStyle;
  dom.calmModeSetting.checked = Boolean(s.calmMode);
  dom.childLockSetting.checked = Boolean(s.childLock);

  dom.childNameInput.value = s.childName;
  dom.languageSelect.value = s.language;
  dom.speechRateRange.value = String(s.speechRate);
  dom.speechRateLabel.textContent = `${Number(s.speechRate).toFixed(2)}×`;
  dom.chimeSetting.checked = Boolean(s.chimeEnabled);
  dom.praiseSetting.checked = Boolean(s.praiseEnabled);

  // Update meter threshold preview
  const thr = Math.round((0.72 - s.sensitivity * 0.05) * 100);
  dom.lipThresholdMarker.style.left = `${Math.min(95, Math.max(10, thr))}%`;

  updateProgressUI();
}

function updateProgressUI() {
  dom.totalStarsValue.textContent = String(state.progress.totalStars || 0);
  const activeWord = getActiveWord();
  const count = state.progress.byWord[activeWord.id] || 0;
  dom.activeWordStars.textContent = formatStars(count);

  // Parent studio stats
  dom.statTotalAttempts.textContent = String(state.progress.totalStars || 0);
  const practicedCount = Object.values(state.progress.byWord).filter((n) => n > 0).length;
  dom.statWordsPracticed.textContent = String(practicedCount);
  dom.statCustomVideos.textContent = String(state.savedVideoIds.size);

  dom.progressWordList.innerHTML = '';
  const practicedEntries = getAllWords()
    .map((w) => ({ word: w, count: state.progress.byWord[w.id] || 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  if (practicedEntries.length === 0) {
    dom.progressWordList.innerHTML =
      '<p class="setting-help">No lip rewards recorded yet. Start the camera (or Demo Camera) and move lips to earn stars!</p>';
  } else {
    practicedEntries.forEach(({ word, count: c }) => {
      const row = document.createElement('div');
      row.className = 'progress-row';
      row.innerHTML = `
        <span>${word.emoji} ${escapeHtml(word.text)}</span>
        <span style="color:#d97706">${formatStars(c)} (${c})</span>
      `;
      dom.progressWordList.appendChild(row);
    });
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// ============================================================================
// Word Selection & Reinforcement
// ============================================================================

async function selectWord(wordId, { speakModel = true } = {}) {
  state.activeWordId = wordId;
  const word = getActiveWord();

  dom.activeWordEmoji.textContent = word.emoji;
  dom.activeWordText.textContent = word.text;
  dom.activeWordCue.textContent = word.cue;
  dom.lipShapeHint.textContent = `Goal: ${SHAPE_LABELS[word.shape] || 'Move lips'}`;
  tracker.updateSettings({ targetShape: word.shape });

  renderWordGrid();
  updateProgressUI();

  const videoBlob = state.savedVideoIds.has(word.id) ? await getWordVideo(word.id) : null;
  coach.setWord(word, videoBlob);

  if (speakModel) {
    speech.speakWord(word.text, { isReward: false, slow: state.settings.coachSlow });
  }
}

function handleLipReinforcement() {
  const word = getActiveWord();

  // 1. Immediately say the target word out loud!
  speech.speakWord(word.text, { isReward: true });

  // 2. Increment star progress
  state.progress.totalStars = (state.progress.totalStars || 0) + 1;
  state.progress.byWord[word.id] = (state.progress.byWord[word.id] || 0) + 1;
  saveProgress(state.progress);
  updateProgressUI();
  renderWordGrid();

  // 3. Gentle celebration particles + joyful banner
  celebration.burst({ calmMode: state.settings.calmMode });

  dom.reinforcementEmoji.textContent = word.emoji;
  dom.reinforcementWord.textContent = `${word.text}!`;
  const childName = (state.settings.childName || 'Emma').trim();
  dom.reinforcementSub.textContent = `Way to go, ${childName}! ★`;
  dom.reinforcementBanner.classList.add('show');
  dom.activeWordSpeakBtn.classList.add('pulse');

  clearTimeout(state.bannerTimer);
  state.bannerTimer = setTimeout(() => {
    dom.reinforcementBanner.classList.remove('show');
    dom.activeWordSpeakBtn.classList.remove('pulse');
  }, 1900);
}

function renderWordGrid() {
  const all = getAllWords();
  const filtered =
    state.activeCategory === 'all'
      ? all
      : state.activeCategory === 'custom'
        ? all.filter((w) => w.category === 'custom' || w.isCustom)
        : all.filter((w) => w.category === state.activeCategory);

  dom.wordGrid.innerHTML = '';

  if (filtered.length === 0) {
    dom.wordGrid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:24px 12px;color:#5a6d85;font-weight:800;">
        No custom words yet. Tap <strong>+ Add Word</strong> to add Emma's favorite words!
      </div>
    `;
    return;
  }

  filtered.forEach((word) => {
    const count = state.progress.byWord[word.id] || 0;
    const hasVideo = state.savedVideoIds.has(word.id);
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = `word-tile${word.id === state.activeWordId ? ' selected' : ''}`;
    tile.setAttribute('role', 'option');
    tile.setAttribute('aria-selected', String(word.id === state.activeWordId));
    tile.innerHTML = `
      ${hasVideo ? '<span class="video-dot" title="Parent video saved">🎥</span>' : ''}
      <span class="word-tile-emoji">${word.emoji}</span>
      <span class="word-tile-label">${escapeHtml(word.text)}</span>
      <span class="word-tile-meta">
        <span>${SHAPE_LABELS[word.shape] || 'Lip cue'}</span>
      </span>
      <span class="word-tile-stars">${formatStars(count)}</span>
    `;
    tile.addEventListener('click', () => {
      speech.unlockAudio();
      selectWord(word.id, { speakModel: true });
    });
    dom.wordGrid.appendChild(tile);
  });
}

function renderManageWordsList() {
  dom.manageWordsList.innerHTML = '';
  getAllWords().forEach((word) => {
    const hasVideo = state.savedVideoIds.has(word.id);
    const row = document.createElement('div');
    row.className = 'manage-word-row';
    row.innerHTML = `
      <div class="manage-word-info">
        <span class="manage-word-emoji">${word.emoji}</span>
        <div>
          <div class="manage-word-name">${escapeHtml(word.text)}</div>
          <div class="manage-word-status">${hasVideo ? '🎥 Real parent video saved' : '🤖 Built-in articulation coach'}</div>
        </div>
      </div>
      <div class="manage-word-btns">
        <button class="small-btn primary" data-action="record" type="button">🎥 ${hasVideo ? 'Replace' : 'Record'}</button>
        ${hasVideo ? '<button class="small-btn danger" data-action="remove-video" type="button">Clear Video</button>' : ''}
        ${word.isCustom ? '<button class="small-btn danger" data-action="delete-word" type="button">Delete</button>' : ''}
      </div>
    `;

    row.querySelector('[data-action="record"]').addEventListener('click', () => {
      openRecorderModal(word.id);
    });

    const removeVideoBtn = row.querySelector('[data-action="remove-video"]');
    if (removeVideoBtn) {
      removeVideoBtn.addEventListener('click', async () => {
        await deleteWordVideo(word.id);
        state.savedVideoIds.delete(word.id);
        renderManageWordsList();
        renderWordGrid();
        updateProgressUI();
        if (state.activeWordId === word.id) {
          selectWord(word.id, { speakModel: false });
        }
      });
    }

    const delWordBtn = row.querySelector('[data-action="delete-word"]');
    if (delWordBtn) {
      delWordBtn.addEventListener('click', async () => {
        state.customWords = state.customWords.filter((w) => w.id !== word.id);
        saveCustomWords(state.customWords);
        if (state.savedVideoIds.has(word.id)) {
          await deleteWordVideo(word.id);
          state.savedVideoIds.delete(word.id);
        }
        if (state.activeWordId === word.id) {
          selectWord(DEFAULT_WORDS[0].id, { speakModel: false });
        }
        renderWordGrid();
        renderManageWordsList();
        updateProgressUI();
      });
    }

    dom.manageWordsList.appendChild(row);
  });
}

// ============================================================================
// Camera & Demo Lifecycle
// ============================================================================

async function enterLiveCamera() {
  speech.unlockAudio();
  dom.cameraErrorMsg.classList.add('hidden');
  dom.startCameraBtn.disabled = true;
  try {
    await tracker.startCamera();
    dom.cameraStartOverlay.classList.add('hidden');
    dom.viewportHudTop.classList.remove('hidden');
    dom.demoSpeakTriggerBtn.classList.add('hidden');
  } catch (err) {
    dom.cameraErrorMsg.textContent = err.message;
    dom.cameraErrorMsg.classList.remove('hidden');
  } finally {
    dom.startCameraBtn.disabled = false;
  }
}

function enterDemoCamera() {
  speech.unlockAudio();
  dom.cameraErrorMsg.classList.add('hidden');
  tracker.startDemo();
  dom.cameraStartOverlay.classList.add('hidden');
  dom.viewportHudTop.classList.remove('hidden');
  dom.demoSpeakTriggerBtn.classList.remove('hidden');
}

function pauseCamera() {
  tracker.stop();
  dom.cameraStartOverlay.classList.remove('hidden');
  dom.viewportHudTop.classList.add('hidden');
  dom.lipMeterFill.style.width = '0%';
  dom.lipStateBadge.textContent = 'Waiting';
  dom.lipStateBadge.classList.remove('moving', 'triggered');
}

// ============================================================================
// Parent Settings Modal & Child Lock
// ============================================================================

function openParentModal(initialTab = 'detection') {
  renderManageWordsList();
  updateProgressUI();
  switchParentTab(initialTab);
  dom.parentModalBackdrop.classList.remove('hidden');
}

function closeParentModal() {
  dom.parentModalBackdrop.classList.add('hidden');
}

function switchParentTab(tabName) {
  document.querySelectorAll('.modal-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });
}

function setupChildLockButton() {
  let holdTimeout = null;
  let heldEnough = false;

  const startHold = (e) => {
    e.preventDefault();
    speech.unlockAudio();
    if (!state.settings.childLock) {
      openParentModal('detection');
      return;
    }
    heldEnough = false;
    dom.parentSettingsBtn.classList.add('holding');
    holdTimeout = setTimeout(() => {
      heldEnough = true;
      dom.parentSettingsBtn.classList.remove('holding');
      openParentModal('detection');
    }, 1350);
  };

  const cancelHold = () => {
    if (holdTimeout) {
      clearTimeout(holdTimeout);
      holdTimeout = null;
    }
    dom.parentSettingsBtn.classList.remove('holding');
    if (state.settings.childLock && !heldEnough) {
      const oldText = dom.parentBtnLabel.textContent;
      dom.parentBtnLabel.textContent = 'Hold 1.5s';
      setTimeout(() => {
        dom.parentBtnLabel.textContent = state.settings.childLock ? 'Parent (Hold)' : 'Parent';
      }, 1100);
    }
  };

  dom.parentSettingsBtn.addEventListener('pointerdown', startHold);
  dom.parentSettingsBtn.addEventListener('pointerup', cancelHold);
  dom.parentSettingsBtn.addEventListener('pointerleave', cancelHold);
  dom.parentSettingsBtn.addEventListener('pointercancel', cancelHold);
}

// ============================================================================
// Parent Real Video Recorder Modal
// ============================================================================

async function openRecorderModal(wordId) {
  const word = getAllWords().find((w) => w.id === wordId) || getActiveWord();
  state.recWordId = word.id;
  state.recBlob = null;

  dom.recorderModalTitle.textContent = `Record Video for "${word.text}"`;
  dom.recorderErrorMsg.classList.add('hidden');
  dom.startRecBtn.classList.remove('hidden');
  dom.stopRecBtn.classList.add('hidden');
  dom.saveRecBtn.classList.add('hidden');
  dom.retakeRecBtn.classList.add('hidden');
  dom.recorderCountdown.classList.add('hidden');
  dom.recIndicator.classList.add('hidden');
  dom.recorderPreviewVideo.classList.remove('playback-mode');
  dom.recorderPreviewVideo.muted = true;
  dom.recorderPreviewVideo.loop = false;

  // Pause main camera temporarily so mobile/tablet Safari allows camera+mic capture
  state.wasCameraRunningBeforeRec = tracker.mode === 'camera';
  if (state.wasCameraRunningBeforeRec) {
    tracker.stop();
  }

  dom.recorderModalBackdrop.classList.remove('hidden');
  await startRecorderCameraPreview();
}

async function startRecorderCameraPreview() {
  cleanupRecorderStream();
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera recording is not supported in this browser. You can still upload a video file below.');
    }
    state.recStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: true,
    });
    dom.recorderPreviewVideo.srcObject = state.recStream;
    dom.recorderPreviewVideo.src = '';
    dom.recorderPreviewVideo.classList.remove('playback-mode');
    await dom.recorderPreviewVideo.play();
  } catch (err) {
    dom.recorderErrorMsg.textContent = `Camera unavailable for recording (${err.message}). You can still upload any MP4/WebM video file!`;
    dom.recorderErrorMsg.classList.remove('hidden');
    dom.startRecBtn.classList.add('hidden');
  }
}

function cleanupRecorderStream() {
  clearInterval(state.recTimerInterval);
  if (state.recStream) {
    state.recStream.getTracks().forEach((t) => t.stop());
    state.recStream = null;
  }
  if (state.recPreviewUrl) {
    URL.revokeObjectURL(state.recPreviewUrl);
    state.recPreviewUrl = null;
  }
}

async function closeRecorderModal() {
  if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
    state.mediaRecorder.stop();
  }
  cleanupRecorderStream();
  dom.recorderPreviewVideo.srcObject = null;
  dom.recorderPreviewVideo.removeAttribute('src');
  dom.recorderModalBackdrop.classList.add('hidden');

  if (state.wasCameraRunningBeforeRec) {
    state.wasCameraRunningBeforeRec = false;
    enterLiveCamera();
  }
}

function beginCountdownAndRecord() {
  if (!state.recStream) return;
  dom.startRecBtn.classList.add('hidden');
  dom.recorderCountdown.classList.remove('hidden');

  let count = 3;
  dom.recorderCountdown.textContent = String(count);

  const cdInterval = setInterval(() => {
    count--;
    if (count > 0) {
      dom.recorderCountdown.textContent = String(count);
    } else {
      clearInterval(cdInterval);
      dom.recorderCountdown.classList.add('hidden');
      startMediaRecorder();
    }
  }, 650);
}

function startMediaRecorder() {
  state.recChunks = [];
  const mimeCandidates = ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'];
  const mimeType = mimeCandidates.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';

  try {
    state.mediaRecorder = mimeType
      ? new MediaRecorder(state.recStream, { mimeType })
      : new MediaRecorder(state.recStream);
  } catch (err) {
    dom.recorderErrorMsg.textContent = `Recording failed to start: ${err.message}`;
    dom.recorderErrorMsg.classList.remove('hidden');
    return;
  }

  state.mediaRecorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) state.recChunks.push(ev.data);
  };

  state.mediaRecorder.onstop = () => {
    clearInterval(state.recTimerInterval);
    dom.recIndicator.classList.add('hidden');
    dom.stopRecBtn.classList.add('hidden');

    const blob = new Blob(state.recChunks, { type: state.mediaRecorder.mimeType || 'video/webm' });
    state.recBlob = blob;
    showRecordedPreview(blob);
  };

  state.mediaRecorder.start();
  state.recStartTs = performance.now();
  dom.recIndicator.classList.remove('hidden');
  dom.stopRecBtn.classList.remove('hidden');

  state.recTimerInterval = setInterval(() => {
    const elapsed = (performance.now() - state.recStartTs) / 1000;
    dom.recTimer.textContent = `${elapsed.toFixed(1)}s`;
    if (elapsed >= 6.0 && state.mediaRecorder?.state === 'recording') {
      state.mediaRecorder.stop();
    }
  }, 100);
}

function showRecordedPreview(blob) {
  if (state.recPreviewUrl) URL.revokeObjectURL(state.recPreviewUrl);
  state.recPreviewUrl = URL.createObjectURL(blob);
  dom.recorderPreviewVideo.srcObject = null;
  dom.recorderPreviewVideo.src = state.recPreviewUrl;
  dom.recorderPreviewVideo.classList.add('playback-mode');
  dom.recorderPreviewVideo.muted = false;
  dom.recorderPreviewVideo.loop = true;
  dom.recorderPreviewVideo.play().catch(() => {});

  dom.saveRecBtn.classList.remove('hidden');
  dom.retakeRecBtn.classList.remove('hidden');
}

// ============================================================================
// Populate Voices Dropdown
// ============================================================================

function populateVoices(voices) {
  dom.voiceSelect.innerHTML = '';
  const autoOpt = document.createElement('option');
  autoOpt.value = '';
  autoOpt.textContent = 'Automatic warm voice';
  dom.voiceSelect.appendChild(autoOpt);

  const langPrefix = state.settings.language.split('-')[0].toLowerCase();
  const sorted = [...voices].sort((a, b) => {
    const aMatch = a.lang.toLowerCase().startsWith(langPrefix) ? 0 : 1;
    const bMatch = b.lang.toLowerCase().startsWith(langPrefix) ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    return a.name.localeCompare(b.name);
  });

  sorted.forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v.voiceURI;
    opt.textContent = `${v.name} (${v.lang})`;
    dom.voiceSelect.appendChild(opt);
  });

  dom.voiceSelect.value = state.settings.voiceURI || '';
}

// ============================================================================
// Event Wiring
// ============================================================================

function bindEvents() {
  // Camera start / demo / pause
  dom.startCameraBtn.addEventListener('click', enterLiveCamera);
  dom.startDemoBtn.addEventListener('click', enterDemoCamera);
  dom.stopCameraBtn.addEventListener('click', pauseCamera);

  dom.toggleLinesStyleBtn.addEventListener('click', () => {
    const idx = LINE_STYLES.indexOf(state.settings.lineStyle);
    const next = LINE_STYLES[(idx + 1) % LINE_STYLES.length];
    state.settings.lineStyle = next;
    saveSettings(state.settings);
    applySettingsToUI();
  });

  dom.recalibrateBtn.addEventListener('click', () => {
    tracker.recalibrate();
    dom.recalibrateBtn.style.transform = 'scale(0.92)';
    setTimeout(() => (dom.recalibrateBtn.style.transform = ''), 160);
  });

  dom.demoSpeakTriggerBtn.addEventListener('click', () => {
    speech.unlockAudio();
    tracker.triggerDemoLipMovement();
  });

  // Active word tap to hear
  dom.activeWordSpeakBtn.addEventListener('click', () => {
    speech.unlockAudio();
    const w = getActiveWord();
    speech.speakWord(w.text, { isReward: false, slow: state.settings.coachSlow });
    coach.playOnce(true);
  });

  // Top bar quick calm toggle
  dom.calmModeQuickBtn.addEventListener('click', () => {
    state.settings.calmMode = !state.settings.calmMode;
    saveSettings(state.settings);
    applySettingsToUI();
  });

  // Watch & Copy Coach controls
  dom.coachLinesToggle.addEventListener('change', (e) => {
    state.settings.coachLines = e.target.checked;
    saveSettings(state.settings);
    coach.setShowLines(e.target.checked);
  });

  dom.coachPlayBtn.addEventListener('click', () => {
    speech.unlockAudio();
    const w = getActiveWord();
    coach.playOnce(true);
    if (!coach.hasParentVideo) {
      speech.speakWord(w.text, { isReward: false, slow: state.settings.coachSlow });
    }
  });

  dom.coachSlowBtn.addEventListener('click', () => {
    state.settings.coachSlow = !state.settings.coachSlow;
    saveSettings(state.settings);
    applySettingsToUI();
  });

  dom.coachLoopBtn.addEventListener('click', () => {
    state.settings.coachLoop = !state.settings.coachLoop;
    saveSettings(state.settings);
    applySettingsToUI();
  });

  dom.quickRecordVideoBtn.addEventListener('click', () => {
    openRecorderModal(state.activeWordId);
  });

  dom.openAddWordBtn.addEventListener('click', () => {
    openParentModal('words');
    setTimeout(() => dom.newWordText.focus(), 100);
  });

  // Category filter tabs
  dom.categoryTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-chip');
    if (!btn) return;
    state.activeCategory = btn.dataset.cat;
    dom.categoryTabs.querySelectorAll('.cat-chip').forEach((c) => {
      const isActive = c === btn;
      c.classList.toggle('active', isActive);
      c.setAttribute('aria-selected', String(isActive));
    });
    renderWordGrid();
  });

  // Parent Modal
  setupChildLockButton();
  dom.closeParentModalBtn.addEventListener('click', closeParentModal);
  dom.parentModalBackdrop.addEventListener('click', (e) => {
    if (e.target === dom.parentModalBackdrop) closeParentModal();
  });

  document.querySelectorAll('.modal-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchParentTab(btn.dataset.tab));
  });

  // Parent Settings Listeners
  dom.detectionModeSelect.addEventListener('change', (e) => {
    state.settings.detectionMode = e.target.value;
    saveSettings(state.settings);
    applySettingsToUI();
  });

  dom.sensitivityRange.addEventListener('input', (e) => {
    state.settings.sensitivity = Number(e.target.value);
    saveSettings(state.settings);
    applySettingsToUI();
  });

  dom.cooldownRange.addEventListener('input', (e) => {
    state.settings.cooldownSec = Number(e.target.value);
    saveSettings(state.settings);
    applySettingsToUI();
  });

  dom.lineStyleSelect.addEventListener('change', (e) => {
    state.settings.lineStyle = e.target.value;
    saveSettings(state.settings);
    applySettingsToUI();
  });

  dom.calmModeSetting.addEventListener('change', (e) => {
    state.settings.calmMode = e.target.checked;
    saveSettings(state.settings);
    applySettingsToUI();
  });

  dom.childLockSetting.addEventListener('change', (e) => {
    state.settings.childLock = e.target.checked;
    saveSettings(state.settings);
    applySettingsToUI();
  });

  dom.childNameInput.addEventListener('input', (e) => {
    state.settings.childName = e.target.value || 'Emma';
    saveSettings(state.settings);
    applySettingsToUI();
  });

  dom.languageSelect.addEventListener('change', (e) => {
    state.settings.language = e.target.value;
    state.settings.voiceURI = '';
    saveSettings(state.settings);
    applySettingsToUI();
    populateVoices(speech.voices);
  });

  dom.voiceSelect.addEventListener('change', (e) => {
    state.settings.voiceURI = e.target.value;
    saveSettings(state.settings);
    applySettingsToUI();
  });

  dom.speechRateRange.addEventListener('input', (e) => {
    state.settings.speechRate = Number(e.target.value);
    saveSettings(state.settings);
    applySettingsToUI();
  });

  dom.chimeSetting.addEventListener('change', (e) => {
    state.settings.chimeEnabled = e.target.checked;
    saveSettings(state.settings);
    applySettingsToUI();
  });

  dom.praiseSetting.addEventListener('change', (e) => {
    state.settings.praiseEnabled = e.target.checked;
    saveSettings(state.settings);
    applySettingsToUI();
  });

  dom.testVoiceBtn.addEventListener('click', () => {
    speech.unlockAudio();
    speech.speakWord(getActiveWord().text, { isReward: true });
  });

  // Add Custom Word Form
  dom.addWordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = dom.newWordText.value.trim();
    if (!text) return;
    const emoji = (dom.newWordEmoji.value.trim() || '⭐').slice(0, 4);
    const shape = dom.newWordShape.value;
    const category = dom.newWordCategory.value;
    const { syllables, timeline } = buildVisemeTimeline(text);
    const cue =
      dom.newWordCue.value.trim() ||
      `Watch the lips and try saying "${text}"`;

    const newWord = {
      id: `custom-${Date.now()}`,
      text,
      emoji,
      category,
      shape,
      cue,
      syllables,
      timeline,
      isCustom: true,
    };

    state.customWords.push(newWord);
    saveCustomWords(state.customWords);

    dom.newWordText.value = '';
    dom.newWordCue.value = '';
    dom.newWordEmoji.value = '⭐';

    renderManageWordsList();
    selectWord(newWord.id, { speakModel: true });
  });

  // Reset Progress
  dom.resetProgressBtn.addEventListener('click', () => {
    state.progress = { totalStars: 0, byWord: {} };
    saveProgress(state.progress);
    updateProgressUI();
    renderWordGrid();
  });

  // Video Recorder Modal Actions
  dom.closeRecorderModalBtn.addEventListener('click', closeRecorderModal);
  dom.startRecBtn.addEventListener('click', beginCountdownAndRecord);
  dom.stopRecBtn.addEventListener('click', () => {
    if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
      state.mediaRecorder.stop();
    }
  });

  dom.retakeRecBtn.addEventListener('click', async () => {
    state.recBlob = null;
    dom.saveRecBtn.classList.add('hidden');
    dom.retakeRecBtn.classList.add('hidden');
    dom.startRecBtn.classList.remove('hidden');
    await startRecorderCameraPreview();
  });

  dom.saveRecBtn.addEventListener('click', async () => {
    if (!state.recBlob || !state.recWordId) return;
    await saveWordVideo(state.recWordId, state.recBlob);
    state.savedVideoIds.add(state.recWordId);
    renderWordGrid();
    renderManageWordsList();
    updateProgressUI();
    const targetId = state.recWordId;
    await closeRecorderModal();
    if (state.activeWordId === targetId) {
      selectWord(targetId, { speakModel: false });
    }
  });

  dom.uploadVideoInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    state.recBlob = file;
    dom.recorderErrorMsg.classList.add('hidden');
    dom.startRecBtn.classList.add('hidden');
    showRecordedPreview(file);
    e.target.value = '';
  });
}

// ============================================================================
// Bootstrap
// ============================================================================

async function init() {
  const savedIds = await listSavedVideoWordIds();
  state.savedVideoIds = new Set(savedIds);

  speech.onVoicesChanged(populateVoices);
  bindEvents();
  applySettingsToUI();
  await selectWord(state.activeWordId, { speakModel: false });
}

init();
