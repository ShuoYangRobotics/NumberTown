import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { WATER_PLAY } from '../dist/geography.js';
import { waterPlayHeight, BEACH_UMBRELLAS, UNDERWATER_LANDMARK } from '../dist/terrain-data.js';
import { SEA_LIFE_COUNTS, TURTLE_CYCLE, SEA_STAR_OUTLINE, fishPose, starPose, turtlePose, createSeaLife } from '../dist/sea-life.js';

const near = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
function finitePose(pose) {
  for (const key of ['x', 'y', 'z', 'size', 'yaw', 'floor']) assert.ok(Number.isFinite(pose[key]), key);
  assert.ok(pose.size > 0);
}
function inspectInstances(mesh, visit) {
  const matrix = new THREE.Matrix4(), point = new THREE.Vector3(), vertices = mesh.geometry.attributes.position;
  for (let instance = 0; instance < mesh.count; instance++) {
    mesh.getMatrixAt(instance, matrix);
    for (let vertex = 0; vertex < vertices.count; vertex++) {
      point.fromBufferAttribute(vertices, vertex).applyMatrix4(matrix); visit(point, instance);
    }
  }
}

test('thirty deterministic fish stay underwater, clear of sand and inside the bay for five minutes', () => {
  const schools = new Set();
  for (let time = 0; time <= 300; time += .5) for (let index = 0; index < SEA_LIFE_COUNTS.fish; index++) {
    const pose = fishPose(index, time); finitePose(pose); schools.add(pose.school);
    assert.ok(pose.x > WATER_PLAY.xMin + 3 && pose.x < WATER_PLAY.xMax - 3);
    assert.ok(pose.z > WATER_PLAY.shoreZ + 18 && pose.z < WATER_PLAY.deepZ - 3);
    assert.ok(pose.y - .4 * pose.size > pose.floor + .05);
    assert.ok(pose.y + .74 * pose.size < WATER_PLAY.waterY - .05);
    const next = fishPose(index, time + .001);
    assert.ok(Math.hypot(next.x - pose.x, next.y - pose.y, next.z - pose.z) < .01, 'school motion must be continuous');
    assert.deepEqual(pose, fishPose(index, time));
  }
  assert.equal(schools.size, 5);
});

test('actual fish meshes, including fins and tails, stay between the sand and water surface', () => {
  const life = createSeaLife();
  for (const time of [0, 13, 47, 92, 180, 300]) {
    life.update(time);
    for (const mesh of life.root.children.filter(child => child.name.startsWith('School fish'))) {
      inspectInstances(mesh, point => {
        assert.ok(point.y < WATER_PLAY.waterY - .01, `${mesh.name} breaks the surface`);
        assert.ok(point.y > waterPlayHeight(point.x, point.z) + .01, `${mesh.name} enters the seabed`);
      });
    }
  }
  life.dispose();
});

test('sea stars have exactly five distinct arms and their rendered undersides rest above the sloping seabed', () => {
  assert.equal(SEA_STAR_OUTLINE.length, 10);
  const life = createSeaLife(), stars = life.root.getObjectByName('Five-armed sea stars');
  assert.equal(stars.count, 14);
  const contour = stars.geometry.parameters.shapes.extractPoints().shape;
  const unique = [...new Map(contour.map(point => [`${point.x},${point.y}`, point])).values()];
  assert.equal(unique.length, 10);
  assert.equal(unique.filter(point => Math.hypot(point.x, point.y) > .9).length, 5, 'the actual extruded outline must have five outer tips');
  for (let index = 0; index < SEA_LIFE_COUNTS.stars; index++) {
    const pose = starPose(index); finitePose(pose);
    near(pose.floor, waterPlayHeight(pose.x, pose.z)); near(Math.hypot(...Object.values(pose.normal)), 1);
    assert.ok(pose.y - pose.floor < .1);
  }
  inspectInstances(stars, point => {
    assert.ok(point.y >= waterPlayHeight(point.x, point.z) - .005, `sea star sank into sand at ${point.x},${point.z}`);
    assert.ok(point.y < WATER_PLAY.waterY);
  });
  life.dispose();
});

test('the underwater arrival immediately overlooks a small star garden and a low cyan fish school', () => {
  const { x, z } = UNDERWATER_LANDMARK.arrival;
  const stars = Array.from({ length: SEA_LIFE_COUNTS.stars }, (_, index) => starPose(index));
  assert.ok(stars.filter(star => Math.hypot(star.x - x, star.z - z) < 25).length >= 4);
  assert.ok(stars.some(star => Math.hypot(star.x - x, star.z - z) >= 5 && Math.hypot(star.x - x, star.z - z) <= 9));
  for (let time = 0; time <= 100; time++) for (let index = 12; index < 18; index++) {
    const pose = fishPose(index, time);
    assert.ok(Math.hypot(pose.x - 130, pose.z - 540) < 13);
    assert.ok(pose.y - pose.floor > 3.5 && pose.y - pose.floor < 8);
  }
});

