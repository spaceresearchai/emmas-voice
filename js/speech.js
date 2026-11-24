// ============================================================================
// Speech Synthesis & Joyful Felicitation Fanfare / Gentle Chimes
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

  /**
   * Plays a cheerful musical felicitation fanfare (bright ascending major arpeggio + sparkle)
   * or a soft 2-note chime in Calm Mode.
   */
  playFelicitationFanfare({ celebratory = true } = {}) {
    if (!this.chimeEnabled) return;
    this.unlockAudio();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const notes = this.calmMode
      ? [523.25, 659.25]
      : celebratory
        ? [523.25, 659.25, 783.99, 1046.5] // C5 -> E5 -> G5 -> C6 joyful fanfare!
        : [523.25, 659.25, 783.99];

    const peakGain = this.calmMode ? 0.08 : 0.14;
    const step = this.calmMode ? 0.12 : 0.085;

    notes.forEach((freq, i) => {
      const start = now + i * step;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = i === notes.length - 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + (i === notes.length - 1 ? 0.65 : 0.36));

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.7);
    });
  }

  speakFelicitation(praisePhrase, childName = 'Emma') {
    this.playFelicitationFanfare({ celebratory: true });
    if (!('speechSynthesis' in window)) return;

    const speakNow = () => {
      try {
        window.speechSynthesis.cancel();
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

        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = this.language;
        utter.rate = Math.min(1.05, Math.max(0.75, this.rate + 0.08));
        utter.pitch = this.calmMode ? 1.02 : 1.14;
        const chosen = this._pickVoice();
        if (chosen) utter.voice = chosen;
        window.speechSynthesis.speak(utter);
      } catch (err) {
        console.warn('Felicitation speech failed:', err);
      }
    };

    setTimeout(speakNow, this.chimeEnabled ? 220 : 20);
  }

  speakWord(wordText, { isReward = false, slow = false } = {}) {
    if (!('speechSynthesis' in window)) return;
    this.unlockAudio();

    if (isReward) {
      this.playFelicitationFanfare({ celebratory: false });
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
      setTimeout(speakNow, 180);
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

    const preferredNames = ['Samantha', 'Ava', 'Karen', 'Google US English', 'Aria', 'Monica', 'Paulina', 'Luciana'];
    for (const name of preferredNames) {
      const hit = matching.find((v) => v.name.includes(name));
      if (hit) return hit;
    }
    return matching[0];
  }
}
