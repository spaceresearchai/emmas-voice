// ============================================================================
// Natural Human Neural Speech Engine (Piper VITS WASM) + Smart Fallback
// ============================================================================

const VITS_CDN = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web/+esm';

export const NEURAL_VOICES = [
  { id: 'en_US-amy-medium', label: 'Amy — Warm & Gentle (US English)', lang: 'en-US' },
  { id: 'en_US-kristin-medium', label: 'Kristin — Bright & Friendly (US English)', lang: 'en-US' },
  { id: 'en_US-hfc_female-medium', label: 'Hannah — Clear Studio (US English)', lang: 'en-US' },
  { id: 'en_US-lessac-medium', label: 'Lessac — Crisp Articulation (US English)', lang: 'en-US' },
  { id: 'en_GB-jenny_dioco-medium', label: 'Jenny — Warm British (UK English)', lang: 'en-GB' },
  { id: 'en_GB-cori-medium', label: 'Cori — Expressive British (UK English)', lang: 'en-GB' },
  { id: 'es_ES-sharvard-medium', label: 'Sharvard — Natural Spanish (Spain)', lang: 'es-ES' },
  { id: 'es_MX-ald-medium', label: 'Ald — Natural Spanish (LatAm)', lang: 'es-MX' },
  { id: 'pt_BR-faber-medium', label: 'Faber — Natural Portuguese (Brazil)', lang: 'pt-BR' },
  { id: 'fr_FR-siwis-medium', label: 'Siwis — Warm French (France)', lang: 'fr-FR' },
];

const DEFAULT_NEURAL_BY_LANG = {
  'en-US': 'en_US-amy-medium',
  'en-GB': 'en_GB-jenny_dioco-medium',
  'es-ES': 'es_ES-sharvard-medium',
  'es-MX': 'es_MX-ald-medium',
  'pt-BR': 'pt_BR-faber-medium',
  'fr-FR': 'fr_FR-siwis-medium',
};

