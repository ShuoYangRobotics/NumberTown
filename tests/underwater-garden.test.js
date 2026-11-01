import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { WATER_PLAY } from '../dist/geography.js';
import { waterPlayHeight, UNDERWATER_LANDMARK } from '../dist/terrain-data.js';
import { SEA_LIFE_COUNTS, starPose } from '../dist/sea-life.js';
import {
  GARDEN_LOOP, GARDEN_ENTRANCE, GARDEN_PATH_WIDTH, GARDEN_DECORATIONS,
  gardenTourWaypoints, animalPoses, createUnderwaterGarden,
} from '../dist/underwater-garden.js';

const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function segmentDistance(point, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(point.x - a.x - t * dx, point.z - a.z - t * dz);
}
function roadDistance(point) {
  let result = segmentDistance(point, GARDEN_ENTRANCE, GARDEN_LOOP[0]);
  for (let index = 0; index < GARDEN_LOOP.length - 1; index++) result = Math.min(result, segmentDistance(point, GARDEN_LOOP[index], GARDEN_LOOP[index + 1]));
  return result;
}
function eachInstanceCorner(mesh, visit) {
  mesh.geometry.computeBoundingBox();
  const { min, max } = mesh.geometry.boundingBox, matrix = new THREE.Matrix4(), point = new THREE.Vector3();
  for (let index = 0; index < mesh.count; index++) {
    mesh.getMatrixAt(index, matrix);
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) visit(point.set(x, y, z).applyMatrix4(matrix));
  }
}

test('the closed six-wide road and arrival spur are flat, accessible and clear of every existing sea star', () => {
  assert.equal(GARDEN_PATH_WIDTH, 6); assert.deepEqual(GARDEN_LOOP[0], GARDEN_LOOP.at(-1));
  assert.deepEqual(GARDEN_ENTRANCE, UNDERWATER_LANDMARK.arrival);
  let length = 0;
  for (let index = 0; index < GARDEN_LOOP.length - 1; index++) {
    const a = GARDEN_LOOP[index], b = GARDEN_LOOP[index + 1];
    length += Math.hypot(a.x - b.x, a.z - b.z);
    for (let step = 0; step <= 8; step++) {
      const t = step / 8, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      assert.ok(x - 3 > WATER_PLAY.xMin && x + 3 < WATER_PLAY.xMax);
      assert.ok(z - 3 > WATER_PLAY.shoreZ + WATER_PLAY.depthRamp && z + 3 < WATER_PLAY.deepZ);
      near(waterPlayHeight(x, z), -18);
    }
  }
  assert.ok(length > 180 && length < 210);
  for (let index = 0; index < SEA_LIFE_COUNTS.stars; index++) {
    const star = starPose(index);
    assert.ok(roadDistance(star) > 3 + star.size + .1, `existing star ${index} touches the road`);
  }
});

test('actual paving supports a radius-2.7 character around the whole loop and along the arrival spur', () => {
  const garden = createUnderwaterGarden(), road = garden.root.getObjectByName('Pale underwater garden road');
  road.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), origin = new THREE.Vector3();
  const points = [...GARDEN_LOOP, ...Array.from({ length: 27 }, (_, step) => ({ x: 125, z: 522 + step * .5 }))];
  for (const point of points) for (let spoke = 0; spoke < 24; spoke++) {
    const angle = spoke * Math.PI / 12, x = point.x + Math.sin(angle) * 2.7, z = point.z + Math.cos(angle) * 2.7;
    ray.set(origin.set(x, 0, z), down);
    const hit = ray.intersectObject(road)[0];
    assert.ok(hit, `paving missing under footprint at ${x},${z}`);
    near(hit.point.y, waterPlayHeight(x, z) + .065, 2e-6);
  }
  garden.dispose();
});

test('new animal and plant footprints preserve the whole path, clear arrival and existing stars', () => {
  const stars = Array.from({ length: SEA_LIFE_COUNTS.stars }, (_, index) => starPose(index));
  for (const decoration of GARDEN_DECORATIONS) {
    assert.ok(roadDistance(decoration) > 3 + decoration.radius + .1, `${decoration.kind} obstructs paving`);
    assert.ok(Math.hypot(decoration.x - 125, decoration.z - 535) > decoration.radius + 3.7, `${decoration.kind} obstructs arrival`);
    for (const star of stars) assert.ok(Math.hypot(decoration.x - star.x, decoration.z - star.z) > decoration.radius + star.size + .1,
      `${decoration.kind} overlaps existing star ${star.x},${star.z}`);
  }
});

test('tours join the closest paving, cover the closed loop and return to arrival at the true floor height', () => {
  for (const start of [GARDEN_ENTRANCE, { x: 125, z: 528 }, { x: 159, z: 550 }, { x: 104, z: 572 }, { x: 80, z: 545 }]) {
    const route = gardenTourWaypoints(start);
    assert.ok(route.length > 95); assert.deepEqual(route.at(-1), { ...GARDEN_ENTRANCE, y: -18 });
    near(roadDistance(route[0]), 0);
    let travel = 0;
    for (let index = 0; index < route.length; index++) {
      const point = route[index]; near(point.y, waterPlayHeight(point.x, point.z));
      if (!index) continue;
      const previous = route[index - 1], length = Math.hypot(point.x - previous.x, point.z - previous.z); travel += length;
      for (let step = 0; step <= 8; step++) {
        const t = step / 8, sample = { x: previous.x + (point.x - previous.x) * t, z: previous.z + (point.z - previous.z) * t };
        assert.ok(roadDistance(sample) < .001, 'tour must not cut through the planting beds');
      }
    }
    assert.ok(travel > 190 && travel < 320);
    for (const stop of GARDEN_LOOP) assert.ok(route.some(point => Math.hypot(point.x - stop.x, point.z - stop.z) < .001));
  }
});

