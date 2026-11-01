import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { WATER_PLAY } from '../dist/geography.js';
import { waterPlayHeight } from '../dist/terrain-data.js';
import { CHARACTERS, getCharacterMetrics } from '../dist/character-data.js';
import { getCharacterArrangements } from '../dist/arrangements.js';
import {
  WATER_BALL_RADIUS, createWaterBallState, resetWaterBall, stepWaterBall,
  pickUpWaterBall, updateHeldWaterBall, releaseWaterBall, throwWaterBall, createWaterBall,
} from '../dist/water-ball.js';

const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const player = (overrides = {}) => ({ number: 1, x: WATER_PLAY.spawn.x, z: WATER_PLAY.spawn.z - 1, yaw: 0, height: 1, width: 1, depth: 1, radius: .7, groundY: -.15, jump: 0, ...overrides });
function deepCarrier(overrides = {}) {
  const carrier = player({ z: WATER_PLAY.shoreZ + WATER_PLAY.depthRamp + 20, ...overrides });
  carrier.groundY = waterPlayHeight(carrier.x, carrier.z);
  return carrier;
}
function submergedBall(carrier) {
  const state = createWaterBallState();
  Object.assign(state, { x: carrier.x, z: carrier.z, y: carrier.groundY + WATER_BALL_RADIUS, mode: 'rising' });
  return state;
}
function assertInBay(state) {
  assert.ok(state.x >= WATER_PLAY.xMin + WATER_BALL_RADIUS && state.x <= WATER_PLAY.xMax - WATER_BALL_RADIUS, `x ${state.x}`);
  assert.ok(state.z >= WATER_PLAY.beachZ + WATER_BALL_RADIUS && state.z <= WATER_PLAY.deepZ - WATER_BALL_RADIUS, `z ${state.z}`);
  for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'time', 'rollX', 'rollZ', 'splash']) assert.ok(Number.isFinite(state[key]), key);
}
function simulate(state, seconds, fps = 60) {
  for (let frame = 0; frame < Math.round(seconds * fps); frame++) stepWaterBall(state, 1 / fps);
  return state;
}

test('the beach ball starts afloat in the shallow bay and reset restores its complete state', () => {
  const state = createWaterBallState();
  assert.equal(state.x, WATER_PLAY.spawn.x); assert.equal(state.z, WATER_PLAY.spawn.z);
  assert.equal(state.radius, WATER_BALL_RADIUS); assert.equal(state.mode, 'floating'); assert.equal(state.heldBy, null);
  assert.ok(state.y > WATER_PLAY.waterY && state.y < WATER_PLAY.waterY + WATER_BALL_RADIUS);
  state.heldBy = 0; state.vx = 20; state.throws = 7;
  assert.equal(resetWaterBall(state), state); assert.deepEqual(state, createWaterBallState());
});

test('pickup respects horizontal reach and height, and Zero can hold without another friend stealing', () => {
  const state = createWaterBallState();
  assert.equal(pickUpWaterBall(state, player({ x: state.x + 3.1, z: state.z })), false);
  assert.equal(pickUpWaterBall(state, player({ x: state.x + 4.5, z: state.z, radius: 2.7 })), true, 'wide friends can reach nearby balls');
  releaseWaterBall(state);
  resetWaterBall(state); state.y = 7;
  assert.equal(pickUpWaterBall(state, player()), false, 'a ball high in its arc cannot be caught from the sand');
  resetWaterBall(state);
  const zero = player({ number: 0, height: .65, radius: .55 });
  assert.equal(pickUpWaterBall(state, zero), true); assert.equal(state.heldBy, 0); assert.equal(state.mode, 'held');
  assert.equal(pickUpWaterBall(state, player()), false); assert.equal(state.heldBy, 0);
  assert.equal(releaseWaterBall(state, player()), false); assert.equal(state.heldBy, 0);
});

