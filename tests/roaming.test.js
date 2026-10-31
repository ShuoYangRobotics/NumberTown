import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoamingController } from '../dist/roaming.js';
import { collides } from '../dist/navigation.js';
import { WORLD, OBSTACLES, LANDMARKS, FRIEND_STARTS } from '../dist/world-data.js';
import { CHARACTERS, getCharacterMetrics } from '../dist/character-data.js';
import { PARK_OBSTACLES, PARK_LANDMARK } from '../dist/park.js';
import { FOOTBALL_OBSTACLES, FOOTBALL_LANDMARK } from '../dist/football.js';
import { TERRAIN_OBSTACLES, groundHeight, BRIDGES, BRIDGE_LANDMARKS, BEACH_LANDMARK, riverX } from '../dist/terrain-data.js';
import { SUMMIT_DECK } from '../dist/mountain-route.js';

const townObstacles = [...OBSTACLES, ...PARK_OBSTACLES, ...FOOTBALL_OBSTACLES, ...TERRAIN_OBSTACLES];
const friend = (number, x, z, radius = 2.55) => ({ number, x, z, radius, moving: false, yaw: 0 });
function seeded(seed = 32) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
const place = (id, x, z) => ({ id, name: id, arrival: { x, z } });

test('the selected friend is entirely untouched, pauses cancel old routes, and destinations vary', () => {
  const world = { width: 90, depth: 90, margin: 2 }, player = friend(1, 15, 15, .8);
  const active = Object.freeze(friend(20, 65, 65));
  const controller = createRoamingController({ obstacles: [], world, destinations: [place('one', 15, 15), place('two', 70, 15), place('three', 30, 60)], random: seeded() });
  const original = { ...active }, destinations = new Set();
  for (let frame = 0; frame < 1800; frame++) {
    controller.update([player, active], active, .1, frame / 10);
    const status = controller.stateFor(player);
    if (status.id) destinations.add(status.id);
    assert.ok(Object.isFrozen(status));
  }
  assert.deepEqual(active, original);
  assert.ok(controller.stateFor(player).visits >= 3);
  assert.equal(destinations.size, 3);
  controller.pause(player, 180);
  player.x = 20; player.z = 70; player.yaw = .42; player.moving = true;
  const selected = { ...player };
  for (let frame = 0; frame < 50; frame++) controller.update([player], player, .1, 180 + frame / 10);
  assert.deepEqual(player, selected);
  for (let frame = 0; frame < 200; frame++) controller.update([player], null, .1, 185 + frame / 10);
  assert.ok(Math.hypot(player.x - selected.x, player.z - selected.z) > 5, 'A newly unselected friend should resume from its current location');
});

test('a wide friend walks between west and east town destinations using a real bridge without teleporting', () => {
  const player = friend(15, 90, 145, 2.7);
  const controller = createRoamingController({ obstacles: townObstacles, world: WORLD,
    destinations: [LANDMARKS.find(p => p.id === 'town-square'), LANDMARKS.find(p => p.id === 'eastbank')], random: seeded(8) });
  let crossed = false, lastBank = -1, maximumUpdate = 0;
  const destinations = new Set();
  for (let frame = 0; frame < 4000 && controller.stateFor(player).visits < 2; frame++) {
    const before = { x: player.x, z: player.z }, start = performance.now();
    controller.update([player], null, .1, frame / 10);
    maximumUpdate = Math.max(maximumUpdate, performance.now() - start);
    assert.ok(Math.hypot(player.x - before.x, player.z - before.z) <= .28, 'An NPC teleported or exceeded its walking speed');
    assert.equal(collides(player.x, player.z, townObstacles, WORLD, player.radius), false, `NPC crossed scenery at ${player.x},${player.z}`);
    const bank = Math.sign(player.x - riverX(player.z));
    if (bank !== lastBank) {
      crossed = true;
      assert.ok(BRIDGES.some(bridge => Math.abs(player.z - bridge.z) < bridge.width / 2 - player.radius), 'The river was crossed outside a bridge');
    }
    lastBank = bank;
    if (controller.stateFor(player).id) destinations.add(controller.stateFor(player).id);
  }
  assert.ok(crossed, 'The NPC never reached the opposite riverbank');
  assert.ok(controller.stateFor(player).visits >= 2, 'The NPC failed to complete both trips');
  assert.equal(destinations.size, 2);
  // Allow occasional CI/GC scheduling noise while catching synchronous full-map
  // floods. Normal per-frame work is explicitly time-sliced by the controller.
  assert.ok(maximumUpdate < 100, `Roaming blocked an update for ${maximumUpdate.toFixed(1)}ms`);
});

test('friends yield around one another without overlapping or becoming permanently stuck', () => {
  const world = { width: 100, depth: 60, margin: 2 };
  const obstacles = [{ x: 0, z: 0, w: 100, d: 23 }, { x: 0, z: 37, w: 100, d: 23 }];
  const players = [friend(1, 18, 30), friend(2, 82, 30)];
  const controller = createRoamingController({ obstacles, world, destinations: [place('west', 18, 30), place('east', 82, 30)], random: seeded(12) });
  for (let frame = 0; frame < 1400; frame++) {
    controller.update(players, null, .1, frame / 10);
    assert.ok(Math.hypot(players[0].x - players[1].x, players[0].z - players[1].z) >= 5.1 - 1e-6, 'Friends overlapped while passing');
    for (const player of players) assert.equal(collides(player.x, player.z, obstacles, world, player.radius), false);
  }
  for (const player of players) assert.ok(controller.stateFor(player).visits >= 1, 'A friend remained trapped behind another visitor');
});

