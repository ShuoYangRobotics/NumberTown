import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, obstacles, project, FRIEND_STARTS, LANDMARKS } from '../dist/town.js';
import { collides, movementVector, moveWithCollisions, nearestOpenPosition } from '../dist/physics.js';

const starts = FRIEND_STARTS;
const radii = [14, 14, 14, 14, 14, 23, 14, 23, 32, 23];

test('the expanded town includes ten friends and accessible landmark arrival points', () => {
  assert.equal(WORLD.width, 1750);
  assert.equal(WORLD.height, 1500);
  assert.equal(starts.length, 10);
  for (const id of ['library', 'town-square', 'garden', 'pond']) {
    const landmark = LANDMARKS.find(place => place.id === id);
    assert.ok(landmark, `missing ${id}`);
    assert.ok(Math.hypot(landmark.arrival.x - landmark.x, landmark.arrival.y - landmark.y) < landmark.radius,
      `${id} arrival should trigger the landmark's welcome`);
    assert.equal(collides(landmark.arrival.x, landmark.arrival.y, obstacles, WORLD, 32), false,
      `Nine cannot stand at ${id}'s arrival point`);
  }
});

test('the rendered town projection agrees with screen-relative movement', () => {
  for (const [horizontal, vertical] of [[0, -1], [-1, 0], [0, 1], [1, 0], [1, -1]]) {
    const vector = movementVector(horizontal, vertical, 150);
    const point = project(vector.x, vector.y);
    const inputLength = Math.hypot(horizontal, vertical);
    assert.ok(Math.abs(point.x - horizontal / inputLength * 150) < 1e-8);
    assert.ok(Math.abs(point.y - vertical / inputLength * 150) < 1e-8);
  }
});

test('all ten friends start in valid walking space at their own widths', () => {
  assert.ok(obstacles.length > 0, 'town must include collision geometry');
  starts.forEach((start, index) => {
    assert.equal(collides(start.x, start.y, obstacles, WORLD, radii[index]), false, `friend ${index + 1} starts inside an obstacle`);
    assert.deepEqual(nearestOpenPosition(start, obstacles, WORLD, radii[index]), start);
  });
});

test('spawn recovery can escape every real town obstacle', () => {
  for (const radius of [14, 23, 32]) {
    for (const obstacle of obstacles) {
      const position = { x: obstacle.x + obstacle.w / 2, y: obstacle.y + obstacle.d / 2 };
      const recovered = nearestOpenPosition(position, obstacles, WORLD, radius);
      assert.equal(collides(recovered.x, recovered.y, obstacles, WORLD, radius), false);
    }
  }
});

test('all rounded island corners keep the full character footprint on land', () => {
  for (const radius of [14, 23, 32]) {
    for (const right of [false, true]) {
      for (const bottom of [false, true]) {
        const at = (x, y) => ({ x: right ? WORLD.width - x : x, y: bottom ? WORLD.height - y : y });
        // These points were inside the old rectangular bounds but outside the
        // rounded grass, or too close to its curve for a character footprint.
        for (const distance of [26, 50, 60]) {
          const point = at(distance, distance);
          assert.equal(collides(point.x, point.y, [], WORLD, radius), true);
        }
        const cornerCenter = WORLD.edgeInset + WORLD.cornerRadius;
        const innerDistance = Math.ceil(cornerCenter - (WORLD.cornerRadius - radius) / Math.sqrt(2)) + 1;
        const inside = at(innerDistance, innerDistance);
        assert.equal(collides(inside.x, inside.y, [], WORLD, radius), false);

        const player = { ...at(cornerCenter, cornerCenter), radius };
        moveWithCollisions(player, right ? 500 : -500, bottom ? 500 : -500, [], WORLD);
        const center = at(cornerCenter, cornerCenter);
        assert.ok(Math.hypot(player.x - center.x, player.y - center.y) <= WORLD.cornerRadius - radius,
          'walking toward a rounded corner carried the character off the island');
        const recovered = nearestOpenPosition(at(26, 26), [], WORLD, radius);
        assert.equal(collides(recovered.x, recovered.y, [], WORLD, radius), false);
      }
    }
  }
});

test('the straight island edges also retain the character footprint', () => {
  for (const radius of [14, 23, 32]) {
    const edge = WORLD.edgeInset + radius;
    for (const [outside, inside] of [
      [{ x: edge - 1, y: 500 }, { x: edge, y: 500 }],
      [{ x: WORLD.width - edge + 1, y: 500 }, { x: WORLD.width - edge, y: 500 }],
      [{ x: 550, y: edge - 1 }, { x: 550, y: edge }],
      [{ x: 550, y: WORLD.height - edge + 1 }, { x: 550, y: WORLD.height - edge }],
    ]) {
      assert.equal(collides(outside.x, outside.y, [], WORLD, radius), true);
      assert.equal(collides(inside.x, inside.y, [], WORLD, radius), false);
    }
  }
});

function unreachableDestinations(radius, destinations) {
  // The 5-unit spacing is smaller than a character footprint. A connected path
  // therefore cannot squeeze across a wall that physical movement would block.
  const step = 5;
  const key = (x, y) => `${x},${y}`;
  const queue = [{ ...WORLD.spawn }];
  const seen = new Set([key(WORLD.spawn.x, WORLD.spawn.y)]);
  const missing = new Map(destinations.map(({ x, y, name }) => [key(x, y), name]));
  for (let head = 0; head < queue.length && missing.size; head++) {
    const point = queue[head];
    missing.delete(key(point.x, point.y));
    for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const x = point.x + dx, y = point.y + dy;
      const identity = key(x, y);
      if (seen.has(identity) || collides(x, y, obstacles, WORLD, radius)) continue;
      seen.add(identity);
      queue.push({ x, y });
    }
  }
  return [...missing.values()];
}

test('all ten friend locations and four landmarks connect to the original neighborhood', () => {
  const destinations = [
    ...starts.map((point, index) => ({ ...point, name: `friend ${index + 1}` })),
    ...LANDMARKS.map(place => ({ ...place.arrival, name: place.id })),
  ];
  assert.deepEqual(unreachableDestinations(14, destinations), [], 'a friend or landmark is stranded behind collision geometry');
});

test('the widest friend Nine can walk between the old neighborhood, library, and town square', () => {
  const destinations = [
    { ...starts[8], name: 'Nine spawn' },
    ...LANDMARKS.map(place => ({ ...place.arrival, name: place.id })),
  ];
  assert.deepEqual(unreachableDestinations(32, destinations), [], 'a landmark route is too narrow for Nine');
});

test('long varied walks keep characters outside every actual town obstacle', () => {
  let seed = 19283;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (const [index, start] of starts.entries()) {
    const player = { ...start, radius: radii[index] };
    for (let i = 0; i < 400; i++) {
      const vector = movementVector(Math.floor(random() * 3) - 1, Math.floor(random() * 3) - 1, 150);
      // Include unusually large updates to exercise collision substeps.
      const duration = i % 13 === 0 ? 3 : .04;
      moveWithCollisions(player, vector.x * duration, vector.y * duration, obstacles, WORLD);
      assert.equal(collides(player.x, player.y, obstacles, WORLD, player.radius), false,
        `friend ${index + 1} entered geometry at ${player.x}, ${player.y}`);
    }
  }
});