test('every original friend and tall transformed shape can reach floating troughs and sand at shore heights', () => {
  const forms = CHARACTERS.flatMap(character => [character,
    ...getCharacterArrangements(character.number).filter(form => form.transformed && form.height >= 7),
  ]);
  let lowestWave = Infinity;
  for (const [z, groundY] of [
    [WATER_PLAY.shoreZ - 1, 0], [WATER_PLAY.shoreZ + .3, 0],
    [WATER_PLAY.shoreZ + 2, 0], [WATER_PLAY.shoreZ + 2, -.03], [WATER_PLAY.spawn.z, -.2],
  ]) {
    for (let phase = 0; phase < 32; phase++) {
      const resting = createWaterBallState(); resting.z = z;
      resting.mode = z < WATER_PLAY.shoreZ ? 'sand' : 'floating';
      stepWaterBall(resting, 1 / 240, phase / 2);
      if (z >= WATER_PLAY.shoreZ + 2) lowestWave = Math.min(lowestWave, resting.y);
      for (const form of forms) {
        const state = structuredClone(resting);
        const carrier = player({ ...getCharacterMetrics(form), number: form.number, x: state.x, z: state.z - .5, groundY });
        assert.equal(pickUpWaterBall(state, carrier), true, `${form.number} ${form.formId ?? 'original'} at ground ${groundY}, wave ${resting.y}`);
        assert.equal(state.heldBy, form.number);
        const highBall = structuredClone(resting); highBall.y = 6; highBall.mode = 'airborne';
        assert.equal(pickUpWaterBall(highBall, carrier), false, 'reaching down does not allow a high airborne catch');
      }
    }
  }
  assert.ok(lowestWave < .38, 'the regression covers low wave troughs beneath tall holding heights');
});

test('held placement follows facing, ground and jumps, with small offsets even for tall or wide friends', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const state = createWaterBallState(), carrier = player({ yaw, number: 30, height: 30, width: 30, depth: 20, groundY: -.2 });
    assert.equal(pickUpWaterBall(state, carrier), true);
    const forwardX = state.x - carrier.x, forwardZ = state.z - carrier.z;
    near(forwardX * Math.sin(yaw) + forwardZ * Math.cos(yaw), 2.2);
    assert.ok(Math.hypot(forwardX, forwardZ) < 2.3, 'wide bodies must not move the ball far across the bay');
    near(state.y, 2.6);
    carrier.x += .3; carrier.jump = 1;
    assert.equal(updateHeldWaterBall(state, carrier, 0), true); near(state.y, 3.6);
    const pose = [state.x, state.y, state.z];
    stepWaterBall(state, 3);
    assert.deepEqual([state.x, state.y, state.z], pose, 'held balls do not fall or drift');
  }
});

test('carrying down the real seabed follows the hand continuously for Zero, One and a tall wide friend', () => {
  for (const shape of [{ number: 0, height: .65 }, { number: 1, height: 1 }, { number: 30, height: 30, width: 30, depth: 20 }]) {
    const state = createWaterBallState(), carrier = player(shape);
    carrier.groundY = waterPlayHeight(carrier.x, carrier.z);
    assert.equal(pickUpWaterBall(state, carrier), true);
    let previousY = state.y;
    const destination = WATER_PLAY.shoreZ + WATER_PLAY.depthRamp + 20;
    while (carrier.z < destination) {
      carrier.z = Math.min(destination, carrier.z + 1);
      carrier.groundY = waterPlayHeight(carrier.x, carrier.z);
      assert.equal(updateHeldWaterBall(state, carrier, 0), true);
      assert.ok(Math.abs(state.y - previousY) < .3, 'walking cannot jump the ball to the surface');
      assert.ok(state.y - WATER_BALL_RADIUS >= waterPlayHeight(state.x, state.z), 'the ball stays above the seabed');
      previousY = state.y;
    }
    near(state.y, -WATER_PLAY.maxDepth + Math.max(.8, Math.min(2.8, carrier.height / 3 + .5)));
    assert.ok(state.y < -15, 'the ball is still in the deep carrier’s hand');
    const pose = [state.x, state.y, state.z]; stepWaterBall(state, 3);
    assert.deepEqual([state.x, state.y, state.z], pose);
    carrier.jump = 1; updateHeldWaterBall(state, carrier, 0); near(state.y, pose[1] + 1);
  }
});

