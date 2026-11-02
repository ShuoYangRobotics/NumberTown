/** Small, locally synthesized animal calls: no downloads or speech voices. */
export function makePetCall(species, sampleRate = 24000, variant = 0) {
  if (!['cat', 'dog'].includes(species)) throw new RangeError('Unknown pet call');
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new RangeError('Invalid sample rate');
  variant = Number.isFinite(variant) ? Math.trunc(variant) : 0;
  const cat = species === 'cat', duration = cat ? .78 : .55;
  const samples = new Float32Array(Math.ceil(sampleRate * duration));
  const variation = 1 + ((Math.abs(Math.trunc(variant)) % 5) - 2) * .025;
  let phase = 0, noise = 371 + Math.trunc(variant || 0), smoothNoise = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    // A voiced "mee-ow" glides up, then rounds down. Barks have two short,
    // breathy attacks and a falling low voice instead of a pure electronic beep.
    const local = cat ? t : t < .26 ? t : t - .29;
    const length = cat ? duration : .23;
    if (local < 0 || local > length) continue;
    const u = local / length;
    const frequency = (cat ? 440 + 220 * Math.sin(Math.PI * Math.min(1, u * 1.45)) - 140 * u : 220 - 95 * u) * variation;
    phase += 2 * Math.PI * frequency / sampleRate;
    const attack = Math.min(1, local / (cat ? .045 : .009));
    const release = Math.min(1, (length - local) / (cat ? .16 : .06));
    const envelope = attack * release * (cat ? .8 + .2 * Math.sin(Math.PI * u) : Math.exp(-u * 2.2));
    noise = (Math.imul(noise, 1664525) + 1013904223) | 0;
    const white = (noise >>> 0) / 2147483648 - 1;
    smoothNoise += .3 * (white - smoothNoise);
    let voice = 0;
    for (let harmonic = 1; harmonic <= (cat ? 8 : 12); harmonic++) {
      const formant = cat ? 1550 - 850 * u : 720 - 160 * u;
      const emphasis = .25 + Math.exp(-(((frequency * harmonic - formant) / (cat ? 500 : 620)) ** 2));
      voice += Math.sin(phase * harmonic) * emphasis / harmonic;
    }
    const breath = smoothNoise * (cat ? .035 : .7);
    samples[i] = Math.tanh((voice + breath) * (cat ? 1.3 : 2.1)) * envelope * .45;
  }
  return samples;
}

/** Unlock from a user gesture; calls respect the game's shared sound toggle. */
export function createPetAudio({ createContext = () => new (globalThis.AudioContext || globalThis.webkitAudioContext)() } = {}) {
  let context, muted = true;
  const buffers = new Map(), sources = new Set();
  const state = { unlocked: false, playing: false, calls: 0, lastSpecies: null };
  function stop() {
    for (const source of sources) { try { source.stop(); } catch {} }
    sources.clear(); state.playing = false;
  }
  function unlock() {
    if (muted) return;
    try {
      context ||= createContext();
      const ready = context.resume();
      Promise.resolve(ready).then(() => { state.unlocked = context.state === 'running'; }).catch(() => {});
    } catch { state.unlocked = false; }
  }
  function play(species, variant = 0) {
    if (muted || !context || context.state !== 'running' || !['cat', 'dog'].includes(species)) return false;
    stop();
    const key = `${species}:${Math.abs(Math.trunc(variant)) % 5}`;
    if (!buffers.has(key)) {
      const samples = makePetCall(species, context.sampleRate, variant);
      const buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.copyToChannel(samples, 0); buffers.set(key, buffer);
    }
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffers.get(key); gain.gain.value = .65;
    source.connect(gain); gain.connect(context.destination); sources.add(source);
    source.onended = () => { sources.delete(source); source.disconnect(); gain.disconnect(); state.playing = sources.size > 0; };
    source.start(); state.playing = true; state.calls++; state.lastSpecies = species;
    return true;
  }
  return { unlock, play, stop, state,
    setMuted(value) { muted = Boolean(value); if (muted) stop(); else unlock(); },
    dispose() { stop(); buffers.clear(); if (context) context.close(); },
  };
}
