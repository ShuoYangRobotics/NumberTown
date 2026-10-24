import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collides,
  movementVector,
  moveWithCollisions,
  nearestOpenPosition,
} from '../dist/physics.js';

const world = { width: 1000, height: 1000 };
const project = ({ x, y }) => ({ x: .9 * (x - y), y: .45 * (x + y) });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);

test('WASD motion follows screen directions under the isometric projection', () => {
  for (const [horizontal, vertical] of [[0, -1], [-1, 0], [0, 1], [1, 0]]) {
    const screen = project(movementVector(horizontal, vertical, 150));
    close(screen.x, horizontal * 150);
    close(screen.y, vertical * 150);
  }
  assert.deepEqual(movementVector(0, 0), { x: 0, y: 0 });
});

test('diagonal movement has the same screen speed as cardinal movement', () => {
  for (const horizontal of [-1, 0, 1]) {
    for (const vertical of [-1, 0, 1]) {
      if (!horizontal && !vertical) continue;
      const screen = project(movementVector(horizontal, vertical, 150));
      close(Math.hypot(screen.x, screen.y), 150);
    }
  }
});

test('large movement cannot tunnel through a thin vertical wall in either direction', () => {
  const obstacles = [{ x: 500, y: 0, w: 1, d: 1000 }];
  const left = { x: 100, y: 450 };
  moveWithCollisions(left, 800, 0, obstacles, world);
  assert.ok(left.x > 470 && left.x <= 486);
  assert.equal(collides(left.x, left.y, obstacles, world), false);

  const right = { x: 900, y: 450 };
  moveWithCollisions(right, -800, 0, obstacles, world);
  assert.ok(right.x >= 515 && right.x < 530);
  assert.equal(collides(right.x, right.y, obstacles, world), false);
});

test('large movement cannot tunnel through a thin horizontal wall in either direction', () => {
  const obstacles = [{ x: 0, y: 500, w: 1000, d: 1 }];
  for (const [start, delta, boundary, direction] of [[100, 800, 486, -1], [900, -800, 515, 1]]) {
    const player = { x: 450, y: start };
    moveWithCollisions(player, 0, delta, obstacles, world);
    assert.ok(direction * (player.y - boundary) >= 0);
    assert.ok(Math.abs(player.y - boundary) < 6);
    assert.equal(collides(player.x, player.y, obstacles, world), false);
  }
});

test('characters slide along a wall while their blocked axis stays outside it', () => {
  const obstacles = [{ x: 300, y: 0, w: 40, d: 1000 }];
  const player = { x: 100, y: 100 };
  moveWithCollisions(player, 700, 350, obstacles, world);
  assert.ok(player.x <= 286 && player.x >= 281);
  close(player.y, 450);
  assert.equal(collides(player.x, player.y, obstacles, world), false);
});

test('jumping changes no ground collision behavior', () => {
  const obstacles = [{ x: 300, y: 0, w: 40, d: 1000 }];
  const walking = { x: 100, y: 400, jump: 0, jumpVelocity: 0 };
  const jumping = { x: 100, y: 400, jump: 80, jumpVelocity: 260 };
  moveWithCollisions(walking, 500, 75, obstacles, world);
  moveWithCollisions(jumping, 500, 75, obstacles, world);
  assert.equal(jumping.x, walking.x);
  assert.equal(jumping.y, walking.y);
  assert.equal(jumping.jump, 80);
  assert.ok(jumping.x <= 286);
});

test('world edges contain characters and allow movement along the boundary', () => {
  for (const [dx, dy] of [[-2000, 0], [2000, 0], [0, -2000], [0, 2000], [-2000, 2000], [2000, -2000]]) {
    const player = { x: 500, y: 500 };
    moveWithCollisions(player, dx, dy, [], world);
    assert.ok(player.x >= 26 && player.x <= 974);
    assert.ok(player.y >= 26 && player.y <= 974);
    assert.equal(collides(player.x, player.y, [], world), false);
  }
  const player = { x: 26, y: 500 };
  moveWithCollisions(player, -100, 100, [], world);
  close(player.x, 26);
  close(player.y, 600);
});

test('spawn recovery leaves open positions unchanged and finds space outside an obstacle', () => {
  const obstacles = [{ x: 400, y: 400, w: 200, d: 200 }];
  const open = { x: 200, y: 200 };
  assert.deepEqual(nearestOpenPosition(open, obstacles, world), open);
  const trapped = { x: 500, y: 500 };
  const recovered = nearestOpenPosition(trapped, obstacles, world);
  assert.equal(collides(recovered.x, recovered.y, obstacles, world), false);
  assert.deepEqual(trapped, { x: 500, y: 500 }, 'spawn resolution must not mutate the requested position');
  const beyondEdge = nearestOpenPosition({ x: 0, y: 0 }, [], world);
  assert.equal(collides(beyondEdge.x, beyondEdge.y, [], world), false);
});

test('a fully blocked town reports the absence of a valid spawn', () => {
  assert.throws(
    () => nearestOpenPosition({ x: 500, y: 500 }, [{ x: 0, y: 0, w: 1000, d: 1000 }], world),
    /open walking space/,
  );
});

test('wide characters cannot squeeze through a gap that fits a one-block friend', () => {
  const obstacles = [
    { x: 400, y: 0, w: 200, d: 480 },
    { x: 400, y: 520, w: 200, d: 480 },
  ];
  const narrow = { x: 100, y: 500, radius: 14 };
  const wide = { x: 100, y: 500, radius: 32 };
  moveWithCollisions(narrow, 800, 0, obstacles, world);
  moveWithCollisions(wide, 800, 0, obstacles, world);
  close(narrow.x, 900);
  assert.ok(wide.x <= 368 && wide.x > 360, 'Nine should stop before the narrow passage');
  assert.equal(collides(wide.x, wide.y, obstacles, world, wide.radius), false);
  assert.equal(collides(500, 500, obstacles, world, 14), false);
  assert.equal(collides(500, 500, obstacles, world, 32), true);
});

test('an explicit footprint overrides player width and spawn recovery respects wide bodies', () => {
  const obstacles = [{ x: 500, y: 0, w: 1, d: 1000 }];
  const player = { x: 100, y: 450, radius: 14 };
  moveWithCollisions(player, 800, 0, obstacles, world, 32);
  assert.ok(player.x <= 468 && player.x > 460);
  assert.equal(collides(player.x, player.y, obstacles, world, 32), false);

  const tooClose = { x: 480, y: 450 };
  assert.equal(collides(tooClose.x, tooClose.y, obstacles, world, 14), false);
  assert.equal(collides(tooClose.x, tooClose.y, obstacles, world, 32), true);
  const recovered = nearestOpenPosition(tooClose, obstacles, world, 32);
  assert.notDeepEqual(recovered, tooClose, 'a wide character needs a different spawn here');
  assert.equal(collides(recovered.x, recovered.y, obstacles, world, 32), false);
});
