import test from 'node:test';
import assert from 'node:assert/strict';
import { makePetCall, createPetAudio } from '../dist/pet-sounds.js';

test('cat and dog calls are finite, audible, distinct, bounded and fade out', () => {
  for (const rate of [8000, 24000, 48000]) for (const species of ['cat', 'dog']) {
    const samples = makePetCall(species, rate);
    let energy = 0, peak = 0;
    for (const sample of samples) { assert.ok(Number.isFinite(sample)); energy += sample * sample; peak = Math.max(peak, Math.abs(sample)); }
    assert.ok(Math.sqrt(energy / samples.length) > .04);
    assert.ok(peak < .5);
    assert.equal(samples[0], 0); assert.ok(Math.abs(samples.at(-1)) < .001);
  }
  assert.notDeepEqual(makePetCall('cat'), makePetCall('dog'));
  assert.notDeepEqual(makePetCall('cat', 24000, 0), makePetCall('cat', 24000, 1));
  assert.throws(() => makePetCall('fox'), RangeError);
  assert.throws(() => makePetCall('cat', NaN), RangeError);
});

test('muting stops active calls; browsers without audio still work', async () => {
  let started = 0, stopped = 0, contexts = 0;
  const audio = createPetAudio({ createContext: () => {
    contexts++;
    return { state: 'running', sampleRate: 8000, destination: {}, resume: async () => {},
      createBuffer: () => ({ copyToChannel() {} }),
      createBufferSource: () => ({ connect() {}, disconnect() {}, start() { started++; }, stop() { stopped++; } }),
      createGain: () => ({ gain: {}, connect() {}, disconnect() {} }),
    };
  } });
  assert.equal(audio.play('cat'), false); assert.equal(contexts, 0);
  audio.setMuted(false); await Promise.resolve();
  assert.equal(audio.play('cat'), true); assert.equal(started, 1);
  audio.setMuted(true); assert.equal(stopped, 1); assert.equal(audio.state.playing, false);
  assert.equal(audio.play('dog'), false); assert.equal(started, 1);
  const missing = createPetAudio({ createContext: () => { throw new Error('No audio'); } });
  assert.doesNotThrow(() => missing.setMuted(false)); assert.equal(missing.play('dog'), false);
});
