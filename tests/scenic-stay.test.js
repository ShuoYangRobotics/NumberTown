import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldStayAtScenicSpot } from '../dist/scenic-stay.js';
import { HILL, DECK, BRIDGES, HILL_TRAIL } from '../dist/geography.js';
import { hillHeight, groundHeight } from '../dist/terrain-data.js';
import { MOUNTAIN_TRAIL, SUMMIT_DECK, mountainWalkHeight } from '../dist/mountain-route.js';

test('elevated hill ground and both viewing decks retain a scenic visitor', () => {
  for (const point of [DECK, SUMMIT_DECK, { x: HILL.x, z: HILL.z - 20 }]) {
    const player = Object.freeze({ x: point.x, z: point.z, number: 0, radius: .43 });
    assert.ok(groundHeight(player.x, player.z) > .2);
    assert.equal(shouldStayAtScenicSpot(player), true);
  }
  for (const point of MOUNTAIN_TRAIL.filter(point => point.y > .2)) {
    assert.equal(shouldStayAtScenicSpot(point), true, `elevated trail at ${point.x},${point.z}`);
  }
});

test('completed descents, flat streets, bridges, and unwalkable peaks do not hold friends', () => {
  const flat = [
    { x: HILL_TRAIL[0][0], z: HILL_TRAIL[0][1] },
    MOUNTAIN_TRAIL[0], { x: 90, z: 145 }, { x: 160, z: 385 },
    { x: HILL.x + HILL.radius - .1, z: HILL.z },
  ];
  assert.ok(hillHeight(flat.at(-1).x, flat.at(-1).z) < .2);
  for (const point of [...flat, ...BRIDGES]) assert.equal(shouldStayAtScenicSpot(point), false);
  assert.equal(mountainWalkHeight(20, 15), null);
  assert.equal(shouldStayAtScenicSpot({ x: 20, z: 15 }), false, 'a mountain silhouette is not a walking surface');
});

test('invalid scenic positions are safely ignored', () => {
  for (const player of [undefined, null, {}, { x: NaN, z: 0 }, { x: 0, z: Infinity }, { x: '130', z: 341 }]) {
    assert.equal(shouldStayAtScenicSpot(player), false);
  }
});
