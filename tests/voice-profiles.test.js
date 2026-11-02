import test from 'node:test';
import assert from 'node:assert/strict';
import { getVoiceProfile } from '../dist/voice-profiles.js';
import { CHARACTERS } from '../dist/character-data.js';

const voice = (name, lang = 'en-US', localService = true, extra = {}) => Object.freeze({ name, lang, localService, voiceURI: name, ...extra });
const voices = Object.freeze([
  voice('Samantha'), voice('Daniel', 'en-GB'), voice('Karen', 'en-AU'),
  voice('Google US English', 'en-US', false), voice('French', 'fr-FR', true, { default: true }),
]);
const sound = ({ pitch, rate, volume }) => ({ pitch, rate, volume });

test('all 51 friends have stable, distinct, audible settings close to natural speech', () => {
  assert.deepEqual(CHARACTERS.map(character => character.number), Array.from({ length: 51 }, (_, i) => i));
  const profiles = CHARACTERS.map(({ number }) => getVoiceProfile(number));
  assert.equal(new Set(profiles.map(profile => JSON.stringify(sound(profile)))).size, CHARACTERS.length);
  assert.ok(new Set(profiles.map(profile => profile.pitch)).size > 1);
  assert.ok(new Set(profiles.map(profile => profile.rate)).size > 1);
  for (const { number } of CHARACTERS) {
    const profile = getVoiceProfile(number);
    assert.deepEqual(profile, getVoiceProfile(String(number)));
    assert.ok(Object.isFrozen(profile));
    assert.equal(profile.voice, null); assert.equal(profile.lang, 'en-US');
    assert.ok(profile.pitch >= .97 && profile.pitch <= 1.03, 'pitch for ' + number);
    assert.ok(profile.rate >= .95 && profile.rate <= 1, 'rate for ' + number);
    assert.ok(profile.volume >= .92 && profile.volume <= 1, 'volume for ' + number);
  }
});

test('natural local English identities are stable across list order and duplicates', () => {
  const selected = new Set();
  for (const { number } of CHARACTERS) {
    const expected = getVoiceProfile(number, voices);
    selected.add(expected.voice.name);
    assert.equal(expected.voice.localService, true);
    assert.match(expected.lang, /^en-/);
    assert.ok(voices.includes(expected.voice));
    assert.deepEqual(sound(expected), sound(getVoiceProfile(number)));
    for (const order of [[...voices].reverse(), [voices[3], voices[1], voices[4], voices[0], voices[2]], [...voices, { ...voices[0] }]]) {
      assert.deepEqual(getVoiceProfile(number, order), expected);
    }
  }
  assert.deepEqual([...selected].sort(), ['Daniel', 'Karen', 'Samantha']);
});

test('novelty, whispering, singing and robotic voices are never selected', () => {
  const names = ['Albert', 'Bad News', 'BadNews', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos', 'Deranged',
    'Eddy', 'Flo', 'Fred', 'Good News', 'Grandma', 'Grandpa', 'Hysterical', 'Jester', 'Junior',
    'Kathy', 'Organ', 'Pipe Organ', 'Princess', 'Ralph', 'Reed', 'Rocko', 'Sandy', 'Shelley', 'Shelly', 'Trinoids', 'Whisper', 'Wobble', 'Zarvox'];
  const novelties = names.map(name => voice(name, 'en-US', true, { default: true }));
  for (const { number } of CHARACTERS) {
    assert.equal(getVoiceProfile(number, novelties).voice, null, 'a novelty-only list must use browser-default fallback');
    for (const novelty of novelties) {
      assert.equal(getVoiceProfile(number, [novelty, voices[0]]).voice, voices[0]);
    }
  }
  for (const disguised of [voice('Samantha (Whisper)'), voice('Samantha', 'en-US', true, { voiceURI: 'com.apple.speech.synthesis.voice.Zarvox' })]) {
    assert.equal(getVoiceProfile(40, [disguised]).voice, null);
  }
  for (const number of [16, 28, 40]) {
    const profile = getVoiceProfile(number, [...novelties, voices[0]]);
    assert.equal(profile.voice, voices[0]); assert.ok(profile.volume >= .92);
  }
});

test('unknown English names fall back to the browser default rather than guessing at timbre', () => {
  for (const list of [[], null, {}, 'English', [voices[4]], [null, {}, { lang: 'en-US' }],
    [voice('Unknown Robot', 'en-US', true, { default: true })], [voice('English Meadow')]]) {
    for (const number of [0, 16, 28, 40, 50]) assert.deepEqual(getVoiceProfile(number, list), getVoiceProfile(number));
  }
});

test('natural online voices work when no recognized local English voice is available', () => {
  const online = [voice('Google UK English Female', 'en-GB', false), voice('Google UK English Male', 'en-GB', false),
    voice('Microsoft Aria Online (Natural) - English (United States)', 'en-US', false)];
  const picked = new Set();
  for (const { number } of CHARACTERS) {
    const profile = getVoiceProfile(number, [...online, voice('Bubbles')]);
    assert.ok(online.includes(profile.voice)); picked.add(profile.voice.name);
    assert.deepEqual(profile, getVoiceProfile(number, [...online].reverse()));
    assert.equal(getVoiceProfile(number, [...online, voices[0]]).voice, voices[0], 'prefer the known local voice');
  }
  assert.equal(picked.size, online.length);
});

test('ordinary platform voice variants and normalized English language tags remain usable', () => {
  const natural = [voice('Samantha (Enhanced)', ' en_US '), voice('Alex', 'EN'),
    voice('Microsoft David Desktop - English (United States)'),
    voice('', 'en-GB', true, { voiceURI: 'com.apple.voice.premium.en-GB.Daniel' })];
  for (const candidate of natural) {
    const profile = getVoiceProfile(0, [candidate]);
    assert.equal(profile.voice, candidate); assert.match(profile.lang, /^en(?:-|$)/i);
    assert.ok(!profile.lang.includes('_'));
  }
  for (const lang of ['english', 'den-US', '', 'fr-FR']) assert.equal(getVoiceProfile(0, [voice('Samantha', lang)]).voice, null);
});

test('late voice availability keeps settings stable, Zero is distinct, and invalid identities use One', () => {
  assert.notDeepEqual(getVoiceProfile(0), getVoiceProfile(1));
  assert.notDeepEqual(getVoiceProfile(50), getVoiceProfile(1));
  for (const { number } of CHARACTERS) assert.deepEqual(sound(getVoiceProfile(number, voices)), sound(getVoiceProfile(number)));
  for (const invalid of [-1, 51, 1.5, NaN, Infinity, undefined, null, '', '  ', true, {}, [], Symbol('invalid')]) {
    assert.deepEqual(getVoiceProfile(invalid, voices), getVoiceProfile(1, voices));
  }
});
