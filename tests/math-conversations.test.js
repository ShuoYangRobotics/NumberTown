import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../dist/character-data.js';
import { EMOTIONS, chooseRemark, getMathConversationFacts, getMathFacts } from '../dist/personalities.js';
import { toSpokenMath } from '../dist/speech.js';

function verify(text, selected, nearby) {
  const arithmetic = text.match(/^(\d+) ([+×-]) (\d+) = (\d+)\.$/);
  const division = text.match(/^(\d+) divided by (\d+) is (\d+)\.$/);
  assert.ok(arithmetic || division, text);
  const a = +(arithmetic?.[1] ?? division[1]), b = +(arithmetic?.[3] ?? division[2]);
  const result = +(arithmetic?.[4] ?? division[3]);
  assert.deepEqual([a, b].sort((x, y) => x - y), [selected, nearby].sort((x, y) => x - y), 'every conversational operation must use the actual two friends');
  if (division) { assert.ok(b > 0); assert.equal(a % b, 0); assert.equal(a / b, result); }
  else assert.equal(arithmetic[2] === '+' ? a + b : arithmetic[2] === '×' ? a * b : a - b, result);
  assert.ok(Number.isSafeInteger(result) && result >= 0);
  assert.ok(text.length <= 70);
  assert.doesNotMatch(toSpokenMath(text), /[×+÷=]|\d\s*-\s*\d/);
}

test('all pairs of Zero through Fifty have truthful arithmetic using only those two identities', () => {
  assert.equal(CHARACTERS.length, 51);
  for (const { number: a } of CHARACTERS) for (const { number: b } of CHARACTERS) {
    const facts = getMathConversationFacts(a, b);
    assert.ok(Object.isFrozen(facts));
    assert.deepEqual(facts, getMathConversationFacts(String(a), String(b)));
    if (a === b) { assert.deepEqual(facts, []); continue; }
    assert.ok(facts.length >= 5); assert.equal(new Set(facts).size, facts.length);
    for (const text of facts) verify(text, a, b);
    assert.ok(facts.includes(`${a} + ${b} = ${a + b}.`));
    assert.ok(facts.includes(`${a} × ${b} = ${a * b}.`));
    assert.ok(facts.includes(`${Math.max(a, b)} - ${Math.min(a, b)} = ${Math.abs(a - b)}.`));
    assert.equal(facts.includes(`${a} divided by ${b} is ${a / b}.`), b > 0 && a % b === 0);
    assert.equal(facts.includes(`${b} divided by ${a} is ${b / a}.`), a > 0 && b % a === 0);
  }
});

test('Thirty and Five offer multiplication and exact division in either selection order', () => {
  for (const [a, b] of [[30, 5], [5, 30]]) {
    const facts = getMathConversationFacts(a, b);
    assert.ok(facts.includes('30 × 5 = 150.'));
    assert.ok(facts.includes('5 × 30 = 150.'));
    assert.ok(facts.includes('30 divided by 5 is 6.'));
    assert.ok(facts.includes('30 - 5 = 25.'));
    assert.ok(facts.every(text => !text.startsWith('5 divided by 30')));
  }
});

test('a valid nearby number guarantees conversational math, all moods survive, and lastText prevents repeats', () => {
  for (const { number: a } of CHARACTERS) for (const { number: b } of CHARACTERS) {
    if (a === b) continue;
    const facts = getMathConversationFacts(a, b);
    for (const { id: emotion } of EMOTIONS) for (let index = 0; index < facts.length; index++) {
      const context = Object.freeze({ math: true, nearbyNumber: b, emotion, place: 'library', moving: true });
      const random = () => (index + .5) / facts.length;
      const first = chooseRemark(a, context, random);
      assert.deepEqual(first, { text: facts[index], emotion, kind: 'math' });
      const next = chooseRemark(a, { ...context, lastText: first.text }, random);
      assert.notEqual(next.text, first.text); assert.ok(facts.includes(next.text));
      assert.equal(next.emotion, emotion); assert.equal(next.kind, 'math');
    }
  }
});

test('Zero is a real conversation partner and never introduces division by zero', () => {
  for (const number of [1, 5, 30, 50]) for (const pair of [[0, number], [number, 0]]) {
    const facts = getMathConversationFacts(...pair);
    assert.ok(facts.includes(`0 divided by ${number} is 0.`));
    assert.ok(facts.every(text => !/divided by 0\b|Infinity|NaN/.test(text)));
    const selected = chooseRemark(pair[0], { math: true, nearbyNumber: pair[1] }, () => 0);
    assert.ok(facts.includes(selected.text));
  }
});

test('invalid and self-neighbors fall back to solo math and proximity never changes ordinary dialogue', () => {
  const invalid = [-1, 51, 3.5, NaN, Infinity, undefined, null, '', ' ', true, {}, [], Symbol('invalid')];
  for (const nearbyNumber of [...invalid, 30]) {
    assert.deepEqual(getMathConversationFacts(30, nearbyNumber), []);
    assert.deepEqual(chooseRemark(30, { math: true, nearbyNumber }, () => .3), chooseRemark(30, { math: true }, () => .3));
  }
  for (const number of invalid) assert.deepEqual(getMathConversationFacts(number, 5), []);
  const ordinary = { emotion: 'curious', place: 'library' };
  assert.deepEqual(chooseRemark(30, { ...ordinary, nearbyNumber: 5 }, () => .2), chooseRemark(30, ordinary, () => .2));
  const context = { math: true, nearbyNumber: 5 };
  assert.deepEqual(chooseRemark(30, context, () => NaN), chooseRemark(30, context, () => 0));
  assert.deepEqual(chooseRemark(30, context, () => -5), chooseRemark(30, context, () => 0));
  assert.deepEqual(chooseRemark(30, context, () => 5), chooseRemark(30, context, () => 1));
  assert.ok(getMathFacts(30).includes('11 + 19 = 30.'), 'nearby interactions do not replace solo arithmetic');
});
