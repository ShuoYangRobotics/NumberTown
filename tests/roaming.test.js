import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoamingController } from '../dist/roaming.js';
import { shouldStayAtScenicSpot } from '../dist/scenic-stay.js';
import { collides } from '../dist/navigation.js';
import { WORLD, OBSTACLES, LANDMARKS, FRIEND_STARTS } from '../dist/world-data.js';
import { CHARACTERS, getCharacterMetrics } from '../dist/character-data.js';
import { PARK_OBSTACLES, PARK_LANDMARK } from '../dist/park.js';
import { FOOTBALL_OBSTACLES, FOOTBALL_LANDMARK } from '../dist/football.js';
import { TERRAIN_OBSTACLES, groundHeight, HILL, DECK, HILL_TRAIL, BRIDGES, BRIDGE_LANDMARKS, BEACH_LANDMARK, riverX } from '../dist/terrain-data.js';
import { SUMMIT_DECK, MOUNTAIN_TRAIL } from '../dist/mountain-route.js';

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

test('a wide friend backs out of an occupied narrow crossing and takes a clear detour', () => {
  const world = { width: 100, depth: 100, margin: 1 };
  const obstacles = [{ x: 35, z: 0, w: 30, d: 24 }, { x: 35, z: 36, w: 30, d: 29 }];
  const player = friend(34, 15, 30, 3.0413812651491092);
  const active = Object.freeze(friend(31, 50, 30, 3.5355339059327378));
  const controller = createRoamingController({ obstacles, world, destinations: [place('west', 15, 30), place('east', 85, 30)], random: seeded(19) });
  let approached = false, detoured = false, reachedEast = false, visits = 0, frame = 0;
  for (; frame < 1600 && !reachedEast; frame++) {
    const previous = { x: player.x, z: player.z };
    controller.update([player, active], active, .1, frame / 10);
    const status = controller.stateFor(player);
    reachedEast ||= status.visits > visits && status.id === 'east'; visits = status.visits;
    approached ||= player.x > 38 && player.z < 36;
    detoured ||= player.x > 35 && player.x < 65 && player.z >= 65 + player.radius;
    assert.ok(Math.hypot(player.x - previous.x, player.z - previous.z) <= .28, 'backtracking must remain ordinary walking');
    assert.equal(collides(player.x, player.z, obstacles, world, player.radius), false);
    assert.ok(Math.hypot(player.x - active.x, player.z - active.z) >= player.radius + active.radius, 'the detour must never pass through the selected friend');
  }
  assert.ok(approached, 'exercise the blocked shorter crossing before rerouting');
  assert.ok(detoured, 'the route must go around the wall rather than wait forever at the visitor');
  assert.ok(reachedEast, 'a stationary friend in a narrow crossing must not prevent reaching the opposite side');
  const visitsBeforeReturn = controller.stateFor(player).visits;
  let returnedThroughCrossing = false;
  for (let step = 0; step < 800 && controller.stateFor(player).visits === visitsBeforeReturn; step++) {
    controller.update([player], null, .1, (frame + step) / 10);
    returnedThroughCrossing ||= player.x > 45 && player.x < 55 && player.z > 24 && player.z < 36;
    assert.equal(collides(player.x, player.z, obstacles, world, player.radius), false);
  }
  assert.ok(returnedThroughCrossing && controller.stateFor(player).visits > visitsBeforeReturn, 'the temporary visitor snapshot must not poison cached routes after the crossing clears');
});

