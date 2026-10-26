import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { FIELD, FOOTBALL_LANDMARK, FOOTBALL_OBSTACLES, createBallState, resetBall, stepBall, kickBall, updateBallContact, createFootball } from '../dist/football.js';
import { collides } from '../dist/navigation.js';
import { WORLD, FIELD_OFFSET, riverX, riverWidth } from '../dist/geography.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const player = (x, z, yaw = 0, radius = .7) => ({ x, z, yaw, radius, moving: true });

test('football kicks require proximity and follow facing after every camera orbit', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, .73]) {
    const state = createBallState();
    assert.equal(kickBall(state, player(FIELD.x, FIELD.z - 1, yaw)), true);
    near(state.vx, Math.sin(yaw) * 24); near(state.vz, Math.cos(yaw) * 24);
  }
  const state = createBallState();
  assert.equal(kickBall(state, player(FIELD.x + 3, FIELD.z)), false);
  assert.equal(state.vx, 0); assert.equal(state.vz, 0);
  assert.equal(kickBall(state, player(FIELD.x + 4.5, FIELD.z, 0, 2.55)), true, 'a wide friend can reach the ball');
  kickBall(state, player(FIELD.x, FIELD.z), 1e6);
  near(Math.hypot(state.vx, state.vz), 36);
});

test('friction slows a rolling ball independently of frame rate', () => {
  const oneFrame = createBallState(), manyFrames = createBallState();
  oneFrame.vx = 8; manyFrames.vx = 8;
  stepBall(oneFrame, 1);
  for (let i = 0; i < 120; i++) stepBall(manyFrames, 1 / 120);
  near(oneFrame.x, manyFrames.x); near(oneFrame.vx, manyFrames.vx);
  assert.ok(oneFrame.vx > 0 && oneFrame.vx < 8);
  assert.ok(oneFrame.rollZ < 0, 'rolling is derived from actual displacement');
  stepBall(oneFrame, 30);
  assert.equal(oneFrame.vx, 0);
});

test('both goals score only after the entire ball crosses between the posts', () => {
  for (const [end, z, direction] of [['north', FIELD.minZ, -1], ['south', FIELD.maxZ, 1]]) {
    const state = createBallState(); state.z = z - direction * .2; state.vz = direction * 10;
    assert.equal(stepBall(state, .02), null, 'part of the ball is still on the pitch');
    assert.equal(state.goals, 0);
    const event = stepBall(state, .2);
    assert.deepEqual(event, { type: 'goal', end, goals: 1, scores: { north: end === 'north' ? 1 : 0, south: end === 'south' ? 1 : 0 } });
    assert.equal(state.lastGoal, end); assert.ok(state.resetIn > 0);
    assert.equal(kickBall(state, player(state.x, state.z)), false, 'a scored ball waits for the restart');
    assert.equal(stepBall(state, .5), null); assert.equal(state.goals, 1);
    stepBall(state, 1);
    assert.equal(state.x, FIELD.x); assert.equal(state.z, FIELD.z); assert.equal(state.resetIn, 0);
    assert.equal(state.goals, 1); assert.equal(state.scores[end], 1);
  }
});

test('wide shots bounce off the end boundary and side lines keep the ball on the field', () => {
  const wide = createBallState(); wide.x = FIELD.x + 8; wide.z = FIELD.minZ + 1; wide.vz = -24;
  assert.equal(stepBall(wide, .2), null); assert.equal(wide.goals, 0);
  assert.ok(wide.z >= FIELD.minZ + FIELD.ballRadius && wide.vz > 0);
  for (const side of [-1, 1]) {
    const state = createBallState(); state.x = side < 0 ? FIELD.minX + 1 : FIELD.maxX - 1; state.vx = side * 24;
    stepBall(state, .2);
    assert.ok(state.x >= FIELD.minX + .5 && state.x <= FIELD.maxX - .5);
    assert.ok(state.vx * side < 0, 'the ball should bounce inward');
  }
});

test('walking into the ball gently dribbles it; idle, distant, and retreating friends do not', () => {
  const state = createBallState(), walker = player(FIELD.x, FIELD.z - 1);
  assert.equal(updateBallContact(state, { ...walker, moving: false }, 1 / 60), false);
  assert.equal(updateBallContact(state, player(FIELD.x, FIELD.z - 10), 1 / 60), false);
  assert.equal(updateBallContact(state, { ...walker, yaw: Math.PI }, 1 / 60), false);
  assert.equal(updateBallContact(state, walker, 1 / 60), true);
  assert.ok(state.vz > 0 && state.vz < 8); assert.ok(state.z - walker.z >= walker.radius + FIELD.ballRadius);
  kickBall(state, walker);
  const kickedVelocity = state.vz;
  assert.equal(updateBallContact(state, walker, 1 / 60), false, 'contact cannot erase a stronger explicit kick');
  assert.equal(state.vz, kickedVelocity);
});

