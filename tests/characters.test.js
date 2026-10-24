import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, drawCharacter, getCharacterMetrics } from '../dist/characters.js';

const emotions = ['happy', 'excited', 'curious', 'surprised', 'sleepy', 'sad'];

// Deliberately strict Canvas 2D stand-in: every geometry input must be finite,
// gradients must be usable, and clipping/transforms must restore their state.
function recordingCanvas() {
  const calls = [];
  const gradients = [];
  const stack = [];
  const state = {};
  const methods = {};
  const geometry = ['translate', 'rotate', 'moveTo', 'lineTo', 'arcTo', 'ellipse', 'quadraticCurveTo', 'bezierCurveTo', 'fillRect'];
  for (const name of geometry) {
    methods[name] = (...args) => {
      assert.ok(args.every(Number.isFinite), `${name} received non-finite geometry: ${args}`);
      if (name === 'ellipse') assert.ok(args[2] > 0 && args[3] > 0, 'eye and shoe radii must be positive');
      calls.push([name, ...args]);
    };
  }
  for (const name of ['beginPath', 'closePath', 'fill', 'stroke', 'clip']) {
    methods[name] = () => calls.push([name]);
  }
  methods.save = () => { stack.push({ ...state }); calls.push(['save']); };
  methods.restore = () => {
    assert.ok(stack.length > 0, 'restore must have a matching save');
    const previous = stack.pop();
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, previous);
    calls.push(['restore']);
  };
  methods.createLinearGradient = (...args) => {
    assert.ok(args.every(Number.isFinite), 'gradient coordinates must be finite');
    const gradient = {
      args, stops: [],
      addColorStop(offset, color) {
        assert.ok(Number.isFinite(offset) && offset >= 0 && offset <= 1);
        assert.equal(typeof color, 'string');
        this.stops.push([offset, color]);
      },
    };
    gradients.push(gradient);
    return gradient;
  };
  for (const name of ['strokeText', 'fillText']) {
    methods[name] = (text, x, y) => {
      assert.equal(typeof text, 'string');
      assert.ok(Number.isFinite(x) && Number.isFinite(y));
      calls.push([name, text, x, y]);
    };
  }
  const ctx = new Proxy({}, {
    get(_, key) {
      if (key in methods) return methods[key];
      if (key in state) return state[key];
      throw new Error(`Unexpected Canvas API: ${String(key)}`);
    },
    set(_, key, value) {
      if (typeof value === 'number') assert.ok(Number.isFinite(value), `invalid ${String(key)}`);
      state[key] = value;
      calls.push(['set', key, typeof value === 'object' ? 'gradient' : value]);
      return true;
    },
  });
  return { ctx, calls, gradients, stack };
}

test('all ten friends have distinct metadata and the reference block layouts', () => {
  assert.deepEqual(CHARACTERS.map(friend => friend.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(CHARACTERS.map(({ cols, rows }) => [cols, rows]), [
    [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [2, 3], [1, 7], [2, 4], [3, 3], [2, 5],
  ]);
  assert.equal(new Set(CHARACTERS.map(friend => friend.name)).size, 10);
  for (const friend of CHARACTERS) {
    assert.equal(friend.cols * friend.rows, friend.number, `${friend.name} has the wrong block count`);
    assert.match(friend.color, /^#[0-9a-f]{6}$/i);
    assert.match(friend.dark, /^#[0-9a-f]{6}$/i);
    assert.ok(friend.description.length > 10);
  }
});

test('rendered square fronts match the count and grid of every number', () => {
  for (const friend of CHARACTERS) {
    const canvas = recordingCanvas();
    const size = 31;
    drawCharacter(canvas.ctx, friend.number, 0, 0, { blockSize: size, preview: true });
    // Front-face gradients have three color stops; the translucent highlights
    // have two. Inspect the actual front positions, not only the metadata.
    const fronts = canvas.gradients.filter(gradient => gradient.stops.length === 3);
    assert.equal(fronts.length, friend.number, `${friend.name} should render exactly ${friend.number} fronts`);
    assert.equal(new Set(fronts.map(({ args }) => args[0])).size, friend.cols);
    assert.equal(new Set(fronts.map(({ args }) => args[1])).size, friend.rows);
    for (const { args: [x1, y1, x2, y2] } of fronts) {
      assert.ok(Math.abs(x2 - x1 - size) < 1e-9, `${friend.name} front is not square`);
      assert.ok(Math.abs(y2 - y1 - size) < 1e-9, `${friend.name} front is not square`);
    }
  }
});

test('metrics use body rows, scale consistently, and leave room for art', () => {
  for (const friend of CHARACTERS) {
    for (const size of [12, 22, 32, 48]) {
      const metrics = getCharacterMetrics(friend.number, size);
      assert.equal(metrics.columns, friend.cols);
      assert.equal(metrics.rows, friend.rows);
      assert.equal(metrics.width, size * friend.cols);
      assert.equal(metrics.height, size * friend.rows);
      assert.ok(metrics.visualWidth > metrics.width, 'limbs need room beyond the body');
      assert.ok(metrics.visualHeight > metrics.height + size, 'feet, number, and decorations need headroom');
      const double = getCharacterMetrics(friend.number, size * 2);
      assert.equal(double.visualWidth, 2 * metrics.visualWidth);
      assert.equal(double.visualHeight, 2 * metrics.visualHeight);
    }
  }
  assert.ok(getCharacterMetrics(7).height > getCharacterMetrics(10).height, 'Seven is taller than the two-column Ten');
  assert.ok(getCharacterMetrics(9).width > getCharacterMetrics(8).width, 'Nine is the widest rectangular body');
});

test('all ten friends render every emotion while idle, walking, and jumping', () => {
  for (const friend of CHARACTERS) {
    for (const emotion of emotions) {
      for (const options of [
        { preview: true },
        { moving: true, facing: -1, selected: true },
        { moving: true, jump: 37, showNumber: false },
      ]) {
        const canvas = recordingCanvas();
        drawCharacter(canvas.ctx, friend.number, 120, 260, { ...options, blockSize: 27, time: 3.71, emotion });
        assert.equal(canvas.stack.length, 0, `${friend.name}/${emotion} leaked a canvas transform or clip`);
        assert.ok(canvas.calls.length > 50, `${friend.name}/${emotion} produced no usable art`);
        const numerals = canvas.calls.filter(([name]) => name === 'fillText');
        assert.deepEqual(numerals.map(([, text]) => text), options.showNumber === false ? [] : [String(friend.number)]);
      }
    }
  }
});

test('each emotion visibly changes each character drawing', () => {
  for (const friend of CHARACTERS) {
    const drawings = emotions.map(emotion => {
      const canvas = recordingCanvas();
      drawCharacter(canvas.ctx, friend.number, 0, 0, { emotion, time: 0, preview: true });
      return JSON.stringify(canvas.calls);
    });
    assert.equal(new Set(drawings).size, emotions.length, `${friend.name} has indistinguishable emotion drawings`);
  }
});

test('unknown emotion safely falls back to the happy expression', () => {
  for (const number of [1, 6, 7, 8, 9, 10]) {
    const happy = recordingCanvas();
    const unknown = recordingCanvas();
    drawCharacter(happy.ctx, number, 0, 0, { emotion: 'happy', preview: true });
    drawCharacter(unknown.ctx, number, 0, 0, { emotion: 'unknown', preview: true });
    assert.deepEqual(unknown.calls, happy.calls);
  }
});