test('crabs, sea urchins and coral have stable identities and stay on clear sand through continuous animation', () => {
  const initial = animalPoses(0), ids = new Set(initial.map(animal => animal.id));
  assert.equal(ids.size, 20);
  for (const [species, count] of [['crab', 4], ['sea-urchin', 6], ['coral', 10]]) assert.equal(initial.filter(animal => animal.species === species).length, count);
  assert.equal(new Set(initial.filter(animal => animal.species === 'coral').map(animal => animal.form)).size, 4);
  let crabMoved = false;
  for (let time = 0; time <= 300; time += .5) {
    const poses = animalPoses(time);
    assert.deepEqual(poses.map(animal => animal.id), initial.map(animal => animal.id));
    poses.forEach((animal, index) => {
      for (const key of ['x', 'y', 'z', 'yaw', 'radius']) assert.ok(Number.isFinite(animal[key]));
      near(animal.y, waterPlayHeight(animal.x, animal.z) + .04);
      assert.ok(roadDistance(animal) > 3 + animal.radius);
      const next = animalPoses(time + .001)[index];
      assert.ok(Math.hypot(animal.x - next.x, animal.z - next.z) < .001);
      if (animal.species !== 'crab') { near(animal.x, initial[index].x); near(animal.z, initial[index].z); }
      else if (Math.hypot(animal.x - initial[index].x, animal.z - initial[index].z) > .3) crabMoved = true;
    });
  }
  assert.ok(crabMoved);
});

test('animated foliage and articulated crab geometry visibly move while keeping the paved footprint clear', () => {
  const garden = createUnderwaterGarden();
  const names = ['Swaying colorful seaweed', 'Swaying kelp stalks', 'Swaying kelp leaves', 'Garden crab articulated legs and arms', 'Garden crab shells eyes and pincers'];
  const before = new Map(names.map(name => [name, [...garden.root.getObjectByName(name).instanceMatrix.array]]));
  for (const time of [1.7, 14, 53]) {
    garden.update(time);
    for (const name of names) assert.notDeepEqual([...garden.root.getObjectByName(name).instanceMatrix.array], before.get(name), `${name} should animate`);
    for (const mesh of garden.root.children.filter(object => object.isInstancedMesh)) eachInstanceCorner(mesh, point => {
      assert.ok(point.y < WATER_PLAY.waterY - 8);
      assert.ok(roadDistance(point) > GARDEN_PATH_WIDTH / 2, `${mesh.name} crosses over the paving`);
    });
  }
  const blades = garden.root.getObjectByName('Swaying colorful seaweed'), matrix = new THREE.Matrix4(), point = new THREE.Vector3();
  for (let index = 0; index < blades.count; index++) {
    blades.getMatrixAt(index, matrix); point.set(0, 0, 0).applyMatrix4(matrix);
    near(point.y, waterPlayHeight(point.x, point.z) + .08, 2e-6);
  }
  garden.dispose();
});

test('garden has vivid finite 3D features, a small draw count, DOM-free construction and complete disposal', () => {
  assert.equal(typeof document, 'undefined');
  const garden = createUnderwaterGarden();
  assert.deepEqual(garden.counts, { seaweed: 90, kelp: 12, rocks: 24, coral: 10, seaUrchins: 6, crabs: 4 });
  assert.equal(garden.animals.length, 20); assert.deepEqual(garden.animalPoses(27), animalPoses(27));
  assert.ok(garden.root.children.length <= 16, 'hundreds of decorative details should be batched');
  assert.equal(garden.root.getObjectByName('Garden cone details').count, 6 * 62, 'urchins need dense 3D spines');
  assert.equal(garden.root.getObjectByName('Garden tube details').geometry.parameters.openEnded, true, 'tube coral has real open cups');
  const geometries = new Set(), materials = new Set();
  for (const time of [0, 100, NaN, Infinity, -20]) {
    garden.update(time);
    garden.root.traverse(object => {
      assert.ok([...object.position, ...object.scale, ...object.quaternion].every(Number.isFinite));
      if (object.isInstancedMesh) assert.ok([...object.instanceMatrix.array].every(Number.isFinite));
      if (object.geometry) { geometries.add(object.geometry); assert.ok([...object.geometry.attributes.position.array].every(Number.isFinite)); }
      if (object.material) materials.add(object.material);
    });
  }
  let geometryDisposals = 0, materialDisposals = 0;
  for (const geometry of geometries) geometry.addEventListener('dispose', () => geometryDisposals++);
  for (const material of materials) material.addEventListener('dispose', () => materialDisposals++);
  const scene = new THREE.Scene(); scene.add(garden.root); garden.dispose(); garden.dispose();
  assert.equal(garden.root.parent, null); assert.equal(geometryDisposals, geometries.size); assert.equal(materialDisposals, materials.size);
});
