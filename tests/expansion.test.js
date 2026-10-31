import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { WORLD, OBSTACLES, LANDMARKS, BUILDING_APPROACHES, EXPANSION_CONNECTIONS, FRIEND_STARTS, ROAD_SEGMENTS, BUILDINGS, SQUARE, POND } from '../dist/world-data.js';
import { PARK, PARK_LANDMARK, PARK_OBSTACLES } from '../dist/park.js';
import { FIELD, FOOTBALL_LANDMARK, FOOTBALL_OBSTACLES } from '../dist/football.js';
import {
  HILL_TRAIL, DECK, RIVER, BRIDGES, COAST, MOUNTAINS, HILL_LANDMARK, LOOKOUT_LANDMARK, BRIDGE_LANDMARKS, BEACH_LANDMARK, MOUNTAIN_LANDMARK,
  TERRAIN_OBSTACLES, groundHeight, riverX, riverWidth,
} from '../dist/terrain-data.js';
import { MOUNTAIN_TRAIL_LANDMARK, SUMMIT_LANDMARK, isOnMountainRoute } from '../dist/mountain-route.js';

const radius = 2.7;
const obstacles = [...OBSTACLES, ...PARK_OBSTACLES, ...FOOTBALL_OBSTACLES, ...TERRAIN_OBSTACLES];
const landmarks = [...LANDMARKS, PARK_LANDMARK, FOOTBALL_LANDMARK, HILL_LANDMARK, LOOKOUT_LANDMARK, ...BRIDGE_LANDMARKS, BEACH_LANDMARK, MOUNTAIN_LANDMARK, MOUNTAIN_TRAIL_LANDMARK, SUMMIT_LANDMARK];

// Independent footprint checks exercise the assembled map, not just the
// navigation implementation or each attraction in isolation.
function obstruction(x, z) {
  const inset = WORLD.margin + radius;
  if (x < (WORLD.minX ?? 0) + inset || z < (WORLD.minZ ?? 0) + inset || x > WORLD.width - inset || z > WORLD.depth - inset) return 'world boundary';
  for (const obstacle of obstacles) {
    if (typeof obstacle.blocks === 'function') {
      if (obstacle.blocks(x, z, radius)) return obstacle.id;
    } else if (obstacle.radius !== undefined) {
      if (Math.hypot(x - obstacle.x, z - obstacle.z) < radius + obstacle.radius) return obstacle.id;
    } else {
      const dx = Math.max(obstacle.x - x, 0, x - obstacle.x - obstacle.w);
      const dz = Math.max(obstacle.z - z, 0, z - obstacle.z - obstacle.d);
      if (Math.hypot(dx, dz) < radius) return obstacle.id;
    }
  }
  return null;
}

function segmentSamples(points, spacing = .08) {
  const samples = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / spacing));
    for (let step = 1; step <= steps; step++) {
      samples.push([ax + (bx - ax) * step / steps, az + (bz - az) * step / steps]);
    }
  }
  return samples;
}

function renderedTrailSamples() {
  // The renderer uses this curve type; testing only its control points would
  // miss corners that curve into a tree, railing, or platform.
  const curve = new THREE.CatmullRomCurve3(HILL_TRAIL.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  return curve.getSpacedPoints(Math.ceil(curve.getLength() / .08)).map(point => [point.x, point.z]);
}

test('the combined world connects every landmark, building approach, and activity entry to the town square', () => {
  const start=LANDMARKS.find(p=>p.id==='town-square').arrival;
  const reached = new Set([`${Math.round(start.x)},${Math.round(start.z)}`]), occupancy = new Map(), heights = new Map();
  const queue = [[Math.round(start.x),Math.round(start.z)]];
  const height = (x, z, key) => {
    if (!heights.has(key)) heights.set(key, groundHeight(x, z));
    return heights.get(key);
  };
  for (let head = 0; head < queue.length; head++) {
    const [x, z] = queue[head], currentHeight = height(x, z, `${x},${z}`);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz, key = `${nx},${nz}`;
      if (reached.has(key)) continue;
      if (!occupancy.has(key)) occupancy.set(key, obstruction(nx, nz));
      if (occupancy.get(key)) continue;
      const nextHeight = height(nx, nz, key);
      if (!Number.isFinite(nextHeight) || Math.abs(nextHeight - currentHeight) > 1.1) continue;
      reached.add(key); queue.push([nx, nz]);
    }
  }
  const destinations = [
    ...landmarks.map(landmark => ({ name: landmark.name, ...landmark.arrival })),
    ...BUILDING_APPROACHES,
    ...EXPANSION_CONNECTIONS.map(entry => ({ name: `${entry.id} entrance`, ...entry })),
    ...FRIEND_STARTS.map((point, index) => ({ name: `Friend ${index + 1}`, ...point })),
  ];
  const failures = destinations.filter(point => obstruction(point.x,point.z)||![-1,0,1].some(dx=>[-1,0,1].some(dz=>reached.has(`${Math.round(point.x)+dx},${Math.round(point.z)+dz}`))))
    .map(point => `${point.name} (${point.x},${point.z}): ${obstruction(point.x, point.z) ?? 'no continuous walking route'}`);
  assert.deepEqual(failures, [], 'Some destinations are disconnected after combining the scenery');
});

