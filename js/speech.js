// ============================================================================
// Speech Synthesis & Gentle Web Audio Reward Chimes (iPad Safari Friendly)
// ============================================================================

export class SpeechEngine {
  constructor() {
    this.audioCtx = null;
    this.voices = [];
    this.language = 'en-US';
    this.voiceURI = '';
    this.rate = 0.85;
    this.chimeEnabled = true;
    this.praiseEnabled = false;
    this.calmMode = false;

    this._onVoicesChangedCallbacks = [];
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

  _refreshVoices() {
    if (!('speechSynthesis' in window)) return;
    this.voices = window.speechSynthesis.getVoices() || [];
    this._onVoicesChangedCallbacks.forEach((cb) => cb(this.voices));
  }

  /**
   * Must be called inside a user tap/click to unlock iPad Safari audio & speech.
   */
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
    if (cfg.language !== undefined) this.language = cfg.language;
    if (cfg.voiceURI !== undefined) this.voiceURI = cfg.voiceURI;
    if (cfg.speechRate !== undefined) this.rate = Number(cfg.speechRate) || 0.85;
    if (cfg.chimeEnabled !== undefined) this.chimeEnabled = Boolean(cfg.chimeEnabled);
    if (cfg.praiseEnabled !== undefined) this.praiseEnabled = Boolean(cfg.praiseEnabled);
    if (cfg.calmMode !== undefined) this.calmMode = Boolean(cfg.calmMode);
  }

  playRewardChime() {
    if (!this.chimeEnabled) return;
    this.unlockAudio();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    // Soft warm pentatonic triad (C5 -> E5 -> G5)
    const freqs = this.calmMode ? [523.25, 659.25] : [523.25, 659.25, 783.99];
    const peakGain = this.calmMode ? 0.08 : 0.14;

    freqs.forEach((freq, i) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.09);

      gain.gain.setValueAtTime(0.0001, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + i * 0.09 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.42);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.45);
    });
  }

  speakWord(wordText, { isReward = false, slow = false } = {}) {
    if (!('speechSynthesis' in window)) return;
    this.unlockAudio();

    if (isReward) {
      this.playRewardChime();
    }

    const speakNow = () => {
      try {
        window.speechSynthesis.cancel();
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

        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = this.language;
        utter.rate = slow ? Math.max(0.5, this.rate * 0.72) : this.rate;
        utter.pitch = this.calmMode ? 1.0 : 1.08;
        utter.volume = 1.0;

        const chosen = this._pickVoice();
        if (chosen) utter.voice = chosen;

        window.speechSynthesis.speak(utter);
      } catch (err) {
        console.warn('Speech synthesis failed:', err);
      }
    };

    if (isReward && this.chimeEnabled) {
      setTimeout(speakNow, 150);
    } else {
      speakNow();
    }
  }

  _pickVoice() {
    if (this.voices.length === 0) this._refreshVoices();
    if (this.voiceURI) {
      const exact = this.voices.find((v) => v.voiceURI === this.voiceURI);
      if (exact) return exact;
    }
    const langPrefix = this.language.split('-')[0].toLowerCase();
    const matching = this.voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));
    if (matching.length === 0) return this.voices[0] || null;

    // Prefer warm, natural voices on iOS/macOS/Android/Chrome
    const preferredNames = ['Samantha', 'Ava', 'Karen', 'Google US English', 'Aria', 'Monica', 'Paulina', 'Luciana'];
    for (const name of preferredNames) {
      const hit = matching.find((v) => v.name.includes(name));
      if (hit) return hit;
    }
    return matching[0];
  }
}
