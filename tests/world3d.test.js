import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, OBSTACLES, LANDMARKS, FRIEND_STARTS, BUILDINGS, BUILDING_APPROACHES, EXPANSION_CONNECTIONS, ROAD_SEGMENTS, SQUARE, STATUE, POND } from '../dist/world-data.js';
import { BRIDGES, riverX, riverWidth } from '../dist/geography.js';
import { createTown } from '../dist/world3d.js';

// The widest friend needs a 5.4-unit corridor. The route check uses a separate
// occupancy grid, so a safe-looking destination cannot conceal a sealed route.
const radius = 2.7;
function blocked(x, z) {
  if (x < WORLD.margin + radius || z < WORLD.margin + radius ||
      x > WORLD.width - WORLD.margin - radius || z > WORLD.depth - WORLD.margin - radius) return true;
  // Prevent a route check from accidentally walking across the river, or
  // around its southern mouth. Only the three shared bridges join the banks.
  if (z > 398 - radius) return true;
  if (Math.abs(x - riverX(z)) < riverWidth(z) / 2 + radius &&
      !BRIDGES.some(b => Math.abs(z - b.z) <= b.width / 2 - radius)) return true;
  return OBSTACLES.some(o => {
    if (o.radius !== undefined) return Math.hypot(x - o.x, z - o.z) < radius + o.radius;
    const dx = Math.max(o.x - x, 0, x - o.x - o.w);
    const dz = Math.max(o.z - z, 0, z - o.z - o.d);
    return Math.hypot(dx, dz) < radius;
  });
}

test('all twenty friends start clear of scenery and each other, including wide friends', () => {
  assert.equal(FRIEND_STARTS.length, 20);
  for (const [i, p] of FRIEND_STARTS.entries()) {
    assert.ok(!blocked(p.x, p.z), `Friend ${i + 1} starts inside scenery`);
    for (const q of FRIEND_STARTS.slice(i + 1)) {
      assert.ok(Math.hypot(p.x - q.x, p.z - q.z) >= radius * 2, `Friends overlap near ${p.x},${p.z}`);
    }
  }
});

test('each town arrival selects its own nearby destination, including the pond beside the gardens', () => {
  for (const landmark of LANDMARKS) {
    const nearby = LANDMARKS.map(candidate => ({
      id: candidate.id, radius: candidate.radius,
      distance: Math.hypot(landmark.arrival.x - candidate.x, landmark.arrival.z - candidate.z),
    })).filter(candidate => candidate.distance <= candidate.radius).sort((a, b) => a.distance - b.distance);
    assert.equal(nearby[0]?.id, landmark.id, `${landmark.name} arrival selects a different context`);
    assert.equal(blocked(landmark.arrival.x, landmark.arrival.z), false, `${landmark.name} arrival must remain clear`);
  }
});

test('landmark arrivals and all neighborhoods connect to the town square for a wide friend', () => {
  const reached = new Set(['90,145']);
  const queue = [[90, 145]];
  const occupancy = new Map();
  function gridBlocked(x, z, key) {
    if (!occupancy.has(key)) occupancy.set(key, blocked(x, z));
    return occupancy.get(key);
  }
  for (let head = 0; head < queue.length; head++) {
    const [x, z] = queue[head];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      const key = `${nx},${nz}`;
      if (!reached.has(key) && !gridBlocked(nx, nz, key)) {
        reached.add(key);
        queue.push([nx, nz]);
      }
    }
  }
  for (const landmark of LANDMARKS) {
    assert.ok(!blocked(landmark.arrival.x, landmark.arrival.z), `${landmark.name} arrival is blocked`);
    assert.ok(reached.has(`${landmark.arrival.x},${landmark.arrival.z}`), `${landmark.name} has no safe route`);
  }
  for (const p of FRIEND_STARTS) assert.ok(reached.has(`${p.x},${p.z}`), `Unreachable start at ${p.x},${p.z}`);
  for (const approach of BUILDING_APPROACHES) {
    assert.ok(!blocked(approach.x, approach.z), `${approach.name} approach is blocked`);
    assert.ok(reached.has(`${approach.x},${approach.z}`), `${approach.name} is cut off from the town`);
  }
  for (const entrance of EXPANSION_CONNECTIONS) {
    assert.ok(reached.has(`${entrance.x},${entrance.z}`), `${entrance.id} has no clear connection to the town`);
  }
});

