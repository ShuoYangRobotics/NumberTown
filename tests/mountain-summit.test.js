import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { WORLD, MOUNTAINS, riverX, riverWidth } from '../dist/geography.js';
import { CHARACTERS, getCharacterMetrics } from '../dist/character-data.js';
import { OBSTACLES, LANDMARKS, FRIEND_STARTS, BUILDINGS } from '../dist/world-data.js';
import { PARK_OBSTACLES } from '../dist/park.js';
import { FOOTBALL_OBSTACLES } from '../dist/football.js';
import { TERRAIN_OBSTACLES, groundHeight } from '../dist/terrain-data.js';
import { collides, moveWithCollisions } from '../dist/navigation.js';
import { createLandscape } from '../dist/terrain.js';
import {
  SUMMIT, SUMMIT_DECK, MOUNTAIN_TRAIL, MOUNTAIN_TRAIL_LANDMARK,
  SUMMIT_LANDMARK, mountainHeight, mountainWalkHeight, isOnMountainRoute,
} from '../dist/mountain-route.js';

const widest = 2.7;
const obstacles = [...OBSTACLES, ...PARK_OBSTACLES, ...FOOTBALL_OBSTACLES, ...TERRAIN_OBSTACLES];
const close = (actual, expected, tolerance = 1e-5, message = '') =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} differs from ${expected}`);

function samples(spacing = .1) {
  const result = [{ ...MOUNTAIN_TRAIL[0] }];
  for (let index = 1; index < MOUNTAIN_TRAIL.length; index++) {
    const a = MOUNTAIN_TRAIL[index - 1], b = MOUNTAIN_TRAIL[index];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / spacing));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  return result;
}

// Project actual world-space mesh triangles into a spatial index. This check
// deliberately does not infer support from the walking height implementation.
function surfaceIndex(object) {
  assert.ok(object, 'Expected a named rendered surface');
  const buckets = new Map(), size = 3, vector = new THREE.Vector3(), instance = new THREE.Matrix4();
  object.traverse(mesh => {
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute('position'), index = mesh.geometry.index;
    const count = index?.count ?? position.count;
    for (let copy = 0; copy < (mesh.isInstancedMesh ? mesh.count : 1); copy++) {
      const matrix = mesh.matrixWorld.clone();
      if (mesh.isInstancedMesh) { mesh.getMatrixAt(copy, instance); matrix.multiply(instance); }
      for (let offset = 0; offset < count; offset += 3) {
        const vertices = [0, 1, 2].map(corner => {
          const id = index ? index.getX(offset + corner) : offset + corner;
          vector.fromBufferAttribute(position, id).applyMatrix4(matrix);
          return { x: vector.x, y: vector.y, z: vector.z };
        });
        const [a, b, c] = vertices;
        const area = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
        if (Math.abs(area) < 1e-9) continue;
        const triangle = { vertices, area };
        const xs = vertices.map(v => v.x / size), zs = vertices.map(v => v.z / size);
        for (let x = Math.floor(Math.min(...xs)); x <= Math.floor(Math.max(...xs)); x++) {
          for (let z = Math.floor(Math.min(...zs)); z <= Math.floor(Math.max(...zs)); z++) {
            const key = `${x},${z}`;
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key).push(triangle);
          }
        }
      }
    }
  });
  return (x, z) => {
    let highest = -Infinity;
    for (const { vertices: [a, b, c], area } of buckets.get(`${Math.floor(x / size)},${Math.floor(z / size)}`) ?? []) {
      const u = ((b.x - x) * (c.z - z) - (b.z - z) * (c.x - x)) / area;
      const v = ((c.x - x) * (a.z - z) - (c.z - z) * (a.x - x)) / area;
      const w = 1 - u - v;
      if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue;
      highest = Math.max(highest, u * a.y + v * b.y + w * c.y);
    }
    return Number.isFinite(highest) ? highest : null;
  };
}

let rendered;
function surfaces() {
  if (rendered) return rendered;
  const { root } = createLandscape(); root.updateMatrixWorld(true);
  rendered = {
    trail: surfaceIndex(root.getObjectByName('Paved mountain spiral')),
    deck: surfaceIndex(root.getObjectByName('Mountain summit deck')),
    mountain: surfaceIndex(root.getObjectByName('Rugged northern mountain range')),
  };
  return rendered;
}
function renderedSupport(x, z) {
  const { trail, deck } = surfaces();
  const heights = [trail(x, z), deck(x, z)].filter(height => height !== null);
  return heights.length ? Math.max(...heights) : null;
}

test('the mountain trail starts on town ground and reaches a substantial summit north of town', () => {
  const start = MOUNTAIN_TRAIL[0], end = MOUNTAIN_TRAIL.at(-1);
  assert.equal(MOUNTAIN_TRAIL_LANDMARK.id, 'mountain-trail');
  assert.equal(SUMMIT_LANDMARK.id, 'summit');
  close(start.x, MOUNTAIN_TRAIL_LANDMARK.arrival.x);
  close(start.z, MOUNTAIN_TRAIL_LANDMARK.arrival.z);
  close(start.y, 0);
  close(end.x, SUMMIT_DECK.x); close(end.z, SUMMIT_DECK.z);
  close(end.y, SUMMIT_DECK.height);
  assert.ok(end.y >= 60, 'The new route must climb the mountain, not the existing small hill');
  assert.ok(MOUNTAIN_TRAIL.some(point => point.z < 0), 'The route must use the newly accessible northern terrain');
  assert.ok(WORLD.minZ <= -80);
  assert.ok(SUMMIT.pathWidth >= 9, 'The paved route needs room for the widest friend and steering');
  assert.ok(SUMMIT_DECK.width >= 14 && SUMMIT_DECK.depth >= 12);
});

test('ascent is continuous with a walkable grade and meets both ground and deck without a jump', () => {
  const route = samples();
  let previous = route[0], previousHeight = groundHeight(previous.x, previous.z);
  close(previousHeight, 0, .08, 'Town to trail transition');
  for (const point of route.slice(1)) {
    const height = groundHeight(point.x, point.z), distance = Math.hypot(point.x - previous.x, point.z - previous.z);
    assert.ok(Number.isFinite(height), `Nonfinite walking surface at ${point.x},${point.z}`);
    assert.ok(height >= previousHeight - .015, `The ascending route dips at ${point.x},${point.z}`);
    assert.ok(Math.abs(height - previousHeight) <= distance * .7 + .015, `Abrupt grade at ${point.x},${point.z}`);
    close(height, point.y, .15, `Walking surface diverges from route at ${point.x},${point.z}`);
    assert.notEqual(mountainWalkHeight(point.x, point.z), null);
    previous = point; previousHeight = height;
  }
  close(previousHeight, SUMMIT_DECK.height, .08, 'Trail to deck transition');
});

test('all fifteen character footprints can walk the complete route and the widest can return', () => {
  assert.equal(CHARACTERS.length, 15);
  const route = samples(.16);
  const footprints = CHARACTERS.map(character => ({ name: character.name, radius: getCharacterMetrics(character.number).radius }));
  footprints.push({ name: 'Conservative widest footprint', radius: widest });
  for (const { name, radius } of footprints) {
    assert.ok(radius <= widest);
    const player = { x: route[0].x, z: route[0].z, radius };
    for (const point of route) {
      moveWithCollisions(player, point.x - player.x, point.z - player.z, obstacles, WORLD);
      assert.ok(Math.hypot(player.x - point.x, player.z - point.z) < 1e-6, `${name} cannot pass at ${point.x},${point.z}`);
      assert.equal(collides(player.x, player.z, obstacles, WORLD, radius), false);
    }
    if (radius === widest) {
      for (const point of [...route].reverse()) {
        moveWithCollisions(player, point.x - player.x, point.z - player.z, obstacles, WORLD);
        assert.ok(Math.hypot(player.x - point.x, player.z - point.z) < 1e-6, 'The descent gets stuck at a bend or entrance');
      }
    }
  }
});

test('actual rendered paving supports the entire wide footprint through the ascent and deck join', () => {
  const { mountain } = surfaces();
  let checked = 0;
  for (const point of samples(.8)) {
    for (let ring = 0; ring < 2; ring++) for (let angle = 0; angle < (ring ? 16 : 1); angle++) {
      const x = point.x + Math.cos(angle * Math.PI / 8) * widest * ring;
      const z = point.z + Math.sin(angle * Math.PI / 8) * widest * ring;
      const surface = renderedSupport(x, z);
      // The south half of the trailhead footprint rests on the existing flat
      // town avenue, beyond the new mountain paving's terminal edge.
      if (surface === null && z >= MOUNTAIN_TRAIL[0].z && groundHeight(x, z) === 0) continue;
      assert.notEqual(surface, null, `Visible paving has a hole under the footprint at ${x},${z}`);
      const walking = mountainWalkHeight(x, z);
      assert.notEqual(walking, null, `Footprint falls outside the walking surface at ${x},${z}`);
      close(surface, walking, .16, `Visible paving and walking elevation disagree at ${x},${z}`);
      const rock = mountain(x, z);
      if (rock !== null) assert.ok(rock <= surface + .025, `Paving is buried in the mountain at ${x},${z}`);
      assert.ok(Number.isFinite(mountainHeight(x, z)));
      checked++;
    }
  }
  assert.ok(checked > 3000, 'Sample the full route, not just the endpoints');
});

test('summit rails and route boundaries keep wide friends supported during attempted shortcuts', () => {
  let stopped = 0;
  const starts = [
    { x: SUMMIT_DECK.x, z: SUMMIT_DECK.z },
    ...MOUNTAIN_TRAIL.filter((_, index) => index % 50 === 0 && index > 30),
  ];
  for (const start of starts) {
    for (let direction = 0; direction < 12; direction++) {
      const player = { x: start.x, z: start.z, radius: widest };
      const dx = Math.cos(direction * Math.PI / 6) * .2, dz = Math.sin(direction * Math.PI / 6) * .2;
      for (let step = 0; step < 80; step++) {
        const moved = moveWithCollisions(player, dx, dz, obstacles, WORLD);
        if (moved < .01) { stopped++; break; }
        if (player.z >= MOUNTAINS.maxZ + widest) continue;
        assert.equal(isOnMountainRoute(player.x, player.z, widest), true, 'Movement escaped the protected trail/deck corridor');
        assert.notEqual(renderedSupport(player.x, player.z), null, 'Movement left the visible walking surface');
        if (step % 4 === 0) for (let angle = 0; angle < 16; angle++) {
          // Offset these probes from the corridor's own circumference samples.
          const radians = angle * Math.PI / 8 + Math.PI / 32;
          const x = player.x + Math.cos(radians) * widest;
          const z = player.z + Math.sin(radians) * widest;
          assert.notEqual(renderedSupport(x, z), null, `A permitted footprint hangs over the mountain/deck edge at ${x},${z}`);
        }
      }
    }
  }
  assert.ok(stopped >= 20, 'The boundary test must actually reach and exercise the rails and trail edges');
  // A regular grid catches new openings far from sampled trail turns and
  // confirms that the river gorge cannot become a second mountain crossing.
  for (let z = (WORLD.minZ ?? 0) + 5; z < MOUNTAINS.maxZ; z += 4) {
    for (let x = 8; x < WORLD.width - 8; x += 5) {
      if (!isOnMountainRoute(x, z, widest)) assert.equal(collides(x, z, obstacles, WORLD, widest), true, `Off-route mountain shortcut at ${x},${z}`);
    }
    assert.equal(collides(riverX(z), z, obstacles, WORLD, widest), true, `The new route opens the river gorge at z=${z}`);
    assert.ok(SUMMIT_DECK.x + SUMMIT_DECK.width / 2 < riverX(z) - riverWidth(z) / 2);
  }
});

test('the original town spawns, building counts, and low terrain remain unchanged', () => {
  assert.equal(BUILDINGS.filter(building => building.kind === 'house' && building.bank === 'west').length, 50);
  assert.equal(BUILDINGS.filter(building => building.kind === 'house' && building.bank === 'east').length, 20);
  for (const point of FRIEND_STARTS) {
    assert.equal(collides(point.x, point.z, obstacles, WORLD, widest), false);
    close(groundHeight(point.x, point.z), 0);
  }
  for (const landmark of LANDMARKS) {
    assert.equal(collides(landmark.arrival.x, landmark.arrival.z, obstacles, WORLD, widest), false, `${landmark.name} was blocked by the mountain expansion`);
  }
});