test('deep friends cannot pick up a surface ball, but can reach a nearby submerged ball', () => {
  for (const character of CHARACTERS) {
    const carrier = deepCarrier({ number: character.number, ...getCharacterMetrics(character) });
    const state = createWaterBallState(); state.x = carrier.x; state.z = carrier.z;
    assert.equal(pickUpWaterBall(state, carrier), false, `${character.name} cannot reach eighteen metres up`);
    assert.equal(state.heldBy, null);
    const nearby = submergedBall(carrier);
    assert.equal(pickUpWaterBall(nearby, carrier), true, `${character.name} can reach a ball by their feet`);
    assert.equal(nearby.heldBy, character.number);
    const below = submergedBall(carrier); below.y = carrier.groundY - WATER_BALL_RADIUS - .01;
    assert.equal(pickUpWaterBall(below, carrier), false, 'pickup retains its lower vertical limit');
  }
});

test('a deep release stays at its previous pose, rises gradually, then floats and drifts shoreward', () => {
  const carrier = deepCarrier({ number: 0, height: .65 }), state = submergedBall(carrier);
  assert.equal(pickUpWaterBall(state, carrier), true);
  const pose = [state.x, state.y, state.z];
  assert.equal(releaseWaterBall(state, { ...carrier, x: WATER_PLAY.spawn.x, z: WATER_PLAY.beachZ }), true);
  assert.deepEqual([state.x, state.y, state.z], pose, 'fast travel must leave the ball underwater at its last pose');
  assert.equal(state.mode, 'rising'); assert.equal(state.heldBy, null);
  stepWaterBall(state, 1 / 60);
  assert.ok(state.y > pose[1] && state.y < pose[1] + .01, 'buoyancy starts without a surface teleport');
  let surfaced = false, previousY = state.y;
  for (let i = 0; i < 12 * 60 && state.mode !== 'floating'; i++) {
    const event = stepWaterBall(state, 1 / 60);
    assert.ok(state.y >= previousY - 1e-8, 'the released ball rises steadily');
    assert.ok(state.y - previousY < .05, 'each ascent frame is continuous');
    previousY = state.y; surfaced ||= event?.type === 'surfaced'; assertInBay(state);
  }
  assert.equal(surfaced, true); assert.equal(state.mode, 'floating');
  assert.ok(state.y > WATER_PLAY.waterY && state.y < WATER_PLAY.waterY + WATER_BALL_RADIUS);
  const surfacedZ = state.z; simulate(state, 10);
  assert.ok(state.z < surfacedZ - 6, 'surface waves still carry the ball toward the beach');
});

test('a submerged throw has a short directional trajectory and rises without jumping to the waterline', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const carrier = deepCarrier({ yaw }), state = submergedBall(carrier);
    pickUpWaterBall(state, carrier);
    const pose = [state.x, state.y, state.z];
    assert.equal(throwWaterBall(state, carrier), true);
    assert.deepEqual([state.x, state.y, state.z], pose);
    assert.equal(state.mode, 'rising'); assert.equal(state.throws, 1);
    assert.ok(state.vx * Math.sin(yaw) + state.vz * Math.cos(yaw) > 0);
    stepWaterBall(state, 1 / 60);
    assert.ok(state.y > pose[1] && state.y < pose[1] + .08);
    for (let i = 0; i < 12 * 60 && state.mode !== 'floating'; i++) {
      stepWaterBall(state, 1 / 60); assertInBay(state);
      assert.ok(state.y - WATER_BALL_RADIUS >= waterPlayHeight(state.x, state.z));
    }
    assert.equal(state.mode, 'floating');
    const distance = (state.x - pose[0]) * Math.sin(yaw) + (state.z - pose[2]) * Math.cos(yaw);
    assert.ok(distance > 2 && distance < 4, `water drag limits the horizontal throw: ${distance}`);
  }
});