test('the entire intended hill trail clears the combined scenery for a wide friend', () => {
  assert.deepEqual(HILL_TRAIL[0], [HILL_LANDMARK.arrival.x, HILL_LANDMARK.arrival.z]);
  const failures = new Map();
  for (const [kind, samples] of [['control segments', segmentSamples(HILL_TRAIL)], ['rendered curve', renderedTrailSamples()]]) {
    for (const [x, z] of samples) {
      const obstacle = obstruction(x, z);
      if (obstacle && !failures.has(`${kind}: ${obstacle}`)) {
        failures.set(`${kind}: ${obstacle}`, `at (${x.toFixed(2)},${z.toFixed(2)})`);
      }
    }
  }
  assert.deepEqual([...failures.entries()], [], 'The visible winding trail must stay passable all the way to the deck');
});

test('hill-trail elevation climbs continuously and meets the deck without a gap', () => {
  const samples = renderedTrailSamples();
  let previous = groundHeight(...samples[0]);
  assert.equal(previous, 0, 'The trail should meet the flat town ground');
  for (const [x, z] of samples.slice(1)) {
    const height = groundHeight(x, z);
    assert.ok(Number.isFinite(height) && height >= 0, `Invalid surface at ${x},${z}`);
    assert.ok(height >= previous - .015, `Trail unexpectedly drops from ${previous} to ${height} near ${x},${z}`);
    // Smooth terrain rises less than .08 per sample. The deck adds one small
    // .28-unit step, so allow it without accepting a disconnected platform.
    assert.ok(height - previous <= .35, `Gap or abrupt step near ${x},${z}`);
    previous = height;
  }
  assert.equal(previous, DECK.height, 'The path must arrive on the actual deck surface');
});

test('park, pitch, and every bridge remain connected and walkable in the complete town', () => {
  const routes = [
    [[PARK.entrance.x,PARK.entrance.z],[PARK_LANDMARK.arrival.x,PARK_LANDMARK.arrival.z]],
    [[FIELD.minX-6,FIELD.z],[FIELD.x,FIELD.z],[FOOTBALL_LANDMARK.arrival.x,FOOTBALL_LANDMARK.arrival.z]],
    ...BRIDGES.map(b=>[[b.x-b.span/2-6,b.z],[b.x+b.span/2+6,b.z]]),
  ];
  for(const route of routes)for(const [x,z] of segmentSamples(route)){
    assert.equal(obstruction(x,z),null,`Activity approach blocked near ${x},${z}`);
    assert.ok(Number.isFinite(groundHeight(x,z)));
  }
});

test('the river separates fifty west-bank homes from twenty east-bank homes and the attractions',()=>{
  const west=BUILDINGS.filter(b=>b.kind==='house'&&b.bank==='west');
  const east=BUILDINGS.filter(b=>b.kind==='house'&&b.bank==='east');
  assert.equal(west.length,50);assert.equal(east.length,20);
  for(const b of west)for(const z of [b.z-b.d/2,b.z,b.z+b.d/2])assert.ok(b.x+b.w/2+2<riverX(z)-riverWidth(z)/2,`${b.id} overlaps west bank`);
  for(const b of east)for(const z of [b.z-b.d/2,b.z,b.z+b.d/2])assert.ok(b.x-b.w/2-2>riverX(z)+riverWidth(z)/2,`${b.id} overlaps east bank`);
  assert.ok(PARK.bounds.minX>riverX(PARK.z)+riverWidth(PARK.z)/2);
  assert.ok(FIELD.minX>riverX(FIELD.z)+riverWidth(FIELD.z)/2);
  assert.ok(SQUARE.w*SQUARE.d>=64*56);
  assert.ok(POND.rx>=17&&POND.rz>=12);
});

test('the river cannot be bypassed on foot except through the three bridge corridors',()=>{
  assert.equal(BRIDGES.length,3);
  assert.ok(RIVER.startZ<MOUNTAINS.minZ&&RIVER.endZ>COAST.seaStart,'The water must run out of the mountains and into the sea');
  for(let z=MOUNTAINS.maxZ+3;z<COAST.seaStart;z+=.5){
    if(BRIDGES.some(b=>Math.abs(z-b.z)<b.width/2+radius))continue;
    assert.ok(obstruction(riverX(z),z),`Unprotected river crossing at z${z}`);
  }
  for(let x=5;x<WORLD.width-5;x+=2){
    if (!isOnMountainRoute(x, MOUNTAINS.maxZ - 1, radius)) {
      assert.ok(obstruction(x,MOUNTAINS.maxZ-1),`Mountain can be entered away from its trail at x${x}`);
    }
    assert.ok(obstruction(x,COAST.seaStart+2),`Sea can be entered at x${x}`);
  }
});
