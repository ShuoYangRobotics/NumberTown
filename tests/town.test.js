import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, obstacles, project } from '../dist/town.js';
import { collides, movementVector, moveWithCollisions, nearestOpenPosition } from '../dist/physics.js';

const starts = [WORLD.spawn, { x: 460, y: 565 }, { x: 670, y: 565 }, { x: 380, y: 715 }, { x: 730, y: 725 }];

test('the rendered town projection agrees with screen-relative movement', () => {
  for (const [horizontal, vertical] of [[0, -1], [-1, 0], [0, 1], [1, 0], [1, -1]]) {
    const vector = movementVector(horizontal, vertical, 150);
    const point = project(vector.x, vector.y);
    const inputLength = Math.hypot(horizontal, vertical);
    assert.ok(Math.abs(point.x - horizontal / inputLength * 150) < 1e-8);
    assert.ok(Math.abs(point.y - vertical / inputLength * 150) < 1e-8);
  }
});

test('all five friends start in valid walking space', () => {
  assert.ok(obstacles.length > 0, 'town must include collision geometry');
  starts.forEach((start, index) => {
    assert.equal(collides(start.x, start.y, obstacles, WORLD), false, `friend ${index + 1} starts inside an obstacle`);
    assert.deepEqual(nearestOpenPosition(start, obstacles, WORLD), start);
  });
});

test('spawn recovery can escape every real town obstacle', () => {
  for (const obstacle of obstacles) {
    const position = { x: obstacle.x + obstacle.w / 2, y: obstacle.y + obstacle.d / 2 };
    const recovered = nearestOpenPosition(position, obstacles, WORLD);
    assert.equal(collides(recovered.x, recovered.y, obstacles, WORLD), false);
  }
});

test('all rounded island corners keep the full character footprint on land', () => {
  for (const right of [false, true]) {
    for (const bottom of [false, true]) {
      const at = (x, y) => ({ x: right ? WORLD.width - x : x, y: bottom ? WORLD.height - y : y });
      // These points were inside the old rectangular bounds but outside the
      // rounded grass, or too close to its curve for a 14-unit footprint.
      for (const distance of [26, 50, 60]) {
        const point = at(distance, distance);
        assert.equal(collides(point.x, point.y, [], WORLD), true);
      }
      const inside = at(65, 65);
      assert.equal(collides(inside.x, inside.y, [], WORLD), false);

      const player = at(133, 133);
      moveWithCollisions(player, right ? 500 : -500, bottom ? 500 : -500, [], WORLD);
      const center = at(133, 133);
      assert.ok(Math.hypot(player.x - center.x, player.y - center.y) <= 101,
        'walking toward a rounded corner carried the character off the island');
      const recovered = nearestOpenPosition(at(26, 26), [], WORLD);
      assert.equal(collides(recovered.x, recovered.y, [], WORLD), false);
    }
  }
});

test('the straight island edges also retain the character footprint', () => {
  for (const [outside, inside] of [
    [{ x: 31, y: 500 }, { x: 32, y: 500 }],
    [{ x: WORLD.width - 31, y: 500 }, { x: WORLD.width - 32, y: 500 }],
    [{ x: 550, y: 31 }, { x: 550, y: 32 }],
    [{ x: 550, y: WORLD.height - 31 }, { x: 550, y: WORLD.height - 32 }],
  ]) {
    assert.equal(collides(outside.x, outside.y, [], WORLD), true);
    assert.equal(collides(inside.x, inside.y, [], WORLD), false);
  }
});

test('all friend locations are connected by walkable ground', () => {
  // The 5-unit spacing is smaller than a character footprint. A connected path
  // therefore cannot squeeze across a wall that physical movement would block.
  const step = 5;
  const key = (x, y) => `${x},${y}`;
  const queue = [{ ...WORLD.spawn }];
  const seen = new Set([key(WORLD.spawn.x, WORLD.spawn.y)]);
  const missing = new Set(starts.map(({ x, y }) => key(x, y)));
  for (let head = 0; head < queue.length && missing.size; head++) {
    const point = queue[head];
    missing.delete(key(point.x, point.y));
    for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const x = point.x + dx, y = point.y + dy;
      const identity = key(x, y);
      if (seen.has(identity) || collides(x, y, obstacles, WORLD)) continue;
      seen.add(identity);
      queue.push({ x, y });
    }
  }
  assert.deepEqual([...missing], [], 'a friend is stranded behind collision geometry');
});

test('long varied walks keep characters outside every actual town obstacle', () => {
  let seed = 19283;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (const start of starts) {
    const player = { ...start };
    for (let i = 0; i < 400; i++) {
      const vector = movementVector(Math.floor(random() * 3) - 1, Math.floor(random() * 3) - 1, 150);
      // Include unusually large updates to exercise collision substeps.
      const duration = i % 13 === 0 ? 3 : .04;
      moveWithCollisions(player, vector.x * duration, vector.y * duration, obstacles, WORLD);
      assert.equal(collides(player.x, player.y, obstacles, WORLD), false, `walk entered geometry at ${player.x}, ${player.y}`);
    }
  }
});
