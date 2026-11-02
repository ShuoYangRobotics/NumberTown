import test from 'node:test';
import assert from 'node:assert/strict';
import { createNumberEncounters } from '../dist/number-encounters.js';
import { chooseRemark, getMathConversationFacts } from '../dist/personalities.js';

const friend = (number, changes = {}) => ({ number, x: 0, y: 0, z: 0, radius: .6, height: 1, visible: true, onFoot: true, ...changes });

test('the nearest eligible visible friend is selected by body-edge distance, with stable ties', () => {
  const thirty = friend(30), five = friend(5, { x: 5 }), wide = friend(40, { x: 10, radius: 7 });
  const encounter = createNumberEncounters().update(thirty, [five, wide, thirty], 0);
  assert.equal(encounter.speaker, 30); assert.equal(encounter.nearbyNumber, 40);
  assert.ok(encounter.edgeDistance < 3); assert.equal(encounter.newMeeting, true);
  assert.ok(Object.isFrozen(encounter));
  const tied = [friend(7, { x: 4 }), friend(2, { z: 4 })];
  assert.equal(createNumberEncounters().update(thirty, tied, 0).nearbyNumber, 2);
  assert.equal(createNumberEncounters().update(thirty, [...tied].reverse(), 0).nearbyNumber, 2);
  assert.equal(createNumberEncounters().update(thirty, [friend(5, { x: 50 })], 0), null);
});

test('vertical proximity uses real body spans for swimming, jumps and tall transformations', () => {
  const surface = friend(5), deep = friend(30, { y: -18, height: 2 });
  assert.equal(createNumberEncounters().update(surface, [deep], 0), null);
  assert.equal(createNumberEncounters().update(deep, [surface], 0), null);
  assert.ok(createNumberEncounters().update(friend(30, { y: -18, height: 30 }), [surface], 0), 'a tall body beside the surface friend really overlaps');
  assert.ok(createNumberEncounters().update(friend(0, { y: -18 }), [friend(50, { y: -18 })], 0));
  assert.ok(createNumberEncounters().update(friend(0, { y: 1.5 }), [surface], 0), 'a small jump should not hide a nearby friend');
  assert.equal(createNumberEncounters().update(friend(0, { y: 15 }), [surface], 0), null, 'a far higher deck must not count as a meeting');
  assert.equal(createNumberEncounters().update(friend(0), [friend(5, { x: 7, y: 3 })], 0), null, 'combined edge and vertical distance matters');
});

test('hidden train riders and invalid poses cannot talk or qualify as a neighbor', () => {
  const selected = friend(0), nearby = friend(5, { x: 2 });
  for (const unavailable of [{ visible: false }, { onFoot: false }, { y: NaN }, { radius: -1 }, { height: 0 }, { number: 51 }]) {
    assert.equal(createNumberEncounters().update({ ...selected, ...unavailable }, [nearby], 0), null);
    assert.equal(createNumberEncounters().update(selected, [{ ...nearby, ...unavailable }], 0), null);
  }
  for (const time of [-1, NaN, Infinity]) assert.equal(createNumberEncounters().update(selected, [nearby], time), null);
  assert.equal(createNumberEncounters().update(selected, null, 0), null);
});

test('global and unordered-pair cooldowns survive switching, leaving and returning', () => {
  const encounters = createNumberEncounters(), thirty = friend(30), five = friend(5, { x: 2 }), seven = friend(7, { x: 3 });
  assert.equal(encounters.update(thirty, [five], 0).nearbyNumber, 5);
  assert.equal(encounters.update(thirty, [], 1), null);
  assert.equal(encounters.update(five, [thirty, seven], 11.9), null);
  assert.equal(encounters.update(five, [thirty], 12), null, 'reversing selection cannot bypass the same pair cooldown');
  assert.equal(encounters.update(thirty, [seven], 12).nearbyNumber, 7);
  assert.equal(encounters.update(thirty, [five], 44.9), null);
  assert.equal(encounters.update(thirty, [five], 45).nearbyNumber, 5);
});

