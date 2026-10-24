import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, OBSTACLES, LANDMARKS, FRIEND_STARTS, BUILDINGS } from '../dist/world-data.js';

// The widest friend needs a 5.4-unit corridor. The route check uses a separate
// occupancy grid, so a safe-looking destination cannot conceal a sealed route.
const radius = 2.7;
function blocked(x, z) {
  if (x < WORLD.margin + radius || z < WORLD.margin + radius ||
      x > WORLD.width - WORLD.margin - radius || z > WORLD.depth - WORLD.margin - radius) return true;
  return OBSTACLES.some(o => {
    if (o.radius !== undefined) return Math.hypot(x - o.x, z - o.z) < radius + o.radius;
    const dx = Math.max(o.x - x, 0, x - o.x - o.w);
    const dz = Math.max(o.z - z, 0, z - o.z - o.d);
    return Math.hypot(dx, dz) < radius;
  });
}

test('all fifteen friends start clear of scenery and each other, including wide friends', () => {
  assert.equal(FRIEND_STARTS.length, 15);
  for (const [i, p] of FRIEND_STARTS.entries()) {
    assert.ok(!blocked(p.x, p.z), `Friend ${i + 1} starts inside scenery`);
    for (const q of FRIEND_STARTS.slice(i + 1)) {
      assert.ok(Math.hypot(p.x - q.x, p.z - q.z) >= radius * 2, `Friends overlap near ${p.x},${p.z}`);
    }
  }
});

test('landmark arrivals and all neighborhoods connect to the town square for a wide friend', () => {
  const reached = new Set(['48,47']);
  const queue = [[48, 47]];
  for (let head = 0; head < queue.length; head++) {
    const [x, z] = queue[head];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      const key = `${nx},${nz}`;
      if (!reached.has(key) && !blocked(nx, nz)) {
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
  assert.ok(BUILDINGS.length >= 15, 'The expanded town keeps its many buildings');
});
