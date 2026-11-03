/** Stable speaking personalities; the caller owns speech synthesis and its lifecycle. */
import { CHARACTERS } from './character-data.js';

const NUMBERS = new Set(CHARACTERS.map(character => character.number));
const resolveNumber = input => {
  const value = typeof input === 'number' || typeof input === 'string' && input.trim() ? Number(input) : NaN;
  return Number.isInteger(value) && NUMBERS.has(value) ? value : 1;
};

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
// Select ordinary reading voices deliberately. macOS also exposes whispering,
// singing and robotic novelty voices in the same English getVoices() list.
const NOVELTY_NAMES = ['Albert', 'Bad News', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos', 'Deranged',
  'Eddy', 'Flo', 'Fred', 'Good News', 'Grandma', 'Grandpa', 'Hysterical', 'Jester', 'Junior',
  'Kathy', 'Organ', 'Pipe Organ', 'Princess', 'Ralph', 'Reed', 'Rocko', 'Sandy', 'Shelley', 'Shelly',
  'Trinoids', 'Whisper', 'Wobble', 'Zarvox'];
const NATURAL_APPLE_NAMES = new Set(['Alex', 'Samantha', 'Victoria', 'Daniel', 'Karen', 'Moira', 'Tessa',
  'Fiona', 'Serena', 'Allison', 'Ava', 'Tom', 'Susan', 'Nathan', 'Zoe', 'Lee', 'Veena',
  'Oliver', 'Arthur', 'Stephanie', 'Aaron', 'Nicky', 'Joelle', 'Matilda', 'Isha', 'Rishi', 'Malcolm']
  .map(name => name.toLowerCase()));
const NATURAL_MICROSOFT = /^Microsoft (David|Zira|Mark|Hazel|George|Susan|Aria|Guy|Jenny|Ryan|Sonia|Natasha|William|Neerja|Prabhat|Liam|Clara|Michelle|Eric|Ana|Christopher|Steffan|Roger|Andrew|Emma|Brian|Ava)(?:\s|$)/i;
const compact = text => text.toLowerCase().replace(/[^a-z]/g, '');
const noveltyKeys = NOVELTY_NAMES.map(compact);

function naturalSpeaker(name, uri) {
  const identity = compact(`${name} ${uri}`);
  if (noveltyKeys.some(key => identity.includes(key))) return null;
  const baseName = name.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
  if (NATURAL_APPLE_NAMES.has(baseName)) return `apple:${baseName}`;
  const appleName = uri.split(/[._-]/).at(-1).toLowerCase();
  if (/^com\.apple\./i.test(uri) && NATURAL_APPLE_NAMES.has(appleName)) return `apple:${appleName}`;
  const microsoft = name.match(NATURAL_MICROSOFT);
  if (microsoft) return `microsoft:${microsoft[1].toLowerCase()}`;
  if (/^Google (?:US English|UK English (?:Female|Male))$/i.test(name)) return `google:${baseName}`;
  return null;
}

// Alternate brighter and warmer timbres, then vary pace across each group of
// six friends. These differences remain audible with just one installed voice,
// without chipmunk pitches, slowed-down growls, or quiet volume tricks.
const TIMBRES = Object.freeze([1.15, .93, 1.07, .98, 1.12, .90]);
const PACES = Object.freeze([.97, 1.04, .91, 1.08, .94, 1.01, .90, 1.06, .99]);
const FEATURED_SETTINGS = Object.freeze({
  16: Object.freeze({ pitch: 1.08, rate: 1.02 }),
  28: Object.freeze({ pitch: 1.16, rate: .96 }),
  40: Object.freeze({ pitch: .94, rate: 1.06 }),
});

function voiceQuality(name, uri) {
  const label = `${name} ${uri}`;
  if (/premium/i.test(label)) return 3;
  if (/enhanced|natural|neural/i.test(label)) return 2;
  if (/compact/i.test(label)) return 0;
  return 1;
}

/**
 * Return { voice, lang, pitch, rate, volume } for a SpeechSynthesisUtterance.
 * Pass speechSynthesis.getVoices() on each new utterance: browsers may populate
 * that list asynchronously. No browser globals are accessed here. English voice
 * speaker identities are sorted and deduplicated, so list order cannot change
 * a friend and multiple quality variants cannot crowd out other speakers.
 * Known natural local voices take priority over online voices. If none of the
 * available voices is recognized as natural English, use the browser default
 * (voice:null), rather than guessing from a novelty voice's language tag.
 */
export function getVoiceProfile(input, availableVoices = []) {
  const number = resolveNumber(input);
  const candidates = new Map();
  for (const voice of Array.isArray(availableVoices) ? availableVoices : []) {
    if (!voice || typeof voice.lang !== 'string') continue;
    const lang = voice.lang.trim().replaceAll('_', '-');
    if (!/^en(?:-[a-z0-9]+)*$/i.test(lang)) continue;
    const uri = typeof voice.voiceURI === 'string' ? voice.voiceURI.trim() : '';
    const name = typeof voice.name === 'string' ? voice.name.trim() : '';
    const speaker = naturalSpeaker(name, uri);
    if (!speaker) continue;
    const key = JSON.stringify([lang.toLowerCase(), speaker]);
    const candidate = { voice, lang, local: voice.localService === true, quality: voiceQuality(name, uri),
      // Stable tie-breaking also covers engines reusing one URI for speakers.
      identity: JSON.stringify([uri, name, lang]) };
    const current = candidates.get(key);
    if (!current || Number(candidate.local) > Number(current.local)
      || (candidate.local === current.local && (candidate.quality > current.quality
        || (candidate.quality === current.quality && compare(candidate.identity, current.identity) < 0)))) {
      candidates.set(key, candidate);
    }
  }
  const natural = [...candidates].sort(([a], [b]) => compare(a, b)).map(([, value]) => value);
  const local = natural.filter(({ voice }) => voice.localService === true);
  const voices = local.length ? local : natural;
  // Offset each timbre group so multiples of six do not repeatedly inherit the
  // same native speaker on common installations with three or six voices.
  const speakerIndex = number + Math.floor(number / TIMBRES.length);
  const selected = voices[speakerIndex % voices.length];
  const settings = FEATURED_SETTINGS[number] ?? { pitch: TIMBRES[number % TIMBRES.length],
    rate: PACES[Math.floor(number / TIMBRES.length) % PACES.length] };
  return Object.freeze({
    voice: selected?.voice ?? null,
    lang: selected?.lang ?? 'en-US',
    ...settings,
    volume: 1,
  });
}
