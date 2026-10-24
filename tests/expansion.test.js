import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { WORLD, OBSTACLES, LANDMARKS, BUILDING_APPROACHES, EXPANSION_CONNECTIONS, FRIEND_STARTS, ROAD_SEGMENTS } from '../dist/world-data.js';
import { PARK_LANDMARK, PARK_OBSTACLES } from '../dist/park.js';
import { FIELD, FOOTBALL_LANDMARK, FOOTBALL_OBSTACLES } from '../dist/football.js';
import {
  HILL_TRAIL, DECK, RIVER, HILL_LANDMARK, LOOKOUT_LANDMARK, RIVER_LANDMARK,
  TERRAIN_OBSTACLES, groundHeight, riverX,
} from '../dist/terrain-data.js';

const radius = 2.7;
const obstacles = [...OBSTACLES, ...PARK_OBSTACLES, ...FOOTBALL_OBSTACLES, ...TERRAIN_OBSTACLES];
const landmarks = [...LANDMARKS, PARK_LANDMARK, FOOTBALL_LANDMARK, HILL_LANDMARK, LOOKOUT_LANDMARK, RIVER_LANDMARK];

// Independent footprint checks exercise the assembled map, not just the
// navigation implementation or each attraction in isolation.
function obstruction(x, z) {
  const inset = WORLD.margin + radius;
  if (x < inset || z < inset || x > WORLD.width - inset || z > WORLD.depth - inset) return 'world boundary';
  for (const obstacle of obstacles) {
    if (obstacle.radius !== undefined) {
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
  const reached = new Set(['48,47']), occupancy = new Map(), heights = new Map();
  const queue = [[48, 47]];
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
  const failures = destinations.filter(point => !reached.has(`${point.x},${point.z}`))
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

test('park, football, and bridge approaches stay clear when all attraction footprints are combined', () => {
  const bridgeX = riverX(RIVER.bridgeZ);
  const routes = [
    [[220, 80], [PARK_LANDMARK.arrival.x, PARK_LANDMARK.arrival.z]],
    [[210, 149], [FIELD.x, FIELD.z], [FOOTBALL_LANDMARK.arrival.x, FOOTBALL_LANDMARK.arrival.z]],
    [[146, 190], [bridgeX + RIVER.bridgeSpan / 2 + 4, 190]],
  ];
  for (const route of routes) for (const [x, z] of segmentSamples(route)) {
    assert.equal(obstruction(x, z), null, `Activity approach blocked near ${x},${z}`);
    assert.ok(Number.isFinite(groundHeight(x, z)), `Missing approach surface near ${x},${z}`);
  }
});

test('the actual park approach streets turn before the arch and clear both gate posts', () => {
  const roads = ['rainbow-street-77', 'park-approach-turn', 'park-entry'].map(id => {
    const road = ROAD_SEGMENTS.find(segment => segment.id === id);
    assert.ok(road, `Missing park connector ${id}`);
    return road;
  });
  for (const [index, road] of roads.entries()) {
    if (index) assert.deepEqual([road.x1, road.z1], [roads[index - 1].x2, roads[index - 1].z2], 'Park streets must meet');
    for (const [x, z] of segmentSamples([[road.x1, road.z1], [road.x2, road.z2]])) {
      assert.equal(obstruction(x, z), null, `${road.id} runs too close to scenery near ${x},${z}`);
    }
  }
  assert.deepEqual([roads.at(-1).x2, roads.at(-1).z2], [220, 80], 'Approach should meet the middle of the park gate');
});