test('all nineteen unselected friends keep exploring the assembled town within a frame budget', () => {
  assert.equal(CHARACTERS.length, 20);
  const players = FRIEND_STARTS.map((point, index) => friend(index + 1, point.x, point.z, getCharacterMetrics(index + 1).radius));
  const active = players[10], original = { ...active }, times = [], choices = players.map(() => new Set());
  const controller = createRoamingController({ obstacles: townObstacles, world: WORLD,
    destinations: [...LANDMARKS, PARK_LANDMARK, FOOTBALL_LANDMARK, ...BRIDGE_LANDMARKS, BEACH_LANDMARK], random: seeded(19) });
  for (let frame = 0; frame < 3000; frame++) {
    const started = performance.now();
    controller.update(players, active, .1, frame / 10);
    times.push(performance.now() - started);
    for (let index = 0; index < players.length; index++) {
      const player = players[index], status = controller.stateFor(player);
      if (status.id) choices[index].add(status.id);
      assert.equal(collides(player.x, player.z, townObstacles, WORLD, player.radius), false);
      for (const other of players.slice(index + 1)) {
        assert.ok(Math.hypot(player.x - other.x, player.z - other.z) >= player.radius + other.radius - 1e-6, 'Visitors overlapped in the full town');
      }
    }
  }
  assert.deepEqual(active, original);
  for (let index = 0; index < players.length; index++) {
    if (players[index] === active) continue;
    assert.ok(controller.stateFor(players[index]).visits >= 2, `Friend ${index + 1} did not keep exploring`);
    assert.ok(choices[index].size >= 3, `Friend ${index + 1} repeated only one destination`);
  }
  times.sort((a, b) => a - b);
  assert.ok(times[Math.floor(times.length * .99)] < 20, 'Planning consumed the browser frame budget on more than 1% of frames');
});

test('an unreachable destination is abandoned and a reachable alternative is visited', () => {
  const world = { width: 70, depth: 70, margin: 2 }, player = friend(1, 12, 12, 1);
  const obstacles = [
    { x: 35, z: 35, w: 25, d: 2 }, { x: 35, z: 58, w: 25, d: 2 },
    { x: 35, z: 35, w: 2, d: 25 }, { x: 58, z: 35, w: 2, d: 25 },
  ];
  const controller = createRoamingController({ obstacles, world,
    destinations: [place('reachable', 12, 55), place('enclosed', 47, 47)], random: () => .99 });
  let attemptedEnclosed = false, visitedReachable = false;
  for (let frame = 0; frame < 1600; frame++) {
    controller.update([player], null, .1, frame / 10);
    const status = controller.stateFor(player);
    attemptedEnclosed ||= status.id === 'enclosed';
    visitedReachable ||= status.visits > 0;
    assert.equal(collides(player.x, player.z, obstacles, world, player.radius), false);
    if (visitedReachable) break;
  }
  assert.ok(attemptedEnclosed, 'The test must exercise a genuinely unreachable target');
  assert.ok(visitedReachable, 'An impossible target froze the NPC forever');
});

test('large frame gaps cannot tunnel through thin walls or move the active friend', () => {
  const world = { width: 70, depth: 70, margin: 2 }, player = friend(1, 15, 15, .7);
  const wall = { x: 34.9, z: 2, w: .2, d: 50 }, obstacles = [wall];
  const controller = createRoamingController({ obstacles, world, destinations: [place('other-side', 55, 15)], random: seeded(5) });
  for (let frame = 0; frame < 1300; frame++) {
    const before = { ...player };
    controller.update([player], null, frame % 10 ? .1 : 5, frame / 10);
    assert.ok(Math.hypot(player.x - before.x, player.z - before.z) <= .28);
    assert.equal(collides(player.x, player.z, obstacles, world, player.radius), false);
    if ((before.x - 35) * (player.x - 35) < 0) assert.ok(player.z > 52.7, 'The NPC tunneled through the thin wall');
  }
  assert.ok(controller.stateFor(player).visits >= 1, 'The NPC did not find the route around the wall');
});

test('a friend left at the mountain summit can walk down to town without teleporting', () => {
  // A previous shortest path stepped off this side of the deck onto a lower
  // loop. The side exit must be blocked or have a continuous walking surface.
  const oldExit = [{ x: 107.91205195822079, z: -5.9019596921179085 }, { x: 108.05176809958581, z: -6.042351162777199 }];
  if (oldExit.every(point => !collides(point.x, point.z, townObstacles, WORLD, 2.55))) {
    assert.ok(Math.abs(groundHeight(oldExit[0].x, oldExit[0].z) - groundHeight(oldExit[1].x, oldExit[1].z)) < .35, 'The former summit shortcut still has an abrupt drop');
  }
  const player = friend(20, SUMMIT_DECK.x, SUMMIT_DECK.z);
  const controller = createRoamingController({ obstacles: townObstacles, world: WORLD,
    destinations: [LANDMARKS.find(p => p.id === 'town-square')], random: seeded(9) });
  let previousHeight = groundHeight(player.x, player.z), descended = false;
  for (let frame = 0; frame < 5000 && !controller.stateFor(player).visits; frame++) {
    const before = { x: player.x, z: player.z };
    controller.update([player], null, .1, frame / 10);
    assert.ok(Math.hypot(player.x - before.x, player.z - before.z) <= .28);
    assert.equal(collides(player.x, player.z, townObstacles, WORLD, player.radius), false);
    const height = groundHeight(player.x, player.z);
    assert.ok(Math.abs(height - previousHeight) < .35, 'The NPC cut across a steep mountain drop');
    previousHeight = height; descended ||= height < 1;
  }
  assert.ok(descended && controller.stateFor(player).visits >= 1, 'The unselected summit visitor never returned to town');
});
