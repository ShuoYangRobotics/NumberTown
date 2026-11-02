/** Stable speaking personalities; the caller owns speech synthesis and its lifecycle. */
import { CHARACTERS } from './character-data.js';

const NUMBERS = new Set(CHARACTERS.map(character => character.number));
const resolveNumber = input => {
  const value = typeof input === 'number' || typeof input === 'string' && input.trim() ? Number(input) : NaN;
  return Number.isInteger(value) && NUMBERS.has(value) ? value : 1;
};

const round = value => Math.round(value * 1000) / 1000;
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
const NATURAL_MICROSOFT = /^Microsoft (?:David|Zira|Mark|Hazel|George|Susan|Aria|Guy|Jenny|Ryan|Sonia|Natasha|William|Neerja|Prabhat|Liam|Clara|Michelle|Eric|Ana|Christopher|Steffan|Roger|Andrew|Emma|Brian|Ava)(?:\s|$)/i;
const compact = text => text.toLowerCase().replace(/[^a-z]/g, '');
const noveltyKeys = NOVELTY_NAMES.map(compact);

function isNaturalVoice(name, uri) {
  const identity = compact(`${name} ${uri}`);
  if (noveltyKeys.some(key => identity.includes(key))) return false;
  const baseName = name.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
  if (NATURAL_APPLE_NAMES.has(baseName)) return true;
  if (/^com\.apple\./i.test(uri) && NATURAL_APPLE_NAMES.has(uri.split(/[._-]/).at(-1).toLowerCase())) return true;
  return NATURAL_MICROSOFT.test(name) || /^Google (?:US English|UK English (?:Female|Male))$/i.test(name);
}

/**
 * Return { voice, lang, pitch, rate, volume } for a SpeechSynthesisUtterance.
 * Pass speechSynthesis.getVoices() on each new utterance: browsers may populate
 * that list asynchronously. No browser globals are accessed here. English voice
 * identities are sorted and deduplicated, so list order cannot change a friend.
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
    if (!isNaturalVoice(name, uri)) continue;
    // Include both URI and name: some engines reuse a URI for several voices.
    const key = JSON.stringify([lang.toLowerCase(), uri, name, voice.localService === true]);
    if (!candidates.has(key)) candidates.set(key, { voice, lang });
  }
  const natural = [...candidates].sort(([a], [b]) => compare(a, b)).map(([, value]) => value);
  const local = natural.filter(({ voice }) => voice.localService === true);
  const voices = local.length ? local : natural;
  const selected = voices[number % voices.length];
  return Object.freeze({
    voice: selected?.voice ?? null,
    lang: selected?.lang ?? 'en-US',
    // Mild identity variation preserves intelligibility and natural timbre.
    // Audible volume is independent of whether a named voice is installed.
    pitch: round(.97 + ((number * 7 + 3) % 13) * .005),
    rate: round(.95 + ((number * 5 + 7) % 11) * .005),
    volume: round(.92 + (number % 9) * .01),
  });
}