test('held balls and underwater throws stay above the sloping seabed when facing uphill', () => {
  const carrier = deepCarrier({ number: 0, height: .65, depth: 20, z: WATER_PLAY.shoreZ + WATER_PLAY.depthRamp / 2, yaw: Math.PI });
  const state = submergedBall(carrier); assert.equal(pickUpWaterBall(state, carrier), true);
  assert.ok(state.y - WATER_BALL_RADIUS >= waterPlayHeight(state.x, state.z));
  throwWaterBall(state, carrier, 22, 3);
  for (let i = 0; i < 60 * 8; i++) {
    stepWaterBall(state, 1 / 60);
    assert.ok(state.y - WATER_BALL_RADIUS >= waterPlayHeight(state.x, state.z), 'an uphill throw must not enter the floor');
    assertInBay(state);
  }
  assert.equal(state.mode, 'floating');
});

test('release and travel retain the last held pose and tolerate missing or stale carriers', () => {
  const state = createWaterBallState(), carrier = player();
  assert.equal(releaseWaterBall(state), false);
  pickUpWaterBall(state, carrier);
  const pose = [state.x, state.y, state.z];
  assert.equal(releaseWaterBall(state, { ...carrier, x: 300, z: 100 }), true);
  assert.deepEqual([state.x, state.y, state.z], pose); assert.equal(state.mode, 'airborne');
  assert.equal(state.heldBy, null); assert.equal(releaseWaterBall(state), false);
  resetWaterBall(state); pickUpWaterBall(state, carrier);
  const oldPose = [state.x, state.y, state.z];
  assert.equal(updateHeldWaterBall(state, { ...carrier, x: carrier.x + 30, z: carrier.z + 11 }), false, 'travel within the bay cannot teleport the ball');
  assert.deepEqual([state.x, state.y, state.z], oldPose); assert.equal(state.heldBy, null);
  resetWaterBall(state); pickUpWaterBall(state, carrier);
  assert.equal(updateHeldWaterBall(state, { ...carrier, x: WATER_PLAY.xMax + 1 }), false);
  assert.equal(state.heldBy, null);
});

test('each shore edge keeps held and released balls inside the bay, including a wide deep friend', () => {
  for (const [x, z, yaw] of [
    [WATER_PLAY.xMin, WATER_PLAY.spawn.z, -Math.PI / 2], [WATER_PLAY.xMax, WATER_PLAY.spawn.z, Math.PI / 2],
    [WATER_PLAY.spawn.x, WATER_PLAY.beachZ, Math.PI], [WATER_PLAY.spawn.x, WATER_PLAY.deepZ, 0],
  ]) {
    const state = createWaterBallState(); state.x = x; state.z = z;
    const carrier = player({ x, z, yaw, width: 30, depth: 20, height: 10, radius: 2.7 });
    assert.equal(pickUpWaterBall(state, carrier), true); assertInBay(state);
    const pose = [state.x, state.y, state.z];
    assert.equal(releaseWaterBall(state), true); assert.deepEqual([state.x, state.y, state.z], pose);
    simulate(state, 2); assertInBay(state);
  }
});

test('only the carrier throws, in their facing direction, with bounded power and a visible upward arc', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, .72]) {
    const state = createWaterBallState(), carrier = player({ number: 0, yaw });
    assert.equal(throwWaterBall(state, carrier), false);
    pickUpWaterBall(state, carrier);
    assert.equal(throwWaterBall(state, player()), false);
    for (const bad of [0, -1, NaN, Infinity]) assert.equal(throwWaterBall(state, carrier, bad), false);
    assert.equal(throwWaterBall(state, carrier), true);
    near(state.vx, Math.sin(yaw) * 12); near(state.vz, Math.cos(yaw) * 12);
    assert.equal(state.vy, 7); assert.equal(state.mode, 'airborne'); assert.equal(state.heldBy, null); assert.equal(state.throws, 1);
    const initialY = state.y;
    stepWaterBall(state, .5);
    assert.ok(state.y > initialY + 1.8, 'the throw rises substantially above the hand');
    assert.ok(state.vy > 0 && state.vy < 2);
    assertInBay(state);
  }
  const state = createWaterBallState(), carrier = player(); pickUpWaterBall(state, carrier);
  assert.equal(throwWaterBall(state, carrier, 1e6, 1e6), true);
  near(Math.hypot(state.vx, state.vz), 22); assert.equal(state.vy, 11);
});

