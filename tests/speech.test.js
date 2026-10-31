import test from 'node:test';
import assert from 'node:assert/strict';
import { toSpokenMath } from '../dist/speech.js';
import { getMathFacts } from '../dist/personalities.js';

test('multiplication symbols and numeric x variants are spoken as times', () => {
  for (const written of ['2x10=20', '2×10=20', '2 X 10 =20', '2*10=20', '2 x 10 = 20']) {
    assert.equal(toSpokenMath(written), '2 times 10 equals 20', written);
  }
  assert.equal(toSpokenMath('Twenty: 2×10=20!'), 'Twenty: 2 times 10 equals 20!');
  assert.equal(toSpokenMath('width × height'), 'width times height');
  assert.equal(toSpokenMath('20-2x10=0'), '20 minus 2 times 10 equals 0');
  assert.equal(toSpokenMath('(2)x10=20'), '(2) times 10 equals 20');
});

test('subtraction, addition, division, and chained equations use natural operator words', () => {
  for (const minus of ['-', '−', '–']) {
    assert.equal(toSpokenMath(`21${minus}1=20.`), '21 minus 1 equals 20.');
    assert.equal(toSpokenMath(`21 ${minus} 1 = 20.`), '21 minus 1 equals 20.');
  }
  for (const divide of ['÷', '/']) assert.equal(toSpokenMath(`32${divide}2=16`), '32 divided by 2 equals 16');
  assert.equal(toSpokenMath('1+2+3+4+5=15.'), '1 plus 2 plus 3 plus 4 plus 5 equals 15.');
  assert.equal(toSpokenMath('12/3=4; 4*2=8!'), '12 divided by 3 equals 4; 4 times 2 equals 8!');
  assert.equal(toSpokenMath('2.5×4=10; .5+1.5=2.'), '2.5 times 4 equals 10; .5 plus 1.5 equals 2.');
  assert.equal(toSpokenMath('1,000-200=800'), '1,000 minus 200 equals 800');
});

test('unary negatives are distinguished from subtraction, including bracketed expressions', () => {
  assert.equal(toSpokenMath('5 - -2 = 7'), '5 minus negative 2 equals 7');
  assert.equal(toSpokenMath('5--2=7'), '5 minus negative 2 equals 7');
  assert.equal(toSpokenMath('5 − −2 = 7'), '5 minus negative 2 equals 7');
  assert.equal(toSpokenMath('-2×3=-6'), 'negative 2 times 3 equals negative 6');
  assert.equal(toSpokenMath('5+(-2)=3'), '5 plus (negative 2) equals 3');
  assert.equal(toSpokenMath('(5-(-2))=7'), '(5 minus (negative 2)) equals 7');
  assert.equal(toSpokenMath('2 X -3 = -6'), '2 times negative 3 equals negative 6');
  assert.equal(toSpokenMath('5 + +2 = 7'), '5 plus positive 2 equals 7');
  assert.equal(toSpokenMath('It is -2.'), 'It is negative 2.');
});

test('ordinary words, labels, hyphenated names, punctuation, and existing spoken facts are preserved', () => {
  for (const prose of [
    'Twenty-One is excited to explain a 4-by-4 square!',
    'Co-operate, X marks the spot, and x is a letter.',
    'half-time; a twenty-one-block shape; 4-by-4.',
    '32 divided by 2 is 16.',
    'I am a 4 by 4 square!',
    '23 is prime: its only factors are 1 and 23.',
    '1 is neither prime nor composite.',
    'Read and/or draw. Keep x=y and a-b as labels.',
    'sprite2x10 and 2x10px are identifiers.',
    'sprite2x10=20, a2.5x10, and 2x10px=20 are identifiers.',
    'Keep  ordinary spacing\nand punctuation: “hello!”',
  ]) assert.equal(toSpokenMath(prose), prose);
  assert.equal(toSpokenMath('Twenty-One: 22-1=21. Excited?'), 'Twenty-One: 22 minus 1 equals 21. Excited?');
});

test('every existing math fact for One through Twenty-Five has speakable operators and unchanged display text', () => {
  let arithmetic = 0, prose = 0;
  for (let number = 1; number <= 25; number++) {
    const facts = getMathFacts(number), original = [...facts];
    for (const fact of facts) {
      const spoken = toSpokenMath(fact);
      assert.doesNotMatch(spoken, /[×÷=+]|\d\s*[-−–*xX/]\s*\d/, `Unspoken operator in ${fact}`);
      assert.equal(toSpokenMath(spoken), spoken, 'Already normalized speech should be stable');
      if (/[×÷=+]|\d\s*[-−–*xX/]\s*\d/.test(fact)) arithmetic++;
      else { prose++; assert.equal(spoken, fact); }
      assert.equal(spoken.at(-1), fact.at(-1), 'Sentence punctuation should remain intact');
    }
    assert.deepEqual(facts, original, 'Preparing speech must not alter the displayed facts');
  }
  assert.ok(arithmetic > 100 && prose > 50, 'Exercise the complete dialogue catalog');
});

test('normalization is pure, browser-free, and handles empty input', () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(toSpokenMath(''), '');
  assert.equal(toSpokenMath(null), '');
  assert.equal(toSpokenMath(20), '20');
});
