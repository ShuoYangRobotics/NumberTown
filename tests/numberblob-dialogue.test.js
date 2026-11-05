import test from 'node:test';
import assert from 'node:assert/strict';
import { NUMBERBLOB_RESPONSES, createBlobDialogue, getNumberblobVoiceProfile, toNumberblobSpeech } from '../dist/numberblob-dialogue.js';
import { getVoiceProfile } from '../dist/voice-profiles.js';
import { toSpokenMath } from '../dist/speech.js';

const voice = (name, lang = 'en-US', extra = {}) => Object.freeze({ name, lang, localService: true, voiceURI: name, ...extra });
const fred = voice('Fred'), zarvox = voice('Zarvox'), samantha = voice('Samantha');
const seed = initial => {
  let state = initial;
  return () => ((state = (1664525 * state + 1013904223) >>> 0) / 2 ** 32);
};

test('exactly 30 short, distinct, immutable responses cover all four topics', () => {
  assert.equal(NUMBERBLOB_RESPONSES.length, 30);
  assert.ok(Object.isFrozen(NUMBERBLOB_RESPONSES));
  assert.equal(new Set(NUMBERBLOB_RESPONSES.map(entry => entry.id)).size, 30);
  assert.equal(new Set(NUMBERBLOB_RESPONSES.map(entry => entry.text)).size, 30);
  assert.deepEqual([...new Set(NUMBERBLOB_RESPONSES.map(entry => entry.topic))].sort(), ['math', 'mountains', 'sea', 'weather']);
  for (const entry of NUMBERBLOB_RESPONSES) {
    assert.ok(Object.isFrozen(entry));
    assert.match(entry.id, /^[a-z-]+$/);
    assert.ok(entry.text.length < 110, entry.id);
    assert.doesNotMatch(entry.text, /(?:today|currently|right now|forecast)/i,
      'general facts must not pretend to report live weather');
  }
});

test('the ten arithmetic responses are correct, simple, and pronounceable', () => {
  const math = NUMBERBLOB_RESPONSES.filter(entry => entry.topic === 'math');
  assert.equal(math.length, 10);
  assert.ok(math.some(entry => entry.text.includes('10 × 10 = 100')));
  for (const { text } of math) {
    const equation = text.match(/^(\d+) ([+×÷-]) (\d+) = (\d+)\./);
    assert.ok(equation, text);
    const a = +equation[1], b = +equation[3], result = +equation[4];
    const expected = { '+': () => a + b, '-': () => a - b, '×': () => a * b, '÷': () => a / b }[equation[2]]();
    assert.equal(result, expected, text);
    assert.ok(Number.isSafeInteger(result) && result >= 0 && result <= 100);
    assert.doesNotMatch(toNumberblobSpeech(text), /[×÷+=]|\d\s*-\s*\d/);
  }
});

test('one shared shuffled bag covers all 30 responses before repeating, including across boundaries', () => {
  const allIds = NUMBERBLOB_RESPONSES.map(entry => entry.id).sort();
  for (const random of [seed(1), seed(9231), () => 0, () => 1, () => NaN, () => -1, () => Infinity]) {
    const dialogue = createBlobDialogue({ random });
    let previous = null;
    for (let cycle = 0; cycle < 6; cycle++) {
      const ids = [];
      for (let i = 0; i < 30; i++) {
        const entry = dialogue.next();
        assert.ok(NUMBERBLOB_RESPONSES.includes(entry));
        assert.notEqual(entry, previous);
        ids.push(entry.id);
        previous = entry;
      }
      assert.deepEqual(ids.sort(), allIds);
    }
  }
});

test('controllers have independent state and deterministic seeded shuffles', () => {
  const first = createBlobDialogue({ random: seed(5) });
  const second = createBlobDialogue({ random: seed(5) });
  const third = createBlobDialogue({ random: seed(6) });
  const a = Array.from({ length: 90 }, () => first.next().id);
  assert.deepEqual(Array.from({ length: 90 }, () => second.next().id), a);
  assert.notDeepEqual(Array.from({ length: 90 }, () => third.next().id), a);
  for (const controller of [createBlobDialogue(), createBlobDialogue({ random: null })]) {
    assert.ok(NUMBERBLOB_RESPONSES.includes(controller.next()));
  }
});