test('a seaward throw splashes down, floats visibly and drifts back to settle on the beach', () => {
  const state = createWaterBallState(), carrier = player();
  pickUpWaterBall(state, carrier); throwWaterBall(state, carrier);
  let splash = false, washed = false, lowest = Infinity, highest = -Infinity;
  for (let i = 0; i < 3600; i++) {
    const event = stepWaterBall(state, 1 / 60);
    splash ||= event?.type === 'splash'; washed ||= event?.type === 'washed-ashore';
    if (state.mode === 'floating' && state.z > WATER_PLAY.shoreZ + 2) {
      lowest = Math.min(lowest, state.y); highest = Math.max(highest, state.y);
      assert.ok(state.y > WATER_PLAY.waterY && state.y < WATER_PLAY.waterY + WATER_BALL_RADIUS);
    }
    assertInBay(state);
  }
  assert.equal(splash, true); assert.ok(highest - lowest > .15, 'floating visibly follows waves');
  assert.equal(washed, true); assert.equal(state.mode, 'sand');
  assert.ok(state.z < WATER_PLAY.shoreZ - WATER_BALL_RADIUS);
  assert.equal(state.vx, 0); assert.equal(state.vz, 0);
  const settled = [state.x, state.y, state.z]; simulate(state, 10);
  assert.deepEqual([state.x, state.y, state.z], settled, 'the ball stays put on dry sand');
});

test('a shoreward throw lands on sand and stops after its small bounce', () => {
  const state = createWaterBallState(), carrier = player({ z: WATER_PLAY.shoreZ + 5, yaw: Math.PI }); state.z = WATER_PLAY.shoreZ + 6;
  pickUpWaterBall(state, carrier); throwWaterBall(state, carrier);
  let landed = false;
  for (let i = 0; i < 300; i++) {
    const event = stepWaterBall(state, 1 / 60);
    landed ||= event?.type === 'landed';
  }
  assert.equal(landed, true); assert.equal(state.mode, 'sand'); assert.ok(state.z < WATER_PLAY.shoreZ - 8);
  assert.equal(state.vx, 0); assert.equal(state.vz, 0); assertInBay(state);
});

test('throw and wave motion remain close across frame rates and stalled updates', () => {
  const initial = createWaterBallState(), carrier = player(); pickUpWaterBall(initial, carrier); throwWaterBall(initial, carrier);
  const reference = simulate(structuredClone(initial), 8, 120);
  for (const fps of [30, 60, 144]) {
    const actual = simulate(structuredClone(initial), 8, fps);
    for (const key of ['x', 'y', 'z', 'vx', 'vz']) near(actual[key], reference[key], .04);
    assert.equal(actual.mode, reference.mode);
  }
  const stalled = structuredClone(initial); stepWaterBall(stalled, 8, 8);
  for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz']) near(stalled[key], reference[key], 1e-8);
  assert.equal(stalled.time, 8);
});

test('deep-water ascent remains stable across frame rates and long stalled updates', () => {
  for (const throwIt of [false, true]) {
    const carrier = deepCarrier({ yaw: .7 }), initial = submergedBall(carrier);
    pickUpWaterBall(initial, carrier);
    if (throwIt) throwWaterBall(initial, carrier); else releaseWaterBall(initial, carrier);
    const reference = simulate(structuredClone(initial), 12, 120);
    for (const fps of [30, 60, 144]) {
      const actual = simulate(structuredClone(initial), 12, fps);
      for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz']) near(actual[key], reference[key], .04);
      assert.equal(actual.mode, 'floating'); assertInBay(actual);
    }
    const stalled = structuredClone(initial); stepWaterBall(stalled, 12, 12);
    for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz']) near(stalled[key], reference[key], 1e-8);
  }
});

