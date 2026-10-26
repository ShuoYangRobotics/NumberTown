import test from 'node:test';
import assert from 'node:assert/strict';
import { EMOTIONS, chooseRemark } from '../dist/personalities.js';

const moods = ['happy', 'excited', 'curious', 'surprised', 'sleepy', 'sad'];
const places = ['library', 'town-square', 'garden', 'pond', 'park', 'football', 'hill', 'river', 'beach', 'mountains', 'lookout'];
const samples = [0, .12, .25, .4, .58, .75, .99];

test('all six moods have usable, unique display options', () => {
  assert.deepEqual(EMOTIONS.map(item => item.id), moods);
  for (const item of EMOTIONS) {
    assert.ok(item.label.length > 0);
    assert.ok(item.icon.length > 0);
  }
});

test('all fifteen friends have at least three different personal happy remarks', () => {
  const signatures = new Set();
  for (let number = 1; number <= 15; number++) {
    const lines = new Set(samples.map(value => chooseRemark(number, {}, () => value).text));
    assert.ok(lines.size >= 3, `friend ${number} needs more personal dialogue`);
    signatures.add([...lines].sort().join('|'));
  }
  assert.equal(signatures.size, 15, 'each friend should have a distinct personality');
});

test('every friend preserves each chosen emotion in every landmark and while walking', () => {
  for (let number = 1; number <= 15; number++) {
    for (const emotion of moods) {
      for (const place of [undefined, ...places]) {
        for (const value of samples) {
          const result = chooseRemark(number, { place, emotion, moving: true, nearbyName: 'Fourteen' }, () => value);
          assert.equal(result.emotion, emotion, `friend ${number}, ${emotion}, ${place}`);
          assert.equal(typeof result.text, 'string');
          assert.ok(result.text.length > 0 && result.text.length <= 70, result.text);
        }
      }
    }
  }
});

test('landmark dialogue stays relevant to its location', () => {
  const patterns = {
    library: /book|stor|read|page|library/i,
    'town-square': /square|fountain|friends/i,
    pond: /duck|pond|ripples/i,
    garden: /flower|garden|blossom|seed|grow/i,
    park: /park|tree/i,
    football: /football|ball|goal|team/i,
    hill: /hill|view/i,
    river: /river/i,
    beach: /beach|sea|sand|shore|wave/i,
    mountains: /mountain|peak/i,
    lookout: /lookout|sea|view/i,
  };
  for (const place of places) {
    for (const emotion of moods) {
      for (const sample of samples) {
        assert.match(chooseRemark(8, { place, emotion }, () => sample).text, patterns[place]);
      }
    }
  }
});

test('the scenic lookout has sea-view remarks in every emotion', () => {
  for (const emotion of moods) {
    const lines = samples.map(sample => chooseRemark(15, { place: 'lookout', emotion }, () => sample));
    assert.ok(lines.some(line => /sea/i.test(line.text)), `${emotion} needs a sea-view remark`);
    assert.ok(lines.every(line => line.emotion === emotion));
  }
});

test('lastText prevents an immediate repeat for every friend, emotion, and landmark', () => {
  for (let number = 1; number <= 15; number++) {
    for (const emotion of moods) {
      for (const place of [undefined, ...places]) {
        for (const value of samples) {
          const context = { emotion, place };
          const first = chooseRemark(number, context, () => value);
          const second = chooseRemark(number, { ...context, lastText: first.text }, () => value);
          assert.notEqual(second.text, first.text);
          assert.equal(second.emotion, emotion);
        }
      }
    }
  }
});

test('new friends retain dice, rainbow, helping, square, and counting personalities', () => {
  const patterns = { 6: /six|die|dots/i, 7: /rainbow|color|violet/i, 8: /eight|hand/i, 9: /nine|three|square/i, 10: /ten|five/i };
  for (const [number, pattern] of Object.entries(patterns)) {
    for (const sample of samples) assert.match(chooseRemark(number, {}, () => sample).text, pattern);
  }
});

test('Eleven through Fifteen retain their own personality in every emotion', () => {
  const patterns = {
    11: /eleven|football|ball|team|goal/i,
    12: /twelve|rectangle/i,
    13: /thirteen|try|trying|wobble|tumble/i,
    14: /fourteen|rainbow|skateboard/i,
    15: /fifteen|step|squad|staircase/i,
  };
  for (const [number, pattern] of Object.entries(patterns)) {
    const personalLines = new Set();
    for (const emotion of moods) {
      // The first candidate is always this character's own emotional line.
      const result = chooseRemark(number, { emotion }, () => 0);
      assert.match(result.text, pattern, `friend ${number} needs its own ${emotion} voice`);
      assert.equal(result.emotion, emotion);
      personalLines.add(result.text);
    }
    assert.equal(personalLines.size, moods.length);
    for (const sample of samples) assert.match(chooseRemark(number, {}, () => sample).text, pattern);
  }
});

test('new friends can greet each other and retain location-specific dialogue', () => {
  const names = ['Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen'];
  for (let number = 11; number <= 15; number++) {
    for (const emotion of moods) {
      const name = names[(number - 10) % names.length];
      const greeting = chooseRemark(number, { emotion, nearbyName: name }, () => 1);
      assert.ok(greeting.text.includes(name));
      assert.equal(greeting.emotion, emotion);
      const library = chooseRemark(number, { emotion, nearbyName: name, place: 'library' }, () => 0);
      assert.match(library.text, /book|stor|read|page|library/i);
      assert.equal(library.emotion, emotion);
      assert.notEqual(library.text, greeting.text);
    }
  }
});

test('friend and walking context can produce fitting remarks', () => {
  for (const emotion of moods) {
    const greeting = chooseRemark(1, { emotion, nearbyName: 'Ten' }, () => 1);
    assert.match(greeting.text, /Ten/);
    assert.equal(greeting.emotion, emotion);
    const walking = chooseRemark(1, { emotion, moving: true }, () => 1);
    assert.match(walking.text, /step|adventure|road|walk|spot/i);
  }
});

test('injected randomness is deterministic, bounded, and does not mutate caller context', () => {
  const context = Object.freeze({ emotion: 'curious', place: 'library', lastText: 'previous' });
  assert.deepEqual(chooseRemark(7, context, () => .75), chooseRemark(7, context, () => .75));
  assert.deepEqual(chooseRemark(7, context, () => -1), chooseRemark(7, context, () => 0));
  assert.deepEqual(chooseRemark(7, context, () => 2), chooseRemark(7, context, () => 1));
  assert.deepEqual(chooseRemark(7, context, () => NaN), chooseRemark(7, context, () => 0));
  assert.deepEqual(chooseRemark(99, { emotion: 'unknown' }, () => 0), chooseRemark(1, {}, () => 0));
  assert.deepEqual(chooseRemark(16, {}, () => 0), chooseRemark(1, {}, () => 0));
  assert.notDeepEqual(chooseRemark(15, {}, () => 0), chooseRemark(1, {}, () => 0));
});
