import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeCatCall, createPetAudio } from '../dist/pet-sounds.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fixture({ loadBark, decode } = {}) {
  const stats = { loads: 0, decodes: 0, contexts: 0, closed: 0, sources: [], gains: [] };
  const recorded = { kind: 'recorded bark' };
  const context = { state: 'running', sampleRate: 24000, destination: {}, resume: async () => {},
    close: async () => { stats.closed++; context.state = 'closed'; },
    decodeAudioData: async data => { stats.decodes++; return decode ? decode(data) : recorded; },
    createBuffer: () => ({ kind: 'synthesized meow', copyToChannel() {} }),
    createBufferSource: () => {
      const source = { playbackRate: {}, started: 0, stopped: 0, disconnected: 0, connect() {},
        disconnect() { this.disconnected++; }, start() { this.started++; }, stop() { this.stopped++; } };
      stats.sources.push(source); return source;
    },
    createGain: () => {
      const gain = { gain: {}, disconnected: 0, connect() {}, disconnect() { this.disconnected++; } };
      stats.gains.push(gain); return gain;
    },
  };
  const audio = createPetAudio({ createContext: () => { stats.contexts++; return context; },
    loadBark: () => { stats.loads++; return loadBark ? loadBark() : new ArrayBuffer(8); } });
  return { audio, stats, recorded, context };
}

test('bundled recording contains two audible barks with quiet edges and no clipping', () => {
  const wav = readFileSync(new URL('../dist/assets/audio/dog-bark.wav', import.meta.url));
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF'); assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  let format, samples;
  for (let offset = 12; offset + 8 <= wav.length;) {
    const type = wav.toString('ascii', offset, offset + 4), size = wav.readUInt32LE(offset + 4);
    const chunk = wav.subarray(offset + 8, offset + 8 + size);
    if (type === 'fmt ') format = chunk;
    if (type === 'data') samples = Array.from({ length: size / 2 }, (_, i) => chunk.readInt16LE(i * 2) / 32768);
    offset += 8 + size + (size % 2);
  }
  assert.equal(format.readUInt16LE(0), 1); assert.equal(format.readUInt16LE(2), 1);
  const rate = format.readUInt32LE(4);
  assert.equal(rate, 24000); assert.equal(format.readUInt16LE(14), 16);
  assert.ok(samples.length / rate > .9 && samples.length / rate < 1.2);
  const rms = (from, to) => {
    const segment = samples.slice(from * rate, to * rate);
    return Math.sqrt(segment.reduce((sum, value) => sum + value * value, 0) / segment.length);
  };
  assert.ok(Math.max(...samples.map(Math.abs)) < .95);
  assert.ok(rms(.02, .22) > .08); assert.ok(rms(.63, .83) > .04);
  assert.ok(rms(.4, .5) < .005, 'a natural pause separates the woofs');
  assert.ok(Math.abs(samples[0]) < .001 && Math.abs(samples.at(-1)) < .001);
});

test('generated meows remain audible, bounded and gently fade', () => {
  for (const rate of [8000, 24000, 48000]) {
    const samples = makeCatCall(rate);
    let energy = 0, peak = 0;
    for (const sample of samples) { assert.ok(Number.isFinite(sample)); energy += sample * sample; peak = Math.max(peak, Math.abs(sample)); }
    assert.ok(Math.sqrt(energy / samples.length) > .04); assert.ok(peak < .5);
    assert.equal(samples[0], 0); assert.ok(Math.abs(samples.at(-1)) < .001);
  }
  assert.notDeepEqual(makeCatCall(24000, 0), makeCatCall(24000, 1));
  assert.throws(() => makeCatCall(NaN), RangeError);
});

