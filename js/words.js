// ============================================================================
// Curated SLP Core Vocabulary + Automatic Grapheme-to-Viseme Generator
// ============================================================================

export const SHAPE_LABELS = {
  bilabial: 'Press & Open',
  open: 'Wide Open',
  round: 'Round "O"',
  smile: 'Wide Smile',
};

export const DEFAULT_WORDS = [
  {
    id: 'mama',
    text: 'Mama',
    emoji: '👩',
    category: 'starter',
    shape: 'bilabial',
    cue: 'Press lips together for "M", then open wide for "A"',
    syllables: ['MA', 'MA'],
    timeline: [
      { v: 'closed', dur: 320, syl: 0 },
      { v: 'openWide', dur: 400, syl: 0 },
      { v: 'closed', dur: 290, syl: 1 },
      { v: 'openWide', dur: 440, syl: 1 },
      { v: 'rest', dur: 260, syl: -1 },
    ],
  },
  {
    id: 'dada',
    text: 'Dada',
    emoji: '👨',
    category: 'starter',
    shape: 'open',
    cue: 'Tap tongue gently behind top teeth, then open "A"',
    syllables: ['DA', 'DA'],
    timeline: [
      { v: 'tongueUp', dur: 270, syl: 0 },
      { v: 'openWide', dur: 390, syl: 0 },
      { v: 'tongueUp', dur: 260, syl: 1 },
      { v: 'openWide', dur: 430, syl: 1 },
      { v: 'rest', dur: 260, syl: -1 },
    ],
  },
  {
    id: 'more',
    text: 'More',
    emoji: '➕',
    category: 'starter',
    shape: 'bilabial',
    cue: 'Press lips together, then round them for "OR"',
    syllables: ['M', 'ORE'],
    timeline: [
      { v: 'closed', dur: 380, syl: 0 },
      { v: 'roundOpen', dur: 540, syl: 1 },
      { v: 'rest', dur: 260, syl: -1 },
    ],
  },
  {
    id: 'ball',
    text: 'Ball',
    emoji: '⚽',
    category: 'starter',
    shape: 'bilabial',
    cue: 'Pop lips open from closed, then lift tongue for "L"',
    syllables: ['B', 'ALL'],
    timeline: [
      { v: 'closed', dur: 320, syl: 0 },
      { v: 'openWide', dur: 360, syl: 1 },
      { v: 'tongueUp', dur: 300, syl: 1 },
      { v: 'rest', dur: 260, syl: -1 },
    ],
  },
  {
    id: 'bye',
    text: 'Bye',
    emoji: '👋',
    category: 'starter',
    shape: 'bilabial',
    cue: 'Close lips softly, then open to a gentle smile',
    syllables: ['B', 'YE'],
    timeline: [
      { v: 'closed', dur: 320, syl: 0 },
      { v: 'openWide', dur: 320, syl: 1 },
      { v: 'smile', dur: 360, syl: 1 },
      { v: 'rest', dur: 260, syl: -1 },
    ],
  },
  {
    id: 'hi',
    text: 'Hi',
    emoji: '😊',
    category: 'starter',
    shape: 'open',
    cue: 'Open mouth wide, then glide into a bright smile',
    syllables: ['H', 'I'],
    timeline: [
      { v: 'openMid', dur: 260, syl: 0 },
      { v: 'openWide', dur: 340, syl: 1 },
      { v: 'smile', dur: 380, syl: 1 },
      { v: 'rest', dur: 260, syl: -1 },
    ],
  },
  {
    id: 'water',
    text: 'Water',
    emoji: '💧',
    category: 'needs',
    shape: 'round',
    cue: 'Make a small round "O" for "W", then open wide',
    syllables: ['WA', 'TER'],
    timeline: [
      { v: 'roundTight', dur: 340, syl: 0 },
      { v: 'openWide', dur: 360, syl: 0 },
      { v: 'tongueUp', dur: 220, syl: 1 },
      { v: 'roundOpen', dur: 340, syl: 1 },
      { v: 'rest', dur: 260, syl: -1 },
    ],
  },
  {
    id: 'milk',
    text: 'Milk',
    emoji: '🥛',
    category: 'needs',
    shape: 'bilabial',
    cue: 'Press lips for "M", then gentle smile for "ILK"',
    syllables: ['M', 'ILK'],
    timeline: [
      { v: 'closed', dur: 340, syl: 0 },
      { v: 'smile', dur: 320, syl: 1 },
      { v: 'tongueUp', dur: 280, syl: 1 },
      { v: 'rest', dur: 260, syl: -1 },
    ],
  },
  {
    id: 'open',
    text: 'Open',
    emoji: '📦',
    category: 'needs',
    shape: 'round',
    cue: 'Make a big round "O", then press lips for "P"',
    syllables: ['O', 'PEN'],
    timeline: [
      { v: 'roundOpen', dur: 420, syl: 0 },
      { v: 'closed', dur: 280, syl: 1 },
      { v: 'openMid', dur: 280, syl: 1 },
      { v: 'tongueUp', dur: 220, syl: 1 },
      { v: 'rest', dur: 260, syl: -1 },
    ],
  },
  {
    id: 'eat',
    text: 'Eat',
    emoji: '🍎',
    category: 'needs',
    shape: 'smile',
    cue: 'Stretch lips into a wide "EE" smile, then tap "T"',
    syllables: ['EE', 'T'],
    timeline: [
      { v: 'smile', dur: 460, syl: 0 },
      { v: 'tongueUp', dur: 260, syl: 1 },
      { v: 'rest', dur: 260, syl: -1 },
    ],
  },
  {
    id: 'help',
    text: 'Help',
    emoji: '🤝',
    category: 'needs',
    shape: 'open',
    cue: 'Open mouth gently for "HE", then close lips on "P"',
    syllables: ['HEL', 'P'],
    timeline: [
      { v: 'openMid', dur: 380, syl: 0 },
      { v: 'tongueUp', dur: 240, syl: 0 },
      { v: 'closed', dur: 320, syl: 1 },
      { v: 'rest', dur: 260, syl: -1 },
    ],
  },
  {
    id: 'yes',
    text: 'Yes',
    emoji: '✅',
    category: 'needs',
    shape: 'smile',
    cue: 'Start with a wide smile and open slightly',
    syllables: ['Y', 'ES'],
    timeline: [
      { v: 'smile', dur: 300, syl: 0 },
      { v: 'openMid', dur: 320, syl: 1 },
      { v: 'smile', dur: 300, syl: 1 },
      { v: 'rest', dur: 260, syl: -1 },
    ],
  },
  {
    id: 'no',
    text: 'No',
    emoji: '🚫',
    category: 'needs',
    shape: 'round',
    cue: 'Tap tongue up for "N", then make a round "O"',
    syllables: ['N', 'O'],
    timeline: [
      { v: 'tongueUp', dur: 280, syl: 0 },
      { v: 'roundOpen', dur: 480, syl: 1 },
      { v: 'roundTight', dur: 220, syl: 1 },
      { v: 'rest', dur: 260, syl: -1 },
    ],
  },
  {
    id: 'all-done',
    text: 'All done',
    emoji: '🙌',
    category: 'needs',
    shape: 'open',
    cue: 'Open wide for "ALL", then tap tongue for "DONE"',
    syllables: ['ALL', 'DONE'],
    timeline: [
      { v: 'openWide', dur: 340, syl: 0 },
      { v: 'tongueUp', dur: 260, syl: 0 },
      { v: 'tongueUp', dur: 200, syl: 1 },
      { v: 'openMid', dur: 340, syl: 1 },
      { v: 'tongueUp', dur: 220, syl: 1 },
      { v: 'rest', dur: 260, syl: -1 },
    ],
  },
  {
    id: 'bubbles',
    text: 'Bubbles',
    emoji: '🫧',
    category: 'play',
    shape: 'bilabial',
    cue: 'Pop lips twice for "BUB-BLES"!',
    syllables: ['BUB', 'BLES'],
    timeline: [
      { v: 'closed', dur: 270, syl: 0 },
      { v: 'openMid', dur: 310, syl: 0 },
      { v: 'closed', dur: 260, syl: 1 },
      { v: 'tongueUp', dur: 280, syl: 1 },
      { v: 'smile', dur: 240, syl: 1 },
      { v: 'rest', dur: 260, syl: -1 },
    ],
  },
  {
    id: 'go',
    text: 'Go',
    emoji: '🚀',
    category: 'play',
    shape: 'round',
    cue: 'Open slightly, then round lips into a big "O"',
    syllables: ['G', 'O'],
    timeline: [
      { v: 'openMid', dur: 240, syl: 0 },
      { v: 'roundOpen', dur: 460, syl: 1 },
      { v: 'roundTight', dur: 240, syl: 1 },
      { v: 'rest', dur: 260, syl: -1 },
    ],
  },
  {
    id: 'up',
    text: 'Up',
    emoji: '⬆️',
    category: 'play',
    shape: 'bilabial',
    cue: 'Open mouth for "UH", then press lips closed for "P"',
    syllables: ['U', 'P'],
    timeline: [
      { v: 'openWide', dur: 380, syl: 0 },
      { v: 'closed', dur: 360, syl: 1 },
      { v: 'rest', dur: 260, syl: -1 },
    ],
  },
  {
    id: 'play',
    text: 'Play',
    emoji: '🧸',
    category: 'play',
    shape: 'bilabial',
    cue: 'Pop lips for "P", lift tongue, then smile for "AY"',
    syllables: ['P', 'LAY'],
    timeline: [
      { v: 'closed', dur: 300, syl: 0 },
      { v: 'tongueUp', dur: 230, syl: 1 },
      { v: 'openMid', dur: 280, syl: 1 },
      { v: 'smile', dur: 340, syl: 1 },
      { v: 'rest', dur: 260, syl: -1 },
    ],
  },
];

