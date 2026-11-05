/** Numberblob chatter is separate from the natural voices of Numberblocks. */
import { getVoiceProfile } from './voice-profiles.js';
import { toSpokenMath } from './speech.js';

export const NUMBERBLOB_RESPONSES = Object.freeze([
  { id: 'math-hundred', topic: 'math', text: '10 × 10 = 100. Ten groups of ten make one hundred!' },
  { id: 'math-twenty', topic: 'math', text: '15 + 5 = 20. Counting on can help us add!' },
  { id: 'math-pairs', topic: 'math', text: '12 + 8 = 20. Two different parts can make a whole!' },
  { id: 'math-subtract-ten', topic: 'math', text: '30 - 10 = 20. Take away ten and twenty remain!' },
  { id: 'math-sharing', topic: 'math', text: '24 ÷ 6 = 4. Share twenty-four equally into six groups!' },
  { id: 'math-array', topic: 'math', text: '3 × 4 = 12. Three rows of four make twelve!' },
  { id: 'math-thirteen', topic: 'math', text: '7 + 6 = 13. Seven and six make thirteen!' },
  { id: 'math-nine', topic: 'math', text: '18 - 9 = 9. Nine is half of eighteen!' },
  { id: 'math-square', topic: 'math', text: '5 × 5 = 25. Twenty-five can make a square!' },
  { id: 'math-four', topic: 'math', text: '16 ÷ 4 = 4. Four equal groups of four make sixteen!' },
  { id: 'weather-clouds', topic: 'weather', text: 'Hello! Clouds contain tiny water drops or ice crystals.' },
  { id: 'weather-sun', topic: 'weather', text: 'The Sun warms the ground. Sunshine gives plants energy too!' },
  { id: 'weather-wind', topic: 'weather', text: 'Whoosh! Wind is moving air. It can carry seeds far away.' },
  { id: 'weather-rain', topic: 'weather', text: 'Rain brings water to plants. Roots drink it from the soil!' },
  { id: 'weather-rainbow', topic: 'weather', text: 'Rainbows can appear when sunlight passes through raindrops.' },
  { id: 'weather-snow', topic: 'weather', text: 'Snowflakes are ice crystals. Many have six sides!' },
  { id: 'weather-puddles', topic: 'weather', text: 'Water in a puddle can turn into invisible water vapor.' },
  { id: 'mountains-peak', topic: 'mountains', text: 'The top of a mountain is called its peak. What a view!' },
  { id: 'mountains-cool', topic: 'mountains', text: 'Air usually gets cooler as you climb higher up a mountain.' },
  { id: 'mountains-water', topic: 'mountains', text: 'Water flows downhill. Mountain streams can join to make rivers!' },
  { id: 'mountains-rocks', topic: 'mountains', text: 'Mountains are made of rock. Some take millions of years to form!' },
  { id: 'mountains-trail', topic: 'mountains', text: 'A mountain trail helps walkers find their way. Follow the path!' },
  { id: 'mountains-valley', topic: 'mountains', text: 'A valley is low ground between hills or mountains.' },
  { id: 'sea-salt', topic: 'sea', text: 'Sea water tastes salty because it contains dissolved salts.' },
  { id: 'sea-waves', topic: 'sea', text: 'Wind can make waves on the sea. Watch them roll toward the beach!' },
  { id: 'sea-fish', topic: 'sea', text: 'Most fish use gills to take oxygen from the water.' },
  { id: 'sea-kelp', topic: 'sea', text: 'Kelp is a kind of seaweed. Kelp forests shelter many sea animals!' },
  { id: 'sea-turtles', topic: 'sea', text: 'Sea turtles breathe air. They swim to the surface to take a breath!' },
  { id: 'sea-crabs', topic: 'sea', text: 'A crab has ten legs. Its two claws are part of that ten!' },
  { id: 'sea-corals', topic: 'sea', text: 'Corals are tiny animals. Some build reefs where many fish live!' },
].map(entry => Object.freeze(entry)));

/** One controller gives the whole town a shared, shuffled 30-response cycle. */
export function createBlobDialogue({ random = Math.random } = {}) {
  const randomSource = typeof random === 'function' ? random : Math.random;
  let bag = [], previous = null;
  return Object.freeze({
    next() {
      if (!bag.length) {
        bag = [...NUMBERBLOB_RESPONSES];
        for (let i = bag.length - 1; i > 0; i--) {
          const draw = Number(randomSource());
          const fraction = Number.isFinite(draw) ? Math.max(0, Math.min(1 - Number.EPSILON, draw)) : 0;
          const j = Math.floor(fraction * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        if (bag.at(-1) === previous) [bag[0], bag[bag.length - 1]] = [bag.at(-1), bag[0]];
      }
      previous = bag.pop();
      return previous;
    },
  });
}

const ROBOT_NAMES = new Map([['fred', 0], ['zarvox', 1]]);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const validIndex = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;

/** Fred is a clear, mechanical reading voice; avoid musical or whisper voices. */
export function getNumberblobVoiceProfile(availableVoices = [], index = 0) {
  const candidates = [];
  for (const voice of Array.isArray(availableVoices) ? availableVoices : []) {
    if (!voice || typeof voice.lang !== 'string') continue;
    const lang = voice.lang.trim().replaceAll('_', '-');
    if (!/^en(?:-[a-z0-9]+)*$/i.test(lang)) continue;
    const name = typeof voice.name === 'string' ? voice.name.trim().toLowerCase() : '';
    const uri = typeof voice.voiceURI === 'string' ? voice.voiceURI.trim() : '';
    const uriName = /^com\.apple\./i.test(uri) ? uri.split(/[._-]/).at(-1).toLowerCase() : '';
    const robot = ROBOT_NAMES.has(name) ? name : uriName;
    if (!ROBOT_NAMES.has(robot)) continue;
    // A deliberately altered voice such as "Fred (Whisper)" is not plain Fred.
    if (name && !ROBOT_NAMES.has(name)) continue;
    candidates.push({ voice, lang, rank: ROBOT_NAMES.get(robot),
      identity: JSON.stringify([lang.toLowerCase(), uri, name]) });
  }
  candidates.sort((a, b) => Number(b.voice.localService === true) - Number(a.voice.localService === true)
    || a.rank - b.rank || compare(a.identity, b.identity));
  const selected = candidates[0];
  const personality = validIndex(index);
  const fallback = selected ? null : getVoiceProfile(personality % 51, availableVoices);
  return Object.freeze({
    voice: selected?.voice ?? fallback?.voice ?? null,
    lang: selected?.lang ?? fallback?.lang ?? 'en-US',
    // Keep the robot intelligible, with small variations between the blobs.
    pitch: selected ? [1.04, 1.10, 1.00][personality % 3] : [1.08, 1.03, .98][personality % 3],
    rate: [.90, .94, .92][personality % 3],
    volume: 1,
  });
}

/** Short spoken phrases give fallback voices an even, mechanical cadence. */
export function toNumberblobSpeech(text) {
  return toSpokenMath(text).split(/([.!?,;:]+)/).map(part => {
    if (/^[.!?,;:]+$/.test(part)) return part;
    const words = part.trim().split(/\s+/).filter(Boolean);
    const groups = [];
    for (let i = 0; i < words.length; i += 4) groups.push(words.slice(i, i + 4).join(' '));
    return groups.join(', ');
  }).filter(Boolean).join(' ').replace(/\s+([.!?,;:])/g, '$1').trim();
}