test('Numberblobs prefer clear Fred, use Zarvox if necessary, and ignore voice-list ordering', () => {
  const novelty = [voice('Whisper'), voice('Bells'), voice('Boing'), voice('Trinoids')];
  const available = [samantha, zarvox, ...novelty, fred];
  for (let index = 0; index < 30; index++) {
    const profile = getNumberblobVoiceProfile(available, index);
    assert.equal(profile.voice, fred);
    assert.deepEqual(profile, getNumberblobVoiceProfile([...available].reverse(), index));
    assert.equal(getNumberblobVoiceProfile([samantha, zarvox, ...novelty], index).voice, zarvox);
    assert.equal(profile.volume, 1);
    assert.ok(profile.pitch >= 1 && profile.pitch <= 1.1);
    assert.ok(profile.rate >= .9 && profile.rate <= .94);
    assert.ok(Object.isFrozen(profile));
  }
});

test('robot names and languages are checked, without accepting whisper or singing variants', () => {
  const byURI = voice('', ' en_US ', { voiceURI: 'com.apple.speech.synthesis.voice.Fred' });
  assert.equal(getNumberblobVoiceProfile([byURI]).voice, byURI);
  assert.equal(getNumberblobVoiceProfile([byURI]).lang, 'en-US');
  for (const candidate of [voice('Fred (Whisper)'), voice('Zarvox Choir'), voice('Unknown Robot'),
    voice('Fred', 'fr-FR'), voice('Fred', 'english'), voice('Whisper', 'en-US', { voiceURI: 'com.apple.voice.Fred' })]) {
    assert.equal(getNumberblobVoiceProfile([candidate, samantha]).voice, samantha);
  }
  const remote = voice('Fred', 'en-US', { localService: false });
  assert.equal(getNumberblobVoiceProfile([remote, zarvox]).voice, zarvox, 'installed robot voices take priority');
});

test('missing robot voices fall back to recognized English readers at a gentle robotic pace', () => {
  for (const available of [[samantha, voice('Whisper')], [voice('Google US English', 'en-US', { localService: false })]]) {
    const profile = getNumberblobVoiceProfile(available);
    assert.equal(profile.voice, available[0]);
    assert.ok(profile.pitch >= .98 && profile.pitch <= 1.08);
    assert.ok(profile.rate >= .9 && profile.rate <= .94);
    assert.equal(profile.volume, 1);
  }
  for (const available of [null, {}, [], [null, {}], [voice('Whisper')], [voice('Unknown Robot')]]) {
    const profile = getNumberblobVoiceProfile(available);
    assert.equal(profile.voice, null);
    assert.equal(profile.lang, 'en-US');
    assert.equal(profile.volume, 1);
  }
});

test('Numberblob voice selection cannot change the ordinary Numberblocks voice profiles', () => {
  const available = [fred, zarvox, samantha, voice('Karen', 'en-AU')];
  const before = Array.from({ length: 51 }, (_, number) => getVoiceProfile(number, available));
  for (let index = 0; index < 100; index++) getNumberblobVoiceProfile(available, index);
  for (let number = 0; number <= 50; number++) {
    assert.deepEqual(getVoiceProfile(number, available), before[number]);
    assert.notEqual(before[number].voice, fred);
    assert.notEqual(before[number].voice, zarvox);
  }
  for (const index of [-1, 1.5, null, undefined, NaN, Infinity, Symbol('index')]) {
    assert.deepEqual(getNumberblobVoiceProfile(available, index), getNumberblobVoiceProfile(available, 0));
  }
});

test('robot cadence preserves every spoken word and expands arithmetic before adding pauses', () => {
  const words = text => text.replace(/[.!?,;:]/g, '').replace(/\s+/g, ' ').trim();
  for (const { text } of NUMBERBLOB_RESPONSES) {
    const speech = toNumberblobSpeech(text);
    assert.equal(words(speech), words(toSpokenMath(text)));
    assert.ok(speech.length > 0);
    assert.doesNotMatch(speech, /\s+[.!?,;:]|[,;:]\s*[,;:]/);
  }
  assert.match(toNumberblobSpeech('10 × 10 = 100.'), /10 times 10 equals, 100\./);
  assert.match(toNumberblobSpeech('24 ÷ 6 = 4.'), /24 divided by 6, equals 4\./);
  assert.equal(toNumberblobSpeech(null), '');
  assert.equal(toNumberblobSpeech(''), '');
});