export class SpeechEngine {
  constructor() {
    this.audioCtx = null;
    this.voices = [];
    this.language = 'en-US';
    this.voiceEngine = 'neural'; // 'neural' | 'browser'
    this.neuralVoiceId = 'en_US-amy-medium';
    this.voiceURI = '';
    this.rate = 0.92;
    this.chimeEnabled = true;
    this.praiseEnabled = false;
    this.calmMode = false;

    // Neural TTS state
    this.vitsMod = null;
    this.neuralStatus = 'idle'; // 'idle' | 'loading' | 'ready' | 'error'
    this.loadedVoiceId = null;
    this.audioCache = new Map(); // `${voiceId}::${text}` -> blobUrl
    this.currentAudio = null;
    this._predictQueue = Promise.resolve();
    this._speakSeq = 0;

    this._onVoicesChangedCallbacks = [];
    this._onNeuralStatusCallbacks = [];

    if ('speechSynthesis' in window) {
      this._refreshVoices();
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        this._refreshVoices();
      });
    }
  }

  onVoicesChanged(cb) {
    this._onVoicesChangedCallbacks.push(cb);
    if (this.voices.length > 0) cb(this.voices);
  }

  onNeuralStatus(cb) {
    this._onNeuralStatusCallbacks.push(cb);
    cb(this.neuralStatus, '');
  }

  _emitNeuralStatus(status, detail = '') {
    this.neuralStatus = status;
    this._onNeuralStatusCallbacks.forEach((cb) => cb(status, detail));
  }

  _refreshVoices() {
    if (!('speechSynthesis' in window)) return;
    this.voices = window.speechSynthesis.getVoices() || [];
    this._onVoicesChangedCallbacks.forEach((cb) => cb(this.voices));
  }

  unlockAudio() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass && !this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    } catch {
      // Ignore if AudioContext blocked
    }
  }

  updateConfig(cfg) {
    const prevVoice = this.neuralVoiceId;
    const prevEngine = this.voiceEngine;

    if (cfg.language !== undefined) this.language = cfg.language;
    if (cfg.voiceEngine !== undefined) this.voiceEngine = cfg.voiceEngine || 'neural';
    if (cfg.neuralVoiceId !== undefined) {
      this.neuralVoiceId = cfg.neuralVoiceId || DEFAULT_NEURAL_BY_LANG[this.language] || 'en_US-amy-medium';
    }
    if (cfg.voiceURI !== undefined) this.voiceURI = cfg.voiceURI;
    if (cfg.speechRate !== undefined) this.rate = Number(cfg.speechRate) || 0.92;
    if (cfg.chimeEnabled !== undefined) this.chimeEnabled = Boolean(cfg.chimeEnabled);
    if (cfg.praiseEnabled !== undefined) this.praiseEnabled = Boolean(cfg.praiseEnabled);
    if (cfg.calmMode !== undefined) this.calmMode = Boolean(cfg.calmMode);

    if (
      this.voiceEngine === 'neural' &&
      (prevVoice !== this.neuralVoiceId || prevEngine !== this.voiceEngine || this.neuralStatus === 'idle')
    ) {
      this.preloadNeuralVoice(this.neuralVoiceId);
    }
  }

  getDefaultNeuralVoiceForLang(lang) {
    return DEFAULT_NEURAL_BY_LANG[lang] || 'en_US-amy-medium';
  }

  async preloadNeuralVoice(voiceId = this.neuralVoiceId) {
    if (this.voiceEngine !== 'neural') return;
    if (this.loadedVoiceId === voiceId && this.neuralStatus === 'ready') return;

    const targetVoice = voiceId || 'en_US-amy-medium';
    this._emitNeuralStatus('loading', 'Loading natural AI voice…');

    try {
      if (!this.vitsMod) {
        this.vitsMod = await import(VITS_CDN);
      }

      // Check if already cached locally in OPFS
      let stored = [];
      try {
        if (typeof this.vitsMod.stored === 'function') {
          stored = await this.vitsMod.stored();
        }
      } catch {
        stored = [];
      }

      if (!stored.includes(targetVoice) && typeof this.vitsMod.download === 'function') {
        await this.vitsMod.download(targetVoice, (progress) => {
          if (progress && progress.total > 0) {
            const pct = Math.min(99, Math.round((progress.loaded / progress.total) * 100));
            this._emitNeuralStatus('loading', `Downloading natural voice (${pct}%)…`);
          }
        });
      }

      // If the user switched voice while this downloaded, abort updating ready flag
      if (this.neuralVoiceId !== targetVoice) return;

      this.loadedVoiceId = targetVoice;
      this._emitNeuralStatus('ready', 'Natural AI voice ready');
    } catch (err) {
      console.warn('Neural voice preload failed, falling back to browser voice:', err);
      this._emitNeuralStatus('error', 'Using device voice');
    }
  }

  playFelicitationFanfare({ celebratory = true } = {}) {
    if (!this.chimeEnabled) return;
    this.unlockAudio();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const notes = this.calmMode
      ? [523.25, 659.25]
      : celebratory
        ? [523.25, 659.25, 783.99, 1046.5]
        : [523.25, 659.25, 783.99];

    const peakGain = this.calmMode ? 0.08 : 0.13;
    const step = this.calmMode ? 0.12 : 0.085;

    notes.forEach((freq, i) => {
      const start = now + i * step;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = i === notes.length - 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + (i === notes.length - 1 ? 0.6 : 0.34));

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.65);
    });
  }

  speakFelicitation(praisePhrase, childName = 'Emma') {
    this.unlockAudio();
    this.playFelicitationFanfare({ celebratory: true });

    let text = `${praisePhrase}, ${childName}!`;
    if (this.language.startsWith('es')) {
      const esCheers = ['¡Muy bien', '¡Bravo', '¡Excelente', '¡Genial'];
      const pick = esCheers[Math.floor(Math.random() * esCheers.length)];
      text = `${pick}, ${childName}!`;
    } else if (this.language.startsWith('pt')) {
      text = `Muito bem, ${childName}!`;
    } else if (this.language.startsWith('fr')) {
      text = `Bravo, ${childName}!`;
    } else {
      const enCheers = ['Yay!', 'Bravo!', 'Woohoo!'];
      const cheer = enCheers[Math.floor(Math.random() * enCheers.length)];
      text = `${cheer} ${praisePhrase}, ${childName}!`;
    }

    this._speakText(text, {
      delayMs: this.chimeEnabled ? 230 : 0,
      playbackRate: Math.min(1.06, Math.max(0.86, this.rate + 0.04)),
    });
  }

  speakWord(wordText, { isReward = false, slow = false } = {}) {
    this.unlockAudio();
    if (isReward) {
      this.playFelicitationFanfare({ celebratory: false });
    }

    let text = wordText;
    if (isReward && this.praiseEnabled) {
      const praises = this.language.startsWith('es')
        ? ['¡Bien!', '¡Muy bien!']
        : this.language.startsWith('pt')
          ? ['Muito bem!', 'Isso!']
          : ['Yay!', 'Good job!'];
      const pick = praises[Math.floor(Math.random() * praises.length)];
      text = `${wordText}! ${pick}`;
    }

    const playbackRate = slow
      ? Math.max(0.74, this.rate * 0.82)
      : Math.max(0.82, Math.min(1.12, this.rate));

    this._speakText(text, {
      delayMs: isReward && this.chimeEnabled ? 190 : 0,
      playbackRate,
    });
  }

  _stopCurrentPlayback() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {
        // ignore
      }
      this.currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  _speakText(text, { delayMs = 0, playbackRate = 0.92 } = {}) {
    const seq = ++this._speakSeq;
    const useNeural =
      this.voiceEngine === 'neural' &&
      this.neuralStatus === 'ready' &&
      this.vitsMod &&
      this.loadedVoiceId === this.neuralVoiceId;

    const run = async () => {
      if (seq !== this._speakSeq) return;
      this._stopCurrentPlayback();

      if (useNeural) {
        try {
          const url = await this._synthesizeNeuralCached(text, this.neuralVoiceId, seq);
          if (!url || seq !== this._speakSeq) return;
          const audio = new Audio(url);
          audio.preservesPitch = true;
          audio.mozPreservesPitch = true;
          audio.webkitPreservesPitch = true;
          audio.playbackRate = playbackRate;
          audio.volume = 1.0;
          this.currentAudio = audio;
          await audio.play();
          return;
        } catch (err) {
          console.warn('Neural playback fallback to browser TTS:', err);
        }
      }

      // Seamless fallback to best available browser voice
      this._speakBrowserFallback(text, playbackRate);
    };

    if (delayMs > 0) {
      setTimeout(run, delayMs);
    } else {
      run();
    }
  }

  async _synthesizeNeuralCached(text, voiceId, seq) {
    const key = `${voiceId}::${text}`;
    if (this.audioCache.has(key)) {
      return this.audioCache.get(key);
    }

    // Serialize ONNX WASM predictions so concurrent taps never collide
    const job = this._predictQueue.then(async () => {
      if (seq !== this._speakSeq) return null;
      if (this.audioCache.has(key)) return this.audioCache.get(key);
      const wavBlob = await this.vitsMod.predict({ text, voiceId });
      const blobUrl = URL.createObjectURL(wavBlob);
      this.audioCache.set(key, blobUrl);
      return blobUrl;
    });

    this._predictQueue = job.catch(() => null);
    return job;
  }

  _speakBrowserFallback(text, rate) {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = this.language;
      utter.rate = Math.max(0.75, Math.min(1.08, rate));
      // Keep pitch natural (1.0) so device voices never sound artificial/squeaky
      utter.pitch = 1.0;
      utter.volume = 1.0;

      const chosen = this._pickBestBrowserVoice();
      if (chosen) utter.voice = chosen;
      window.speechSynthesis.speak(utter);
    } catch (err) {
      console.warn('Browser speech fallback failed:', err);
    }
  }

  _pickBestBrowserVoice() {
    if (this.voices.length === 0) this._refreshVoices();
    if (this.voiceURI) {
      const exact = this.voices.find((v) => v.voiceURI === this.voiceURI);
      if (exact) return exact;
    }

    const langPrefix = this.language.split('-')[0].toLowerCase();
    const matching = this.voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));
    const pool = matching.length > 0 ? matching : this.voices;
    if (pool.length === 0) return null;

    // Score voices: strongly prefer Natural/Neural/Enhanced/Premium/Google/Apple warm voices;
    // strongly penalize robotic espeak / festival / compact voices.
    const scoreVoice = (v) => {
      const n = (v.name || '').toLowerCase();
      let s = 0;
      if (n.includes('natural') || n.includes('neural')) s += 60;
      if (n.includes('enhanced') || n.includes('premium') || n.includes('siri')) s += 45;
      if (n.includes('google us english') || n.includes('google uk english female')) s += 40;
      if (n.includes('ava') || n.includes('samantha') || n.includes('aria') || n.includes('jenny') || n.includes('zoe')) s += 35;
      if (n.includes('female') || n.includes('monica') || n.includes('paulina') || n.includes('luciana')) s += 18;
      if (v.lang.toLowerCase() === this.language.toLowerCase()) s += 12;
      if (!v.localService) s += 10; // Cloud neural voices on Chrome/Edge sound far better than espeak
      if (n.includes('espeak') || n.includes('mbrola') || n.includes('compact') || n.includes('robot')) s -= 80;
      return s;
    };

    return [...pool].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
  }
}