test('the banks have fifty west homes, twenty east homes, and ten stores around a clear large square', () => {
  assert.deepEqual(WORLD, { width: 440, depth: 460, minZ: -90, margin: 2 });
  assert.equal(BUILDINGS.filter(b => b.kind === 'house' && b.bank === 'west').length, 50);
  assert.equal(BUILDINGS.filter(b => b.kind === 'house' && b.bank === 'east').length, 20);
  assert.equal(BUILDINGS.filter(b => ['shop', 'bakery', 'cafe'].includes(b.kind)).length, 10);
  for (const kind of ['library', 'school', 'hall']) assert.equal(BUILDINGS.filter(b => b.kind === kind).length, 1);
  assert.equal(new Set(BUILDINGS.map(b => b.id)).size, BUILDINGS.length);
  assert.equal(BUILDING_APPROACHES.length, BUILDINGS.length);
  assert.ok(ROAD_SEGMENTS.every(r => r.width >= 10), 'Main streets need room for wide friends');
  assert.equal(SQUARE.w, 64); assert.equal(SQUARE.d, 56);
  for (const b of BUILDINGS) {
    const o = OBSTACLES.find(obstacle => obstacle.id === b.id);
    if (b.bank === 'west') assert.ok(o.x + o.w <= 214 && o.z >= 78 && o.z + o.d <= 299, `${b.id} leaves the west town bounds`);
    else assert.ok(o.x >= 270 && o.x + o.w < 320 && o.z >= 78, `${b.id} enters the river or reserved activity area`);
    const overlapsSquare = o.x < SQUARE.x + SQUARE.w / 2 && o.x + o.w > SQUARE.x - SQUARE.w / 2 &&
      o.z < SQUARE.z + SQUARE.d / 2 && o.z + o.d > SQUARE.z - SQUARE.d / 2;
    assert.equal(overlapsSquare, false, `${b.id} intrudes into the square`);
  }
  assert.equal(POND.rx, 17); assert.equal(POND.rz, 12);
  assert.ok(ROAD_SEGMENTS.every(r => Math.min(r.z1, r.z2) >= 78), 'Town roads must stay south of the mountains');
});

test('the centerpiece is a real 27-cubie statue with six tiled faces and a solid pedestal', () => {
  const town = createTown(); town.update(10);
  assert.deepEqual([town.statue.position.x, town.statue.position.z], [SQUARE.x, SQUARE.z]);
  const core = town.statue.getObjectByName('27 black cubies');
  assert.ok(core?.isInstancedMesh); assert.equal(core.count, 27);
  const faces = town.statue.children.filter(part => part !== core);
  assert.equal(faces.length, 6);
  assert.ok(faces.every(face => face.isInstancedMesh && face.count === 9));
  assert.equal(new Set(faces.map(face => face.material.color.getHex())).size, 6);
  assert.ok(blocked(STATUE.x, STATUE.z), 'The pedestal must stop characters walking through the statue');
});

test('bridge approach paving stops at each bridge edge and broad exits allow a turn onto both promenades', () => {
  for (const b of BRIDGES) {
    for (const [bank, edge] of [['west', b.x - b.span / 2], ['east', b.x + b.span / 2]]) {
      const approach = ROAD_SEGMENTS.find(r => r.id === `${b.id}-${bank}-approach`);
      assert.ok(approach); assert.equal(approach.x2, edge); assert.equal(approach.z2, b.z);
    }
    const eastExit = Math.max(266, b.x + b.span / 2 + 3.1);
    const westExit = Math.min(218, b.x - b.span / 2 - 3.1);
    for (const points of [
      [[b.x - 31, b.z], [eastExit, b.z], [eastExit, b.z + 9], [266, b.z + 9]],
      [[b.x, b.z], [westExit, b.z], [westExit, b.z + 9], [218, b.z + 9]],
    ]) for (let i = 1; i < points.length; i++) {
      const [ax, az] = points[i - 1], [bx, bz] = points[i];
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / .1);
      for (let step = 0; step <= steps; step++) {
        const x = ax + (bx - ax) * step / steps, z = az + (bz - az) * step / steps;
        assert.equal(blocked(x, z), false, `${b.id} exit is blocked near ${x},${z}`);
      }
    }
  }
});