/**
 * Generates an approximate phoneme/viseme timeline for any custom parent word.
 */
export function buildVisemeTimeline(wordText) {
  const clean = (wordText || 'Hi').trim();
  const upper = clean.toUpperCase();
  const letters = upper.replace(/[^A-ZÁÉÍÓÚÜÑ]/g, '');

  // Split into 1-3 simple readable visual chunks for syllable pills
  const syllables = splitSyllables(upper);
  const timeline = [];

  for (let i = 0; i < letters.length; i++) {
    const ch = letters[i];
    const sylIndex = Math.min(
      syllables.length - 1,
      Math.floor((i / Math.max(1, letters.length)) * syllables.length)
    );

    let viseme = 'openMid';
    let dur = 260;

    if ('MBP'.includes(ch)) {
      viseme = 'closed';
      dur = 300;
    } else if ('FV'.includes(ch)) {
      viseme = 'teethLip';
      dur = 280;
    } else if ('OÓUÚÜW'.includes(ch)) {
      viseme = ch === 'W' || ch === 'U' || ch === 'Ú' ? 'roundTight' : 'roundOpen';
      dur = 360;
    } else if ('AÁ'.includes(ch)) {
      viseme = 'openWide';
      dur = 380;
    } else if ('EÉIÍY'.includes(ch)) {
      viseme = 'smile';
      dur = 340;
    } else if ('LTDNÑ'.includes(ch)) {
      viseme = 'tongueUp';
      dur = 240;
    } else if ('SZC'.includes(ch)) {
      viseme = 'smile';
      dur = 230;
    } else {
      viseme = 'openMid';
      dur = 250;
    }

    // Merge consecutive identical visemes to stay smooth
    const prev = timeline[timeline.length - 1];
    if (prev && prev.v === viseme) {
      prev.dur = Math.min(480, prev.dur + 110);
    } else {
      timeline.push({ v: viseme, dur, syl: sylIndex });
    }
  }

  if (timeline.length === 0) {
    timeline.push({ v: 'openWide', dur: 420, syl: 0 });
  }
  timeline.push({ v: 'rest', dur: 260, syl: -1 });

  return { syllables, timeline };
}

function splitSyllables(upperWord) {
  const parts = upperWord.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return parts;
  const word = parts[0] || upperWord;
  if (word.length <= 3) return [word];
  const chunks = word.match(/[^AEIOUÁÉÍÓÚY]*[AEIOUÁÉÍÓÚY]+(?:[^AEIOUÁÉÍÓÚY](?![AEIOUÁÉÍÓÚY]))?/g);
  if (!chunks || chunks.length === 0) return [word];
  return chunks.slice(0, 4);
}
