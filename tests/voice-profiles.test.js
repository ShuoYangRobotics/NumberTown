import test from 'node:test';
import assert from 'node:assert/strict';
import { getVoiceProfile } from '../dist/voice-profiles.js';
import { CHARACTERS } from '../dist/character-data.js';

const voices = Object.freeze([
  Object.freeze({ name: 'English Meadow', lang: 'en-GB', voiceURI: 'meadow', localService: true }),
  Object.freeze({ name: 'English River', lang: 'en-US', voiceURI: 'river', localService: false }),
  Object.freeze({ name: 'English Sunny', lang: 'en-AU', voiceURI: 'sunny', localService: true }),
  Object.freeze({ name: 'French', lang: 'fr-FR', voiceURI: 'fr', default: true }),
]);

const sound = ({ pitch, rate, volume }) => ({ pitch, rate, volume });

test('all 41 friends have stable, distinct and pleasant vocal settings without installed voices', () => {
  assert.deepEqual(CHARACTERS.map(character => character.number), Array.from({ length: 41 }, (_, i) => i));
  const profiles = CHARACTERS.map(({ number }) => getVoiceProfile(number));
  assert.equal(new Set(profiles.map(profile => JSON.stringify(sound(profile)))).size, CHARACTERS.length);
  assert.ok(new Set(profiles.map(profile => profile.pitch)).size >= 15);
  assert.ok(new Set(profiles.map(profile => profile.rate)).size >= 10);
  assert.ok(new Set(profiles.map(profile => profile.volume)).size >= 5);
  for (const { number } of CHARACTERS) {
    const profile = getVoiceProfile(number);
    assert.deepEqual(profile, getVoiceProfile(number));
    assert.deepEqual(profile, getVoiceProfile(String(number)));
    assert.ok(Object.isFrozen(profile));
    assert.equal(profile.voice, null);
    assert.equal(profile.lang, 'en-US');
    assert.ok(profile.pitch >= .88 && profile.pitch <= 1.32);
    assert.ok(profile.rate >= .87 && profile.rate <= 1.05);
    assert.ok(profile.volume >= .5 && profile.volume <= .56);
  }
});

test('English identity selection is independent of installation list ordering', () => {
  const orders = [voices, [...voices].reverse(), [voices[2], voices[0], voices[3], voices[1]]];
  const selected = new Set();
  for (const { number } of CHARACTERS) {
    const expected = getVoiceProfile(number, voices);
    selected.add(expected.voice.voiceURI);
    assert.match(expected.lang, /^en-/);
    assert.ok(voices.includes(expected.voice), 'use the original platform voice object');
    assert.deepEqual(sound(expected), sound(getVoiceProfile(number)));
    for (const order of orders) assert.deepEqual(getVoiceProfile(number, order), expected);
    assert.deepEqual(getVoiceProfile(number, [...voices, voices[0]]), expected, 'duplicates do not skew selection');
    assert.deepEqual(getVoiceProfile(number, [...voices, { ...voices[0] }]), expected);
  }
  assert.equal(selected.size, 3, 'the friends should use all available English voices');
});

test('late voice availability, one voice, and non-English-only systems keep individual settings', () => {
  for (const { number } of CHARACTERS) {
    const base = getVoiceProfile(number);
    assert.deepEqual(getVoiceProfile(number, [voices[3]]), base);
    for (const malformed of [null, undefined, {}, 'English', [null, {}, { lang: 'en-US' }, { name: 'Blank', lang: '' }]]) {
      assert.deepEqual(getVoiceProfile(number, malformed), base);
    }
    const single = getVoiceProfile(number, [voices[1]]);
    assert.equal(single.voice, voices[1]);
    assert.deepEqual(sound(single), sound(base));
    assert.deepEqual(sound(getVoiceProfile(number, voices)), sound(base));
  }
});

test('language tags, missing URIs, and reused URIs have deterministic usable identities', () => {
  const alternatives = [
    { name: 'Legacy English', lang: ' en_US ', voiceURI: '' },
    { name: 'English A', lang: 'EN', voiceURI: 'shared' },
    { name: 'English B', lang: 'en', voiceURI: 'shared' },
    { name: 'Unsupported', lang: 'english', voiceURI: 'ignored' },
    { name: 'Other', lang: 'den-US', voiceURI: 'ignored-too' },
  ];
  const selected = new Set();
  for (const { number } of CHARACTERS) {
    const profile = getVoiceProfile(number, alternatives);
    selected.add(profile.voice.name);
    assert.deepEqual(profile, getVoiceProfile(number, [...alternatives].reverse()));
    assert.match(profile.lang, /^en(?:-|$)/i);
    assert.ok(!profile.lang.includes('_'));
  }
  assert.deepEqual([...selected].sort(), ['English A', 'English B', 'Legacy English']);
});

test('Zero is its own voice and invalid numbers use One safely', () => {
  assert.notDeepEqual(getVoiceProfile(0), getVoiceProfile(1));
  assert.notDeepEqual(getVoiceProfile(40), getVoiceProfile(1));
  for (const invalid of [-1, 41, 1.5, NaN, Infinity, undefined, null, '', '  ', true, {}, [], Symbol('invalid')]) {
    assert.deepEqual(getVoiceProfile(invalid, voices), getVoiceProfile(1, voices));
  }
});