test('pending new meetings survive speech deferral, but departed friends are never spoken about later', () => {
  const encounters = createNumberEncounters(), selected = friend(30), near = friend(5, { x: 2 });
  encounters.noteSpeech(0);
  assert.equal(encounters.update(selected, [near], 3, { allowSpeech: false }), null);
  assert.equal(encounters.update(selected, [near], 11.9), null);
  assert.equal(encounters.update(selected, [near], 12, { allowSpeech: false }), null, 'voice playback can remain busy beyond the time gap');
  assert.equal(encounters.update(selected, [near], 14).nearbyNumber, 5);
  encounters.update(selected, [friend(7, { x: 2 })], 15, { allowSpeech: false });
  assert.equal(encounters.update(selected, [], 30), null);
  assert.equal(encounters.state().nearby.length, 0);
});

test('continuous neighbors speak again only on a periodic request after the pair cooldown', () => {
  const encounters = createNumberEncounters(), selected = friend(30), others = [friend(5, { x: 2 })];
  assert.ok(encounters.update(selected, others, 0));
  assert.equal(encounters.update(selected, others, 60), null, 'standing still is not a new meeting');
  assert.equal(encounters.update(selected, others, 60, { periodic: true, allowSpeech: false }), null);
  const repeat = encounters.update(selected, others, 60, { periodic: true });
  assert.equal(repeat.nearbyNumber, 5); assert.equal(repeat.newMeeting, false);
  assert.equal(encounters.update(selected, others, 61, { periodic: true }), null);
});

test('all speech extends the shared quiet interval without consuming a pending number pair', () => {
  const encounters = createNumberEncounters(), selected = friend(0), others = [friend(50, { x: 2 })];
  encounters.update(selected, others, 0, { allowSpeech: false });
  encounters.noteSpeech(0); encounters.noteSpeech(8);
  assert.equal(encounters.update(selected, others, 19.9), null);
  assert.equal(encounters.state().nearby[0].eligibleAt, 0);
  assert.equal(encounters.update(selected, others, 20).nearbyNumber, 50);
});

test('the selected-only conversation pipeline alternates solo and nearby facts without interruptions', () => {
  const encounters = createNumberEncounters(), selected = friend(30), neighbors = [friend(5, { x: 2 })];
  let lastMathMode = 'solo', lastText = '', spoken = [];
  function speakAt(time, periodic, busy = false) {
    const meeting = encounters.update(selected, neighbors, time, { allowSpeech: !busy && lastMathMode !== 'nearby', periodic });
    if (busy || !meeting && !periodic) return;
    const next = chooseRemark(selected.number, { math: true, nearbyNumber: meeting?.nearbyNumber, lastText }, () => .7);
    lastMathMode = meeting ? 'nearby' : 'solo'; lastText = next.text;
    encounters.noteSpeech(time); spoken.push({ speaker: selected.number, mode: lastMathMode, text: next.text });
  }
  speakAt(0, false); speakAt(14, false, true); speakAt(18, true); speakAt(46, true); speakAt(64, true);
  assert.deepEqual(spoken.map(item => item.mode), ['nearby', 'solo', 'nearby', 'solo']);
  assert.ok(spoken.every(item => item.speaker === 30));
  assert.ok(spoken.filter(item => item.mode === 'nearby').every(item => getMathConversationFacts(30, 5).includes(item.text)));
});

test('debug snapshots are immutable and a restarted clock or explicit reset starts fresh', () => {
  const encounters = createNumberEncounters(), selected = friend(0), neighbors = [friend(5, { x: 2 })];
  encounters.update(selected, neighbors, 100);
  const state = encounters.state();
  assert.ok(Object.isFrozen(state) && Object.isFrozen(state.nearby) && Object.isFrozen(state.nearby[0]));
  assert.equal(state.selected, 0); assert.equal(state.lastPair.speaker, 0); assert.equal(state.nextAllowedAt, 112);
  assert.ok(encounters.update(selected, neighbors, 0));
  encounters.reset(); assert.equal(encounters.state().lastPair, null);
  assert.ok(encounters.update(selected, neighbors, 0));
});
