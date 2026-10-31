import test from 'node:test';
import assert from 'node:assert/strict';
import { EMOTIONS, chooseRemark, getMathFacts } from '../dist/personalities.js';
import { CHARACTERS } from '../dist/character-data.js';

const moods = ['happy', 'excited', 'curious', 'surprised', 'sleepy', 'sad'];
const places = ['library', 'town-square', 'garden', 'pond', 'park', 'football', 'hill', 'river', 'beach', 'mountains', 'mountain-trail', 'summit', 'lookout'];
const samples = [0, .12, .25, .4, .58, .75, .99];

test('all six moods have usable, unique display options', () => {
  assert.deepEqual(EMOTIONS.map(item => item.id), moods);
  for (const item of EMOTIONS) {
    assert.ok(item.label.length > 0);
    assert.ok(item.icon.length > 0);
  }
});

test('all twenty-five friends have at least three different personal happy remarks', () => {
  const signatures = new Set();
  for (let number = 1; number <= CHARACTERS.length; number++) {
    const lines = new Set(samples.map(value => chooseRemark(number, {}, () => value).text));
    assert.ok(lines.size >= 3, `friend ${number} needs more personal dialogue`);
    signatures.add([...lines].sort().join('|'));
  }
  assert.equal(signatures.size, CHARACTERS.length, 'each friend should have a distinct personality');
});

