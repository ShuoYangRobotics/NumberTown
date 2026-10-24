import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { PARK, PARK_LANDMARK, PARK_OBSTACLES, createPark } from '../dist/park.js';
import { collides, moveWithCollisions } from '../dist/navigation.js';

const world = { width: 300, depth: 250, margin: 2 };
const close = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-7, message || `${a} differs from ${b}`);
function cabins(root) {
  const result = [];
  root.traverse(object => { if (object.userData.cabinNumber !== undefined) result.push(object); });
  return result.sort((a, b) => a.userData.cabinNumber - b.userData.cabinNumber);
}

test('the park has exactly eighteen actual cabin groups with visible mesh numbers', () => {
  assert.equal(typeof document, 'undefined', 'this test exercises the DOM-free construction path');
  const park = createPark(), gondolas = cabins(park.root);
  assert.equal(park.cabinCount, 18);
  assert.equal(gondolas.length, 18);
  assert.deepEqual(gondolas.map(cabin => cabin.userData.cabinNumber), Array.from({ length: 18 }, (_, i) => i + 1));
  for (const cabin of gondolas) {
    assert.ok(cabin.isGroup);
    let actualMeshes = 0, visibleNumber = false;
    cabin.traverse(object => {
      if (object.isMesh) actualMeshes++;
      if (object.userData.label === String(cabin.userData.cabinNumber) && object.isInstancedMesh) visibleNumber = true;
    });
    assert.ok(actualMeshes > 8, 'each cabin must have real walls, windows, roof, suspension, and furniture');
    assert.ok(visibleNumber, `cabin ${cabin.userData.cabinNumber} is missing a mesh number`);
  }
});

test('all eighteen suspension points stay equally spaced on the exact fourteen-unit wheel', () => {
  const park = createPark(), gondolas = cabins(park.root);
  for (const time of [0, 1, 13.8, 72, 1234, -37]) {
    park.update(time); park.root.updateMatrixWorld(true);
    const positions = gondolas.map(cabin => cabin.getWorldPosition(new THREE.Vector3()));
    positions.forEach((point, index) => {
      const angle = gondolas[index].userData.baseAngle + time * PARK.speed;
      close(point.x, PARK.x + Math.cos(angle) * PARK.radius);
      close(point.y, PARK.hubHeight + Math.sin(angle) * PARK.radius);
      close(point.z, PARK.z);
      close(Math.hypot(point.x - PARK.x, point.y - PARK.hubHeight), 14);
      const next = positions[(index + 1) % positions.length];
      close(point.distanceTo(next), 2 * PARK.radius * Math.sin(Math.PI / 18), 'adjacent cabins are unevenly spaced');
    });
  }
});

test('cabins remain upright in world space through full rotations and large elapsed times', () => {
  const park = createPark(), gondolas = cabins(park.root);
  for (const time of [0, 7, 24, Math.PI / PARK.speed, Math.PI * 2 / PARK.speed, 10000]) {
    park.update(time); park.root.updateMatrixWorld(true);
    for (const cabin of gondolas) {
      const rotation = cabin.getWorldQuaternion(new THREE.Quaternion());
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation);
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation);
      close(up.x, 0); close(up.y, 1); close(up.z, 0);
      close(forward.x, 0); close(forward.y, 0); close(forward.z, 1);
    }
  }
});

test('the wheel has three-dimensional rims, spokes, supports, and finite modest geometry', () => {
  const park = createPark();
  park.update(Infinity); park.root.updateMatrixWorld(true);
  const geometries = new Set();
  let rimCount = 0, meshes = 0;
  park.root.traverse(object => {
    if (object.name === 'wheel rim') rimCount++;
    if (object.isMesh) { meshes++; geometries.add(object.geometry); }
    assert.ok([...object.position.toArray(), ...object.scale.toArray(), ...object.quaternion.toArray()].every(Number.isFinite), `${object.name} has invalid transforms`);
    if (object.isInstancedMesh) assert.ok(Array.from(object.instanceMatrix.array).every(Number.isFinite));
  });
  assert.equal(rimCount, 2, 'front and rear rims must give the wheel real depth');
  assert.ok(meshes > 100, 'the attraction must consist of actual 3D cabin and wheel parts');
  for (const geometry of geometries) {
    const positions = geometry.getAttribute('position');
    assert.ok(positions && positions.count > 0);
    assert.ok(positions.count < 6000, 'one park part is unnecessarily massive');
    assert.ok(Array.from(positions.array).every(Number.isFinite), 'non-finite vertex geometry');
  }
});

test('arrival and the full gate-to-viewing route remain open even for wide characters', () => {
  assert.deepEqual(PARK_LANDMARK.arrival, { x: 238, z: 80 });
  const route = [{ x: 208, z: 80 }, PARK.entrance, PARK_LANDMARK.arrival, { x: 249, z: 80 }, { x: 249, z: 66 }];
  for (const radius of [.6, 1.6, 2.6, 3.5]) {
    assert.equal(collides(PARK_LANDMARK.arrival.x, PARK_LANDMARK.arrival.z, PARK_OBSTACLES, world, radius), false);
    for (let i = 1; i < route.length; i++) {
      const from = route[i - 1], to = route[i];
      for (let t = 0; t <= 1; t += .025) {
        const x = from.x + (to.x - from.x) * t, z = from.z + (to.z - from.z) * t;
        assert.equal(collides(x, z, PARK_OBSTACLES, world, radius), false, `route blocked at ${x}, ${z} for radius ${radius}`);
      }
    }
  }
});

test('support and boarding footprints block walking through the attraction', () => {
  for (const point of [{ x: 249, z: 46 }, { x: 240.3, z: 42 }, { x: 257.7, z: 50 }, { x: 249, z: 57 }]) {
    assert.equal(collides(point.x, point.z, PARK_OBSTACLES, world), true);
  }
  for (const radius of [.6, 2.6]) {
    const player = { x: 249, z: 80, radius };
    moveWithCollisions(player, 0, -60, PARK_OBSTACLES, world);
    assert.ok(player.z >= 60 + radius - 1e-7, 'walk passed through the boarding platform');
    assert.equal(collides(player.x, player.z, PARK_OBSTACLES, world, radius), false);
  }
});

test('park obstacle declarations stay inside the reserved bounds and use unique IDs', () => {
  assert.equal(new Set(PARK_OBSTACLES.map(obstacle => obstacle.id)).size, PARK_OBSTACLES.length);
  for (const obstacle of PARK_OBSTACLES) {
    const left = obstacle.radius != null ? obstacle.x - obstacle.radius : obstacle.x;
    const right = obstacle.radius != null ? obstacle.x + obstacle.radius : obstacle.x + obstacle.w;
    const back = obstacle.radius != null ? obstacle.z - obstacle.radius : obstacle.z;
    const front = obstacle.radius != null ? obstacle.z + obstacle.radius : obstacle.z + obstacle.d;
    assert.ok(left >= PARK.bounds.minX && right <= PARK.bounds.maxX, obstacle.id);
    assert.ok(back >= PARK.bounds.minZ && front <= PARK.bounds.maxZ, obstacle.id);
  }
});