test('long varied updates stay finite, bounded, and score at most once before restart', () => {
  let seed = 8172;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const state = createBallState(); let goals = 0;
  for (let i = 0; i < 900; i++) {
    if (i % 17 === 0) kickBall(state, player(state.x, state.z, random() * Math.PI * 2), 10 + random() * 40);
    const event = stepBall(state, i % 89 === 0 ? 120 : .016 + random() * .1);
    if (event) goals++;
    for (const key of ['x', 'z', 'vx', 'vz', 'rollX', 'rollZ', 'resetIn']) assert.ok(Number.isFinite(state[key]), key);
    assert.ok(state.x >= FIELD.minX + .5 && state.x <= FIELD.maxX - .5);
    assert.ok(state.z >= FIELD.minZ - FIELD.goalDepth && state.z <= FIELD.maxZ + FIELD.goalDepth);
    assert.equal(state.goals, goals); assert.equal(state.goals, state.scores.north + state.scores.south);
  }
  const before = structuredClone(state);
  for (const dt of [0, -1, NaN, Infinity]) assert.equal(stepBall(state, dt), null);
  assert.deepEqual(state, before);
  resetBall(state, { clearScore: true }); assert.deepEqual(state, createBallState());
});

test('pitch and broad side entrances remain clear of the scenery obstacles', () => {
  // A full character can enter from either side and stand at the quick-travel point.
  for (let x = FIELD.minX - 14; x <= FIELD.maxX + 16; x++) assert.equal(collides(x, FIELD.z, FOOTBALL_OBSTACLES, WORLD, 2.7), false, `entrance blocked at ${x}`);
  assert.equal(collides(FOOTBALL_LANDMARK.arrival.x, FOOTBALL_LANDMARK.arrival.z, FOOTBALL_OBSTACLES, WORLD, 2.7), false);
  for (const obstacle of FOOTBALL_OBSTACLES) {
    const minX = obstacle.radius ? obstacle.x - obstacle.radius : obstacle.x;
    const maxX = obstacle.radius ? obstacle.x + obstacle.radius : obstacle.x + obstacle.w;
    const minZ = obstacle.radius ? obstacle.z - obstacle.radius : obstacle.z;
    const maxZ = obstacle.radius ? obstacle.z + obstacle.radius : obstacle.z + obstacle.d;
    assert.ok(maxX <= FIELD.minX || minX >= FIELD.maxX || maxZ <= FIELD.minZ || minZ >= FIELD.maxZ,
      `${obstacle.id} intrudes into the playable field`);
  }
});

test('field scenery, ball physics, and rendered ball share east-bank world coordinates', () => {
  assert.equal(FIELD.x, 245 + FIELD_OFFSET.x); assert.equal(FIELD.z, 149 + FIELD_OFFSET.z);
  assert.equal(FOOTBALL_LANDMARK.x, FIELD.x); assert.equal(FOOTBALL_LANDMARK.z, FIELD.z);
  for (let z = FIELD.minZ - 12; z <= FIELD.maxZ + 12; z++) {
    assert.ok(FIELD.minX - 7 > riverX(z) + riverWidth(z) / 2 + 2.7, 'football scenery intrudes into the river');
  }
  const football = createFootball(), state = createBallState();
  football.update(state); football.root.updateMatrixWorld(true);
  const rendered = football.ballMesh.getWorldPosition(new THREE.Vector3());
  near(rendered.x, FIELD.x); near(rendered.z, FIELD.z);
  const nets = football.root.getObjectByName('Two goal nets'); nets.geometry.computeBoundingBox();
  const netBounds = nets.geometry.boundingBox.clone().applyMatrix4(nets.matrixWorld);
  near(netBounds.min.x, FIELD.x - FIELD.goalWidth / 2); near(netBounds.max.x, FIELD.x + FIELD.goalWidth / 2);
  near(netBounds.min.z, FIELD.minZ - FIELD.goalDepth); near(netBounds.max.z, FIELD.maxZ + FIELD.goalDepth);
  assert.ok(FOOTBALL_OBSTACLES.every(o => o.x >= FIELD.minX - 7 && o.x < WORLD.width && o.z > 0 && o.z < WORLD.depth));
});

test('the pitch is real 3D geometry with two nets and a rolling black-and-white ball', () => {
  assert.equal(typeof document, 'undefined');
  const football = createFootball(), state = createBallState();
  assert.ok(football.root.isGroup); assert.equal(football.root.getObjectByName('Two goal nets').isLineSegments, true);
  assert.equal(football.ballMesh.children.length, 2);
  const patches = football.ballMesh.children[1].geometry.attributes.position.array;
  for (let i = 0; i < patches.length; i += 9) {
    const cx = (patches[i] + patches[i + 3] + patches[i + 6]) / 3;
    const cy = (patches[i + 1] + patches[i + 4] + patches[i + 7]) / 3;
    const cz = (patches[i + 2] + patches[i + 5] + patches[i + 8]) / 3;
    assert.ok(Math.hypot(cx, cy, cz) > FIELD.ballRadius, 'black panels must stay visible above the white sphere');
  }
  state.x += 3; state.z -= 2; state.rollX = 1.2; state.rollZ = -.6;
  football.update(state, 3);
  near(football.ballMesh.position.x, state.x); near(football.ballMesh.position.z, state.z);
  near(football.ballMesh.rotation.x, 1.2); near(football.ballMesh.rotation.z, -.6);
  football.root.traverse(object => {
    if (object.geometry) assert.ok([...object.geometry.attributes.position.array].every(Number.isFinite));
  });
});