test('every friend preserves each chosen emotion in every landmark and while walking', () => {
  for (let number = 1; number <= CHARACTERS.length; number++) {
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
    'mountain-trail': /mountain|trail|path|summit/i,
    summit: /summit|deck/i,
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

test('the mountain trail and summit have distinct dialogue for every feeling', () => {
  for (const emotion of moods) {
    const trail = samples.map(sample => chooseRemark(11, { place: 'mountain-trail', emotion }, () => sample));
    const summit = samples.map(sample => chooseRemark(11, { place: 'summit', emotion }, () => sample));
    assert.ok(new Set(trail.map(line => line.text)).size >= 2);
    assert.ok(new Set(summit.map(line => line.text)).size >= 2);
    assert.ok(trail.every(line => /trail|path|summit/i.test(line.text)));
    assert.ok(summit.every(line => /summit|deck/i.test(line.text)));
    assert.ok(trail.every(line => !summit.some(other => line.text === other.text)));
    assert.ok([...trail, ...summit].every(line => line.emotion === emotion));
  }
  const mountainLines = samples.map(sample => chooseRemark(1, { place: 'mountains' }, () => sample).text);
  assert.ok(mountainLines.some(text => /paved mountain trail/i.test(text)), 'the foothills should introduce the new route');
});

test('the scenic lookout has sea-view remarks in every emotion', () => {
  for (const emotion of moods) {
    const lines = samples.map(sample => chooseRemark(15, { place: 'lookout', emotion }, () => sample));
    assert.ok(lines.some(line => /sea/i.test(line.text)), `${emotion} needs a sea-view remark`);
    assert.ok(lines.every(line => line.emotion === emotion));
  }
});

test('lastText prevents an immediate repeat for every friend, emotion, and landmark', () => {
  for (let number = 1; number <= CHARACTERS.length; number++) {
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

test('Eleven through Twenty-Five retain their own personality in every emotion', () => {
  const patterns = {
    11: /eleven|football|ball|team|goal/i,
    12: /twelve|rectangle/i,
    13: /thirteen|try|trying|wobble|tumble/i,
    14: /fourteen|rainbow|skateboard/i,
    15: /fifteen|step|squad|staircase/i,
    16: /sixteen|square/i,
    17: /seventeen|paint|color|rainbow/i,
    18: /eighteen|rectangle/i,
    19: /nineteen|shape|creative/i,
    20: /twenty|dance|dancing|two.*ten/i,
    21: /twenty-one|backpack|travel/i,
    22: /twenty|two/i,
    23: /twenty|three|yellow/i,
    24: /twenty-four|rectangle/i,
    25: /twenty-five|five|square/i,
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
  const names = CHARACTERS.filter(character => character.number >= 11).map(character => character.name);
  for (let number = 11; number <= CHARACTERS.length; number++) {
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
  assert.deepEqual(chooseRemark(CHARACTERS.length + 1, {}, () => 0), chooseRemark(1, {}, () => 0));
  assert.notDeepEqual(chooseRemark(20, {}, () => 0), chooseRemark(1, {}, () => 0));
});

// Independently interpret every public sentence rather than checking only that
// the generator emits its own templates. Unknown formats must add a validator.
function checkMathFact(text, number) {
  let match;
  const definition = CHARACTERS.find(item => item.number === number);
  if ((match = text.match(/^I have (\d+) (?:equal blocks|block)\.$/))) {
    assert.equal(+match[1], number);
    assert.equal(definition.cells.length, number);
  } else if ((match = text.match(/^(\d+) ([+−×-]) (\d+) = (\d+)\.$/))) {
    const a = +match[1], b = +match[3], result = +match[4];
    const actual = match[2] === '+' ? a + b : match[2] === '×' ? a * b : a - b;
    assert.equal(actual, result, text);
    assert.equal(result, number);
  } else if ((match = text.match(/^(\d+) divided by (\d+) is (\d+)\.$/))) {
    assert.ok(+match[2] > 0);
    assert.equal(+match[1] / +match[2], +match[3], text);
    assert.equal(+match[3], number);
  } else if ((match = text.match(/^(\d+) is even: (\d+) pairs of blocks\.$/))) {
    assert.equal(+match[1], number);
    assert.equal(number % 2, 0);
    assert.equal(+match[2] * 2, number);
  } else if ((match = text.match(/^(\d+) is odd: (\d+) pairs and 1 left over\.$/))) {
    assert.equal(+match[1], number);
    assert.equal(number % 2, 1);
    assert.equal(+match[2] * 2 + 1, number);
  } else if ((match = text.match(/^I (am a|can arrange into a) (\d+) by (\d+) (square|rectangle)!$/))) {
    const width = +match[2], height = +match[3];
    assert.equal(width * height, number, text);
    assert.equal(match[4], width === height ? 'square' : 'rectangle');
    if (match[1] === 'am a') {
      assert.equal(definition.width, width);
      assert.equal(definition.height, height);
      for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) {
        assert.ok(definition.cells.some(cell => cell.x === x && cell.y === y), `${text} has a missing cell at ${x},${y}`);
      }
    }
  } else if ((match = text.match(/^(\d+) is prime: its only factors are 1 and (\d+)\.$/))) {
    assert.equal(+match[1], number);
    assert.equal(+match[2], number);
    const divisors = Array.from({ length: number }, (_, i) => i + 1).filter(divisor => number % divisor === 0);
    assert.deepEqual(divisors, [1, number]);
  } else if ((match = text.match(/^(\d+) is composite: (\d+) × (\d+) = (\d+)\.$/))) {
    assert.equal(+match[1], number);
    assert.equal(+match[4], number);
    assert.ok(+match[2] > 1 && +match[3] > 1);
    assert.equal(+match[2] * +match[3], number);
  } else if ((match = text.match(/^(\d+) is a square number: (\d+) × (\d+) = (\d+)\.$/))) {
    assert.equal(+match[1], number);
    assert.equal(+match[2], +match[3]);
    assert.equal((+match[2]) ** 2, number);
    assert.equal(+match[4], number);
  } else if ((match = text.match(/^My (\d+) steps have ([\d +]+) = (\d+) blocks\.$/))) {
    const steps = match[2].split(' + ').map(Number);
    assert.equal(steps.length, +match[1]);
    assert.deepEqual(steps, Array.from({ length: steps.length }, (_, i) => i + 1));
    assert.equal(steps.reduce((sum, value) => sum + value, 0), number);
    assert.equal(+match[3], number);
    assert.deepEqual(steps, Array.from({ length: definition.width }, (_, x) => definition.cells.filter(cell => cell.x === x).length));
  } else if (text === '1 is neither prime nor composite.') {
    assert.equal(number, 1);
  } else {
    assert.fail(`Unverified mathematical claim: ${text}`);
  }
}

test('all facts for One through Twenty-Five are short, unique, and mathematically true', () => {
  assert.equal(CHARACTERS.length, 25, 'math descriptions should match all twenty-five rendered friends');
  for (let number = 1; number <= CHARACTERS.length; number++) {
    const facts = getMathFacts(number);
    assert.ok(Object.isFrozen(facts));
    assert.ok(facts.length >= 8);
    assert.equal(new Set(facts).size, facts.length);
    for (const text of facts) {
      assert.ok(text.length > 0 && text.length <= 70, text);
      checkMathFact(text, number);
    }
  }
});

test('every friend teaches operations, parity, factors, and accurate number categories', () => {
  const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23];
  const squares = [1, 4, 9, 16, 25];
  for (let number = 1; number <= CHARACTERS.length; number++) {
    const facts = getMathFacts(number);
    assert.ok(facts.some(text => /^\d+ \+ \d+ = /.test(text)));
    assert.ok(facts.some(text => /^\d+ - \d+ = /.test(text)));
    assert.ok(facts.includes(`${number * 2} divided by 2 is ${number}.`));
    assert.ok(facts.some(text => text.includes(number % 2 ? 'is odd:' : 'is even:')));
    assert.ok(facts.some(text => /^\d+ × \d+ = /.test(text)));
    assert.equal(facts.some(text => text.includes('is prime:')), primes.includes(number));
    assert.equal(facts.some(text => text.includes('is composite:')), number > 1 && !primes.includes(number));
    assert.equal(facts.some(text => text.includes('is a square number:')), squares.includes(number));
  }
});

test('shape statements distinguish current bodies from possible rearrangements', () => {
  assert.ok(getMathFacts(4).includes('I can arrange into a 2 by 2 square!'));
  assert.ok(!getMathFacts(4).includes('I am a 2 by 2 square!'), 'Four currently has a tall body');
  assert.ok(getMathFacts(9).includes('I am a 3 by 3 square!'));
  assert.ok(getMathFacts(15).includes('My 5 steps have 1 + 2 + 3 + 4 + 5 = 15 blocks.'));
  assert.ok(getMathFacts(16).includes('I am a 4 by 4 square!'));
  assert.ok(getMathFacts(16).includes('32 divided by 2 is 16.'));
  assert.ok(getMathFacts(16).includes('12 + 4 = 16.'));
  for (const definition of CHARACTERS) {
    if (definition.width * definition.height !== definition.number) {
      assert.ok(getMathFacts(definition.number).every(text => !text.startsWith('I am a ')), `${definition.name} has an incomplete bounding rectangle`);
    }
  }
});

test('Twenty-One through Twenty-Five describe their twenty-plus parts and actual layouts', () => {
  for (let number = 21; number <= 25; number++) {
    const facts = getMathFacts(number);
    assert.ok(facts.includes(`20 + ${number - 20} = ${number}.`));
    assert.ok(facts.includes(`${number * 2} divided by 2 is ${number}.`));
  }
  assert.ok(getMathFacts(21).includes('I am a 3 by 7 rectangle!'));
  assert.ok(getMathFacts(22).includes('2 × 11 = 22.'));
  assert.ok(getMathFacts(22).includes('I can arrange into a 2 by 11 rectangle!'));
  assert.ok(getMathFacts(22).every(text => !text.startsWith('I am a ')), 'two extra top cubes do not fill the bounding box');
  assert.ok(getMathFacts(23).includes('23 is prime: its only factors are 1 and 23.'));
  assert.ok(getMathFacts(23).every(text => !text.startsWith('I am a ')), 'three side cubes do not fill the bounding box');
  assert.ok(getMathFacts(24).includes('I am a 3 by 8 rectangle!'));
  assert.ok(getMathFacts(24).includes('3 × 8 = 24.'));
  assert.ok(getMathFacts(24).includes('4 × 6 = 24.'));
  assert.ok(getMathFacts(24).includes('I can arrange into a 4 by 6 rectangle!'));
  assert.ok(getMathFacts(25).includes('I am a 5 by 5 square!'));
  assert.ok(getMathFacts(25).includes('25 is a square number: 5 × 5 = 25.'));
});

test('the character range follows the data and invalid inputs safely fall back to One', () => {
  const highest = CHARACTERS.at(-1).number;
  assert.equal(highest, 25);
  assert.ok(getMathFacts(highest).includes(`I have ${highest} equal blocks.`));
  assert.deepEqual(getMathFacts(String(highest)), getMathFacts(highest));
  assert.notEqual(chooseRemark(highest, {}, () => 0).text, chooseRemark(1, {}, () => 0).text);
  for (const invalid of [0, -1, highest + 1, 1.5, NaN, Infinity, -Infinity, undefined, null, '', 'not a number', true, {}, [], Symbol('invalid')]) {
    assert.deepEqual(getMathFacts(invalid), getMathFacts(1));
    assert.deepEqual(chooseRemark(invalid, {}, () => 0), chooseRemark(1, {}, () => 0));
    assert.deepEqual(chooseRemark(invalid, { math: true }, () => .5), chooseRemark(1, { math: true }, () => .5));
  }
});

test('math mode guarantees a fact, preserves every emotion, and avoids repetition', () => {
  for (let number = 1; number <= CHARACTERS.length; number++) {
    const facts = getMathFacts(number);
    for (const emotion of moods) for (const place of [undefined, ...places]) {
      for (let index = 0; index < facts.length; index++) {
        const sample = (index + .5) / facts.length;
        const context = { math: true, emotion, place, moving: true, nearbyName: 'Twenty' };
        const first = chooseRemark(number, context, () => sample);
        assert.equal(first.kind, 'math');
        assert.equal(first.emotion, emotion);
        assert.equal(first.text, facts[index]);
        const second = chooseRemark(number, { ...context, lastText: first.text }, () => sample);
        assert.equal(second.kind, 'math');
        assert.equal(second.emotion, emotion);
        assert.ok(facts.includes(second.text));
        assert.notEqual(first.text, second.text);
      }
    }
  }
});

test('math mode is opt-in, deterministic, and has a safe unknown-number fallback', () => {
  const context = Object.freeze({ math: true, emotion: 'curious', place: 'summit', lastText: 'old fact' });
  assert.deepEqual(chooseRemark(20, context, () => .6), chooseRemark(20, context, () => .6));
  assert.deepEqual(chooseRemark(20, context, () => NaN), chooseRemark(20, context, () => 0));
  assert.deepEqual(getMathFacts(99), getMathFacts(1));
  assert.deepEqual(chooseRemark(99, { math: true }, () => 0), chooseRemark(1, { math: true }, () => 0));
  const ordinary = chooseRemark(20, { emotion: 'curious', place: 'summit' }, () => 0);
  assert.equal(ordinary.kind, undefined);
  assert.match(ordinary.text, /summit|deck/i);
  assert.deepEqual(ordinary, chooseRemark(20, { math: false, emotion: 'curious', place: 'summit' }, () => 0));
});
