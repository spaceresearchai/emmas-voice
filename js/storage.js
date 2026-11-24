// ============================================================================
// Persistent Tablet Storage (localStorage for settings + IndexedDB for media)
// ============================================================================

const SETTINGS_KEY = 'emmas_voice_settings_v1';
const CUSTOM_WORDS_KEY = 'emmas_voice_custom_words_v1';
const PROGRESS_KEY = 'emmas_voice_progress_v1';

const DB_NAME = 'EmmasVoiceMediaDB';
const DB_VERSION = 1;
const STORE_VIDEOS = 'wordVideos';

export const DEFAULT_SETTINGS = {
  practiceMode: 'moves',      // 'moves' (default) | 'words'
  avatarModel: 'realistic',   // 'realistic' (Avaturn) | 'friendly' (Brunette)
  childName: 'Emma',
  detectionMode: 'encourage', // 'encourage' | 'match'
  sensitivity: 6,             // 1..10 (higher = easier to trigger)
  cooldownSec: 2.6,           // 1.2..5.0
  lineStyle: 'clean',         // 'clean' | 'detailed' | 'minimal'
  calmMode: false,
  childLock: true,
  language: 'en-US',
  voiceEngine: 'neural',      // 'neural' (Piper VITS WASM) | 'browser'
  neuralVoiceId: 'en_US-kristin-medium',
  voiceURI: '',
  speechRate: 1.04,
  chimeEnabled: true,
  praiseEnabled: false,
  coachLines: true,
  coachLoop: true,
  coachSlow: false,
  voiceMigratedV5: true,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    // Migrate earlier sleepy default voice (amy @ 0.85x) to cheerful bright default (kristin @ 1.04x)
    if (!parsed.voiceMigratedV5) {
      if (!parsed.neuralVoiceId || parsed.neuralVoiceId === 'en_US-amy-medium') {
        parsed.neuralVoiceId = 'en_US-kristin-medium';
      }
      if (parsed.speechRate <= 0.92) {
        parsed.speechRate = 1.04;
      }
      parsed.voiceMigratedV5 = true;
      saveSettings(parsed);
    }
    return parsed;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Could not save settings:', err);
  }
}

export function loadCustomWords() {
  try {
    const raw = localStorage.getItem(CUSTOM_WORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomWords(words) {
  try {
    localStorage.setItem(CUSTOM_WORDS_KEY, JSON.stringify(words));
  } catch (err) {
    console.warn('Could not save custom words:', err);
  }
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : { totalStars: 0, byWord: {} };
  } catch {
    return { totalStars: 0, byWord: {} };
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch (err) {
    console.warn('Could not save progress:', err);
  }
}

// IndexedDB for Parent-Recorded / Uploaded Real Videos per Word
function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_VIDEOS)) {
        db.createObjectStore(STORE_VIDEOS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveWordVideo(wordId, blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VIDEOS, 'readwrite');
    tx.objectStore(STORE_VIDEOS).put(blob, wordId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getWordVideo(wordId) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_VIDEOS, 'readonly');
      const req = tx.objectStore(STORE_VIDEOS).get(wordId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteWordVideo(wordId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VIDEOS, 'readwrite');
    tx.objectStore(STORE_VIDEOS).delete(wordId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listSavedVideoWordIds() {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_VIDEOS, 'readonly');
      const req = tx.objectStore(STORE_VIDEOS).getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}