test('sound stays opt-in and the recording is decoded once then reused for different dogs', async () => {
  const { audio, stats, recorded } = fixture();
  audio.unlock(); assert.equal(audio.play('dog'), false);
  assert.equal(stats.contexts, 0); assert.equal(stats.loads, 0);
  audio.setMuted(false); await tick();
  assert.equal(audio.state.bark, 'ready'); assert.equal(audio.state.unlocked, true);
  for (const variant of [0, 1, 2, 3, 4, NaN]) { audio.unlock(); assert.equal(audio.play('dog', variant), true); }
  await tick();
  assert.equal(stats.loads, 1); assert.equal(stats.decodes, 1); assert.equal(stats.contexts, 1);
  assert.equal(audio.state.calls, 6); assert.equal(audio.state.lastSpecies, 'dog');
  for (const source of stats.sources) {
    assert.equal(source.buffer, recorded); assert.equal(source.started, 1);
    assert.ok(source.playbackRate.value >= .96 && source.playbackRate.value <= 1.04);
  }
  assert.equal(new Set(stats.sources.map(source => source.playbackRate.value)).size, 5);
  const last = stats.sources.at(-1); last.onended();
  assert.equal(last.disconnected, 1); assert.equal(audio.state.playing, false);
  assert.equal(audio.play('fox'), false);
  audio.dispose();
});

test('an early greeting waits for decode but only the newest request plays', async () => {
  const ready = deferred(), { audio, stats, recorded } = fixture({ decode: () => ready.promise });
  audio.setMuted(false); await tick();
  audio.play('dog', 1); audio.play('dog', 4);
  assert.equal(audio.state.pending, true); assert.equal(stats.sources.length, 0);
  ready.resolve(recorded); await tick();
  assert.equal(audio.state.pending, false); assert.equal(audio.state.playing, true);
  assert.equal(stats.sources.length, 1); assert.equal(stats.sources[0].playbackRate.value, 1.02);
  audio.dispose();
});

for (const action of ['mute', 'stop', 'cat', 'dispose']) {
  test(`${action} cancels a dog greeting still loading without reviving it later`, async () => {
    const ready = deferred(), { audio, stats } = fixture({ loadBark: () => ready.promise });
    audio.setMuted(false); audio.play('dog'); await tick();
    assert.equal(audio.state.pending, true);
    if (action === 'mute') audio.setMuted(true);
    if (action === 'stop') audio.stop();
    if (action === 'cat') audio.play('cat');
    if (action === 'dispose') audio.dispose();
    ready.resolve(new ArrayBuffer(8)); await tick();
    assert.equal(audio.state.pending, false);
    assert.equal(stats.sources.length, action === 'cat' ? 1 : 0);
    if (action === 'cat') assert.equal(stats.sources[0].buffer.kind, 'synthesized meow');
    if (action === 'dispose') {
      assert.equal(stats.closed, 1); assert.equal(stats.decodes, 0); assert.equal(audio.state.unlocked, false);
      audio.setMuted(false); assert.equal(audio.play('dog'), false); assert.equal(stats.contexts, 1);
    } else audio.dispose();
  });
}

test('muting disconnects active calls and unmutes without replaying an old bark', async () => {
  const { audio, stats } = fixture(); audio.setMuted(false); await tick(); audio.play('dog');
  audio.setMuted(true);
  assert.equal(stats.sources[0].stopped, 1); assert.equal(stats.sources[0].disconnected, 1);
  assert.equal(stats.gains[0].disconnected, 1); assert.equal(audio.state.playing, false);
  stats.sources[0].onended(); assert.equal(stats.sources[0].disconnected, 1);
  assert.equal(audio.play('cat'), false); audio.setMuted(false); await tick();
  assert.equal(audio.state.calls, 1); assert.equal(audio.state.playing, false); audio.dispose();
});

test('failed audio fetch/decode and missing browser audio do not break other play', async () => {
  for (const options of [ { loadBark: () => Promise.reject(new Error('offline missing file')) },
    { decode: () => Promise.reject(new Error('invalid audio')) } ]) {
    const { audio, stats } = fixture(options); audio.setMuted(false); audio.play('dog'); await tick();
    assert.equal(audio.state.pending, false); assert.equal(audio.state.bark, 'unavailable');
    assert.equal(audio.state.calls, 0); assert.equal(audio.play('cat'), true); assert.equal(stats.sources.length, 1);
    audio.dispose();
  }
  const missing = createPetAudio({ createContext: () => { throw new Error('No audio'); } });
  assert.doesNotThrow(() => missing.setMuted(false)); assert.equal(missing.play('dog'), false); missing.dispose();
});