test('all forty unselected friends keep exploring the assembled town within a frame budget', () => {
  assert.equal(CHARACTERS.length, 41);
  const players = CHARACTERS.map((character, index) => friend(character.number, FRIEND_STARTS[index].x, FRIEND_STARTS[index].z, getCharacterMetrics(character.number).radius));
  const active = players.find(p=>p.number===11), original = { ...active }, times = [], choices = players.map(() => new Set());
  const controller = createRoamingController({ obstacles: townObstacles, world: WORLD,
    destinations: [...LANDMARKS, PARK_LANDMARK, FOOTBALL_LANDMARK, ...BRIDGE_LANDMARKS, BEACH_LANDMARK],
    random: seeded(19), shouldStay: shouldStayAtScenicSpot });
  // Two cross-town trips can exceed five simulated minutes at walking speed.
  for (let frame = 0; frame < 6000; frame++) {
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
    assert.ok(controller.stateFor(players[index]).visits >= 2, `Friend ${players[index].number} did not keep exploring: ${JSON.stringify(controller.stateFor(players[index]))}`);
    assert.ok(choices[index].size >= 3, `Friend ${players[index].number} repeated only one destination`);
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

test('a never-controlled friend at the mountain summit can still walk down without teleporting', () => {
  // A previous shortest path stepped off this side of the deck onto a lower
  // loop. The side exit must be blocked or have a continuous walking surface.
  const oldExit = [{ x: 107.91205195822079, z: -5.9019596921179085 }, { x: 108.05176809958581, z: -6.042351162777199 }];
  if (oldExit.every(point => !collides(point.x, point.z, townObstacles, WORLD, 2.55))) {
    assert.ok(Math.abs(groundHeight(oldExit[0].x, oldExit[0].z) - groundHeight(oldExit[1].x, oldExit[1].z)) < .35, 'The former summit shortcut still has an abrupt drop');
  }
  const player = friend(20, SUMMIT_DECK.x, SUMMIT_DECK.z);
  const controller = createRoamingController({ obstacles: townObstacles, world: WORLD,
    destinations: [LANDMARKS.find(p => p.id === 'town-square')], random: seeded(9), shouldStay: shouldStayAtScenicSpot });
  controller.pause(player, 0);
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

test('controlled hill, trail, and summit visitors keep their latest position after switching away', () => {
  const scenic = [
    { x: DECK.x, z: DECK.z },
    { x: HILL.x, z: HILL.z - 20 },
    MOUNTAIN_TRAIL[460],
    { x: SUMMIT_DECK.x, z: SUMMIT_DECK.z },
  ];
  for (const point of scenic) {
    const visitor = friend(0, point.x, point.z, .7), active = friend(1, 90, 145, .7);
    const players = [visitor, active];
    assert.equal(shouldStayAtScenicSpot(visitor), true);
    assert.equal(collides(visitor.x, visitor.z, townObstacles, WORLD, visitor.radius), false);
    const controller = createRoamingController({ obstacles: townObstacles, world: WORLD,
      destinations: LANDMARKS, random: seeded(4), shouldStay: shouldStayAtScenicSpot });
    // Selection followed immediately by another selection must work even
    // before the animation loop has seen the first friend as active.
    controller.select(visitor, 0); controller.select(active, 0);
    let expected = { x: visitor.x, z: visitor.z };
    for (let frame = 0; frame < 3000; frame++) {
      const time = frame / 10;
      if (frame === 1000) {
        controller.select(visitor, time);
        visitor.x += .1; visitor.radius = 1.1; visitor.yaw = .9;
        controller.pause(visitor, time);
        controller.update(players, visitor, .1, time);
        expected = { x: visitor.x, z: visitor.z };
        controller.select(active, time);
      }
      if (frame % 200 === 0) controller.pause(visitor, time);
      controller.update(players, active, .1, time);
      assert.deepEqual({ x: visitor.x, z: visitor.z }, expected, 'the scenic view must survive selection, a new shape, and pauses');
      assert.equal(visitor.moving, false);
      assert.deepEqual(controller.stateFor(visitor), {
        state: 'staying', destination: null, id: null, pathRemaining: 0, visits: 0,
      });
    }
  }
});

test('walking or fast travel back to flat ground releases a controlled scenic visitor', () => {
  for (const method of ['walk', 'fast-travel']) {
    const visitor = friend(7, DECK.x, DECK.z, .7), active = friend(1, 90, 145, .7);
    const controller = createRoamingController({ obstacles: townObstacles, world: WORLD,
      destinations: [LANDMARKS.find(p => p.id === 'sunny-lanes')], random: seeded(7), shouldStay: shouldStayAtScenicSpot });
    controller.update([visitor, active], visitor, .1, 0);
    controller.update([visitor, active], active, .1, .1);
    assert.equal(controller.stateFor(visitor).state, 'staying');
    controller.select(visitor, .2);
    [visitor.x, visitor.z] = HILL_TRAIL[0];
    if (method === 'fast-travel') controller.pause(visitor, .2);
    else controller.update([visitor, active], visitor, .1, .2);
    assert.equal(shouldStayAtScenicSpot(visitor), false);
    const start = { x: visitor.x, z: visitor.z };
    controller.select(active, .3);
    for (let frame = 0; frame < 1000 && !controller.stateFor(visitor).visits; frame++) {
      controller.update([visitor, active], active, .1, .3 + frame / 10);
      assert.notEqual(controller.stateFor(visitor).state, 'staying');
      assert.equal(collides(visitor.x, visitor.z, townObstacles, WORLD, visitor.radius), false);
    }
    assert.ok(controller.stateFor(visitor).visits > 0, `${method}: wandering must resume after leaving the hill`);
    assert.ok(Math.hypot(visitor.x - start.x, visitor.z - start.z) > 5);
  }
});

test('fast travel and an immediate switch retain the new scenic position before the next frame', () => {
  const visitor = friend(0, 90, 145, .7), active = friend(1, 80, 145, .7);
  const controller = createRoamingController({ obstacles: townObstacles, world: WORLD,
    destinations: LANDMARKS, random: seeded(4), shouldStay: shouldStayAtScenicSpot });
  controller.select(visitor, 0);
  Object.assign(visitor, { x: SUMMIT_DECK.x, z: SUMMIT_DECK.z });
  controller.pause(visitor, 0);
  controller.select(active, 0);
  for (let frame = 0; frame < 100; frame++) controller.update([visitor, active], active, .1, frame / 10);
  assert.deepEqual({ x: visitor.x, z: visitor.z }, { x: SUMMIT_DECK.x, z: SUMMIT_DECK.z });
  assert.equal(controller.stateFor(visitor).state, 'staying');
});

test('a former controlled friend does not gain a scenic hold by wandering there autonomously', () => {
  const world = { width: 100, depth: 70, margin: 1 }, player = friend(0, 15, 35, .7);
  const controller = createRoamingController({ obstacles: [], world, destinations: [place('scenic-side', 80, 35)],
    random: seeded(3), shouldStay: visitor => visitor.x > 50 });
  controller.select(player, 0);
  for (let frame = 0; frame < 1000 && !controller.stateFor(player).visits; frame++) {
    controller.update([player], null, .1, frame / 10);
    assert.notEqual(controller.stateFor(player).state, 'staying');
  }
  assert.ok(controller.stateFor(player).visits > 0);
  assert.ok(player.x > 50);
});

test('scenic holds remove both active planning work and queued routes', () => {
  const world = { width: 210, depth: 210, margin: 1 };
  let collisionChecks = 0;
  const wall = { blocks: (x, z, radius) => { collisionChecks++; return Math.abs(x - 100) < radius + 1; } };
  const players = Array.from({ length: 6 }, (_, number) => friend(number, 12 + number * 4, 20, .7));
  const controller = createRoamingController({ obstacles: [wall], world,
    destinations: [place('opposite-side', 190, 20)], random: seeded(2), shouldStay: player => player.x < 100 });
  controller.update(players, null, 0, 0);
  controller.update(players, null, 0, 10);
  assert.ok(players.every(player => controller.stateFor(player).state === 'planning'), 'exercise a live search plus queued jobs');
  for (const player of players) controller.select(player, 10);
  const before = players.map(player => ({ x: player.x, z: player.z }));
  collisionChecks = 0;
  for (let frame = 0; frame < 1000; frame++) controller.update(players, null, .1, 10 + frame / 10);
  assert.equal(collisionChecks, 0, 'held friends must not retain or generate pathfinding work');
  assert.deepEqual(players.map(player => ({ x: player.x, z: player.z })), before);
  assert.ok(players.every(player => controller.stateFor(player).state === 'staying'));
});

test('a transformed wide friend routes around obstacles using its new footprint', () => {
  const world={width:110,depth:110,margin:1},player=friend(30,20,20,8);
  const obstacles=[{x:49,z:0,w:2,d:72}];
  const controller=createRoamingController({obstacles,world,destinations:[place('far-side',85,20)],random:seeded(17)});
  let crossed=false;
  for(let frame=0;frame<2400&&!controller.stateFor(player).visits;frame++){
    controller.update([player],null,.1,frame/10);
    assert.equal(collides(player.x,player.z,obstacles,world,player.radius),false,'A wide rectangle clipped a wall outside the normal spatial bucket');
    if(player.x>51)crossed=true;
  }
  assert.ok(crossed&&controller.stateFor(player).visits>0,'The larger shape needs a route with enough clearance');
});

test('roaming friends avoid a long selected rectangle before entering its footprint', () => {
  const world={width:100,depth:100,margin:1},player=friend(2,12,50,.8),selected=friend(30,45,50,15.1);
  const controller=createRoamingController({obstacles:[],world,destinations:[place('across-square',80,50)],random:seeded(8)});
  for(let frame=0;frame<1000;frame++){
    controller.update([player,selected],selected,.1,frame/10);
    assert.ok(Math.hypot(player.x-selected.x,player.z-selected.z)>=player.radius+selected.radius,'The two transformed footprints overlap');
  }
  assert.ok(Math.hypot(player.x-12,player.z-50)>8,'The unselected friend must keep exploring');
});


test('a long rectangle keeps strolling when only one roomy destination fits', () => {
  const world={width:100,depth:100,margin:1},player=friend(30,50,50,15.01);
  const controller=createRoamingController({obstacles:[],world,destinations:[place('open-field',50,50)],random:seeded(27)});
  for(let frame=0;frame<1800;frame++)controller.update([player],null,.1,frame/10);
  assert.ok(controller.stateFor(player).visits>=4,'A single accessible destination must not stop further walking');
});