test('all turtles continuously swim ashore, crawl, bask, and return without crossing umbrellas or river bounds', () => {
  const initial = Array.from({ length: SEA_LIFE_COUNTS.turtles }, (_, index) => turtlePose(index));
  assert.ok(initial.some(pose => pose.phase === 'bask' && pose.z < WATER_PLAY.shoreZ));
  assert.ok(initial.some(pose => pose.phase === 'swim' && pose.y < WATER_PLAY.waterY));
  for (let index = 0; index < SEA_LIFE_COUNTS.turtles; index++) {
    const phases = new Set(); let swimming = false, beach = false;
    for (let time = 0; time <= 300; time += .25) {
      const pose = turtlePose(index, time); finitePose(pose); phases.add(pose.phase);
      assert.ok(pose.x - 2.8 * pose.size > WATER_PLAY.xMin && pose.x + 2.8 * pose.size < WATER_PLAY.xMax);
      assert.ok(pose.z > WATER_PLAY.beachZ + 5 && pose.z < WATER_PLAY.deepZ - 5);
      assert.ok(pose.y >= pose.floor + .03);
      for (const umbrella of BEACH_UMBRELLAS) assert.ok(Math.hypot(pose.x - umbrella.x, pose.z - umbrella.z) > umbrella.radius + 2.8 * pose.size);
      if (pose.phase === 'bask') { near(pose.z, WATER_PLAY.shoreZ - 8); near(pose.y, .035); beach = true; }
      if (pose.swimming) { assert.ok(pose.y < WATER_PLAY.waterY); swimming = true; }
      const next = turtlePose(index, time + .001);
      assert.ok(Math.hypot(next.x - pose.x, next.y - pose.y, next.z - pose.z) < .01, `turtle ${index} jumped at ${time}`);
      const turn = Math.atan2(Math.sin(next.yaw - pose.yaw), Math.cos(next.yaw - pose.yaw));
      assert.ok(Math.abs(turn) < .01, 'turns stay continuous across route phases');
    }
    assert.deepEqual([...phases].sort(), ['approach', 'bask', 'crawl', 'return', 'swim']);
    assert.ok(swimming && beach);
    const first = turtlePose(index, 0), repeat = turtlePose(index, TURTLE_CYCLE);
    near(first.x, repeat.x); near(first.z, repeat.z);
  }
});

test('turtle bellies, heads and flippers follow the rendered sloping sand during shore crossings', () => {
  const life = createSeaLife(), point = new THREE.Vector3();
  const turtles = life.root.children.filter(child => child.userData.kind === 'turtle');
  for (let time = 0; time <= TURTLE_CYCLE; time += 2) {
    life.update(time); life.root.updateMatrixWorld(true);
    for (const turtle of turtles) turtle.traverse(mesh => {
      if (!mesh.geometry) return;
      const positions = mesh.geometry.attributes.position;
      for (let vertex = 0; vertex < positions.count; vertex++) {
        point.fromBufferAttribute(positions, vertex).applyMatrix4(mesh.matrixWorld);
        assert.ok(point.y > waterPlayHeight(point.x, point.z) - .015, `${mesh.name} touches through sand at time ${time}: ${point.y - waterPlayHeight(point.x, point.z)}`);
      }
    });
  }
  life.dispose();
});

test('wildlife is real finite geometry with instanced schools, recognizable turtles and complete disposal', () => {
  assert.equal(typeof document, 'undefined');
  const life = createSeaLife(), geometries = new Set(), materials = new Set();
  assert.deepEqual(life.counts, { fish: 30, stars: 14, turtles: 4 });
  assert.equal(life.root.children.filter(child => child.isInstancedMesh).length, 10);
  const turtles = life.root.children.filter(child => child.userData.kind === 'turtle');
  assert.equal(turtles.length, 4);
  for (const turtle of turtles) {
    const parts = [];
    turtle.traverse(mesh => parts.push(mesh.name));
    assert.equal(parts.filter(name => name === 'Domed turtle shell').length, 1);
    assert.equal(parts.filter(name => name === 'Hexagonal turtle shell plate').length, 9);
    assert.equal(parts.filter(name => name === 'Turtle flipper').length, 4);
    assert.ok(parts.includes('Turtle head') && parts.includes('Turtle smile'));
  }
  for (const time of [0, 37, 111, 300, -20, NaN, Infinity]) {
    life.update(time);
    life.root.traverse(object => {
      assert.ok([...object.position, ...object.scale, ...object.quaternion].every(Number.isFinite));
      if (object.isInstancedMesh) assert.ok([...object.instanceMatrix.array].every(Number.isFinite));
      if (object.geometry) { geometries.add(object.geometry); assert.ok([...object.geometry.attributes.position.array].every(Number.isFinite)); }
      if (object.material) materials.add(object.material);
    });
  }
  const snapshot = life.diagnosticSnapshot(40);
  assert.equal(snapshot.fish.length, 30); assert.equal(snapshot.stars.length, 14); assert.equal(snapshot.turtles.length, 4);
  let geometryDisposals = 0, materialDisposals = 0;
  for (const geometry of geometries) geometry.addEventListener('dispose', () => geometryDisposals++);
  for (const material of materials) material.addEventListener('dispose', () => materialDisposals++);
  const scene = new THREE.Scene(); scene.add(life.root); life.dispose(); life.dispose();
  assert.equal(life.root.parent, null); assert.equal(geometryDisposals, geometries.size); assert.equal(materialDisposals, materials.size);
});