test('bay sides and deep-water boundary bounce inward and long varied updates stay finite', () => {
  for (const [axis, speedKey, value, speed] of [
    ['x', 'vx', WATER_PLAY.xMin + 1, -22], ['x', 'vx', WATER_PLAY.xMax - 1, 22],
    ['z', 'vz', WATER_PLAY.deepZ - 1, 22], ['z', 'vz', WATER_PLAY.beachZ + 1, -22],
  ]) {
    const state = createWaterBallState(); state[axis] = value; state[speedKey] = speed; state.mode = 'airborne'; state.y = 4;
    stepWaterBall(state, .1); assertInBay(state); assert.ok(state[speedKey] * speed < 0);
  }
  let seed = 81;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const state = createWaterBallState();
  for (let i = 0; i < 500; i++) {
    if (i % 19 === 0) {
      const carrier = player({ number: i % 31, x: state.x, z: state.z, yaw: random() * Math.PI * 2 });
      if (pickUpWaterBall(state, carrier)) throwWaterBall(state, carrier, 3 + random() * 50, 3 + random() * 15);
    }
    stepWaterBall(state, i % 81 === 0 ? 120 : .01 + random() * .1); assertInBay(state);
  }
  const snapshot = structuredClone(state);
  for (const invalid of [0, -1, NaN, Infinity]) assert.equal(stepWaterBall(state, invalid), null);
  assert.deepEqual(state, snapshot);
  state.vy = NaN; stepWaterBall(state, .1); assert.deepEqual(state, createWaterBallState());
});

test('the DOM-free renderer uses six bright spherical panels, tracks height and hides held ripples for Zero', () => {
  assert.equal(typeof document, 'undefined');
  const model = createWaterBall(), state = createWaterBallState();
  const panels = model.ballMesh.children.filter(child => child.userData.panel !== undefined);
  assert.equal(panels.length, 6); assert.equal(new Set(panels.map(panel => panel.material.color.getHex())).size, 5);
  for (const [i, panel] of panels.entries()) {
    assert.equal(panel.geometry.type, 'SphereGeometry'); near(panel.geometry.parameters.radius, WATER_BALL_RADIUS);
    near(panel.geometry.parameters.phiStart, i * Math.PI / 3); near(panel.geometry.parameters.phiLength, Math.PI / 3);
  }
  state.x += 4; state.z += 2; state.y = 3; state.mode = 'airborne'; state.rollX = .8; state.rollZ = -.6;
  model.update(state, 2); model.root.updateMatrixWorld(true);
  const rendered = model.ballMesh.getWorldPosition(new THREE.Vector3());
  near(rendered.x, state.x); near(rendered.y, state.y); near(rendered.z, state.z);
  near(model.ballMesh.rotation.x, .8); near(model.ballMesh.rotation.z, -.6);
  const ripples = model.root.children.filter(child => child.name === 'Beach ball ripple');
  assert.equal(ripples.length, 3); assert.ok(ripples.every(ripple => !ripple.visible));
  resetWaterBall(state); model.update(state, 3); assert.ok(ripples.every(ripple => ripple.visible));
  pickUpWaterBall(state, player({ number: 0 })); model.update(state, 4); assert.ok(ripples.every(ripple => !ripple.visible));
  state.y = -12; state.mode = 'rising'; state.heldBy = null; state.splash = 1; model.update(state, 4);
  near(model.ballMesh.position.y, -12); assert.ok(ripples.every(ripple => !ripple.visible));
  assert.equal(model.root.getObjectByName('Beach ball shadow').visible, false, 'a submerged ball has no shadow on top of the water');
  model.root.traverse(object => {
    if (object.geometry) assert.ok([...object.geometry.attributes.position.array].every(Number.isFinite));
    assert.ok([...object.position, ...object.scale].every(Number.isFinite));
  });
  const scene = new THREE.Scene(); scene.add(model.root);
  let disposedGeometry = 0, disposedMaterials = 0;
  model.root.traverse(object => {
    object.geometry?.addEventListener('dispose', () => disposedGeometry++);
    object.material?.addEventListener('dispose', () => disposedMaterials++);
  });
  model.dispose(); model.dispose();
  assert.equal(model.root.parent, null); assert.equal(disposedGeometry, 11); assert.equal(disposedMaterials, 11);
});
