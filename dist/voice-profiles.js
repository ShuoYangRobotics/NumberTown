/** Stable speaking personalities; the caller owns speech synthesis and its lifecycle. */
import { CHARACTERS } from './character-data.js';

const NUMBERS = new Set(CHARACTERS.map(character => character.number));
const resolveNumber = input => {
  const value = typeof input === 'number' || typeof input === 'string' && input.trim() ? Number(input) : NaN;
  return Number.isInteger(value) && NUMBERS.has(value) ? value : 1;
};

const round = value => Math.round(value * 1000) / 1000;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

/**
 * Return { voice, lang, pitch, rate, volume } for a SpeechSynthesisUtterance.
 * Pass speechSynthesis.getVoices() on each new utterance: browsers may populate
 * that list asynchronously. No browser globals are accessed here. English voice
 * identities are sorted and deduplicated, so list order cannot change a friend.
 * With no English voice, voice is null and distinct vocal settings still apply.
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
    if (!uri && !name) continue;
    // Include both URI and name: some engines reuse a URI for several voices.
    const key = JSON.stringify([lang.toLowerCase(), uri, name, voice.localService === true]);
    if (!candidates.has(key)) candidates.set(key, { voice, lang });
  }
  const voices = [...candidates].sort(([a], [b]) => compare(a, b)).map(([, value]) => value);
  const selected = voices[number % voices.length];
  return Object.freeze({
    voice: selected?.voice ?? null,
    lang: selected?.lang ?? 'en-US',
    // Coprime cycles create distinct combinations without extreme cartoon pitch
    // or speed. Settings depend only on identity, never on the installed voices.
    pitch: round(.88 + ((number * 13 + 11) % 19) * .024),
    rate: round(.87 + ((number * 7 + 3) % 13) * .015),
    volume: round(.5 + (number % 7) * .01),
  });
}
