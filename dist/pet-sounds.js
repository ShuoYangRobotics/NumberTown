/** A locally generated, gently gliding meow. Dogs use a real recorded bark. */
export function makeCatCall(sampleRate = 24000, variant = 0) {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new RangeError('Invalid sample rate');
  variant = Number.isFinite(variant) ? Math.trunc(variant) : 0;
  const duration = .78, samples = new Float32Array(Math.ceil(sampleRate * duration));
  const variation = 1 + ((Math.abs(variant) % 5) - 2) * .025;
  let phase = 0, noise = 371 + variant, smoothNoise = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate, u = t / duration;
    const frequency = (440 + 220 * Math.sin(Math.PI * Math.min(1, u * 1.45)) - 140 * u) * variation;
    phase += 2 * Math.PI * frequency / sampleRate;
    const envelope = Math.min(1, t / .045) * Math.min(1, (duration - t) / .16) * (.8 + .2 * Math.sin(Math.PI * u));
    noise = (Math.imul(noise, 1664525) + 1013904223) | 0;
    smoothNoise += .3 * ((noise >>> 0) / 2147483648 - 1 - smoothNoise);
    let voice = 0;
    for (let harmonic = 1; harmonic <= 8; harmonic++) {
      const emphasis = .25 + Math.exp(-(((frequency * harmonic - (1550 - 850 * u)) / 500) ** 2));
      voice += Math.sin(phase * harmonic) * emphasis / harmonic;
    }
    samples[i] = Math.tanh((voice + smoothNoise * .035) * 1.3) * envelope * .45;
  }
  return samples;
}

async function loadRecordedBark() {
  // Bundled with the game: no third-party requests or speech voice dependency.
  const response = await fetch(new URL('./assets/audio/dog-bark.wav', import.meta.url));
  if (!response.ok) throw new Error('Bark recording unavailable');
  return response.arrayBuffer();
}

/** Unlock from a user gesture; cancel pending as well as playing calls on stop. */
export function createPetAudio({
  createContext = () => new (globalThis.AudioContext || globalThis.webkitAudioContext)(),
  loadBark = loadRecordedBark,
} = {}) {
  let context, muted = true, disposed = false, requestId = 0, barkPromise, barkBuffer;
  const buffers = new Map(), sources = new Map();
  const state = { unlocked: false, playing: false, pending: false, bark: 'idle', calls: 0, lastSpecies: null };
  function finish(source) {
    const gain = sources.get(source);
    if (!gain) return;
    sources.delete(source); source.disconnect(); gain.disconnect();
    state.playing = sources.size > 0;
  }
  function stop() {
    requestId++; state.pending = false;
    for (const source of sources.keys()) { try { source.stop(); } catch {} finish(source); }
    state.playing = false;
  }
  function prepareBark() {
    if (!barkPromise) {
      state.bark = 'loading';
      barkPromise = Promise.resolve().then(loadBark).then(data => disposed ? null : context.decodeAudioData(data))
        .then(buffer => {
          if (disposed) return null;
          barkBuffer = buffer; state.bark = 'ready'; return buffer;
        }).catch(() => { if (!disposed) state.bark = 'unavailable'; return null; });
    }
    return barkPromise;
  }
  function unlock() {
    if (muted || disposed) return;
    try {
      context ||= createContext();
      Promise.resolve(context.resume()).then(() => {
        if (!disposed) state.unlocked = context.state === 'running';
      }).catch(() => { state.unlocked = false; });
      prepareBark();
    } catch { state.unlocked = false; }
  }
  function start(buffer, species, variant, id) {
    if (!buffer || disposed || muted || id !== requestId || context.state !== 'running') return;
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer;
    // Small size differences between dogs preserve the recording's natural sound.
    source.playbackRate.value = species === 'dog' ? [1, .96, 1.04, .98, 1.02][variant] : 1;
    gain.gain.value = species === 'dog' ? .8 : .65;
    source.connect(gain); gain.connect(context.destination); sources.set(source, gain);
    source.onended = () => finish(source);
    source.start(); state.playing = true; state.calls++; state.lastSpecies = species;
  }
  function play(species, variant = 0) {
    if (disposed || muted || !context || context.state !== 'running' || !['cat', 'dog'].includes(species)) return false;
    stop();
    const id = requestId;
    variant = Number.isFinite(variant) ? Math.abs(Math.trunc(variant)) % 5 : 0;
    if (species === 'dog') {
      if (barkBuffer) start(barkBuffer, species, variant, id);
      else {
        state.pending = true;
        prepareBark().then(buffer => {
          if (id !== requestId || disposed) return;
          state.pending = false; start(buffer, species, variant, id);
        });
      }
    } else {
      if (!buffers.has(variant)) {
        const samples = makeCatCall(context.sampleRate, variant);
        const buffer = context.createBuffer(1, samples.length, context.sampleRate);
        buffer.copyToChannel(samples, 0); buffers.set(variant, buffer);
      }
      start(buffers.get(variant), species, variant, id);
    }
    return true;
  }
  return { unlock, play, stop, state,
    setMuted(value) { muted = Boolean(value); if (muted) stop(); else unlock(); },
    dispose() {
      disposed = true; stop(); buffers.clear(); barkBuffer = null; state.unlocked = false;
      if (context) Promise.resolve(context.close()).catch(() => {});
    },
  };
}
