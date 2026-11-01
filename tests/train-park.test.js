import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {
  TRAIN_PARK, TRAIN_LANDMARK, TRAIN_ZONES, TRAIN_TRACK_LENGTH, TRAIN_OBSTACLES,
  createTrainState, trainPose, boardingPoint, boardTrain, leaveTrain, stepTrain, createTrainPark,
} from '../dist/train-park.js';
import { WORLD } from '../dist/geography.js';
import { collides } from '../dist/navigation.js';
import { CHARACTERS, getCharacterMetrics } from '../dist/character-data.js';
import { getCharacterArrangements } from '../dist/arrangements.js';
import { OBSTACLES } from '../dist/world-data.js';
import { TERRAIN_OBSTACLES } from '../dist/terrain-data.js';
import { PARK_OBSTACLES } from '../dist/park.js';
import { FOOTBALL_OBSTACLES } from '../dist/football.js';

const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);
const allObstacles = [...OBSTACLES, ...TERRAIN_OBSTACLES, ...PARK_OBSTACLES, ...FOOTBALL_OBSTACLES, ...TRAIN_OBSTACLES];
const playerAt = (state, number = 0, radius = 1.2) => ({ ...boardingPoint(state), number, radius });
const ellipseLevel = (x, z) => ((x - TRAIN_PARK.x) / TRAIN_PARK.rx) ** 2 + ((z - TRAIN_PARK.z) / TRAIN_PARK.rz) ** 2;
const park = createTrainPark();

function trainSnapshot() {
  park.root.updateMatrixWorld(true);
  const result = [];
  park.train.traverse(object => result.push({ matrix: object.matrixWorld.toArray(), visible: object.visible }));
  return result;
}

test('the train starts at the west station and remains entirely still until occupied', () => {
  const state = createTrainState();
  assert.equal(state.rider, null);
  close(trainPose(state).x, 485); close(trainPose(state).z, 215);
  assert.deepEqual(boardingPoint(state), TRAIN_LANDMARK.arrival);
  const before = { ...state };
  for (const dt of [0, .016, .5, 100, 10000]) stepTrain(state, dt, true);
  assert.deepEqual(state, before);
  park.update(state, 0); const image = trainSnapshot();
  for (const time of [1, 100, 10000, Infinity, NaN]) {
    park.update(state, time);
    assert.deepEqual(trainSnapshot(), image, 'parked wheels, carriages, or steam drift with wall-clock time');
  }
});

test('Zero boards successfully; distant players, invalid players and second riders do not', () => {
  const state = createTrainState();
  const before = { ...state };
  assert.equal(boardTrain(state, { number: 0, radius: 1, x: 600, z: 200 }), false);
  for (const invalid of [null, {}, { number: -1, x: 478, z: 215 }, { number: 1, x: NaN, z: 215 }]) assert.equal(boardTrain(state, invalid), false);
  assert.deepEqual(state, before, 'failed boarding must not alter a parked train');
  const zero = playerAt(state, 0), originalPlayer = { ...zero };
  assert.equal(boardTrain(state, zero), true); assert.equal(state.rider, 0);
  assert.deepEqual(zero, originalPlayer, 'the controller owns character visibility and location');
  assert.equal(boardTrain(state, playerAt(state, 2)), false);
  stepTrain(state, .5); close(state.distance, 6); assert.notEqual(state.progress, 0);
});

test('arc-length travel has constant speed and holding boost doubles it exactly', () => {
  for (const start of [0, .13, .25, .51, .77, .998]) {
    const normal = createTrainState(), boosted = createTrainState();
    normal.progress = boosted.progress = start;
    boardTrain(normal, playerAt(normal)); boardTrain(boosted, playerAt(boosted));
    stepTrain(normal, 1.75); stepTrain(boosted, 1.75, true);
    close(normal.distance, 21); close(boosted.distance, 42);
    close(normal.speed, 12); close(boosted.speed, 24);
    close(boosted.motionTime, normal.motionTime * 2);
    close(((normal.progress - start + 1) % 1) * TRAIN_TRACK_LENGTH, 21);
    close(((boosted.progress - start + 1) % 1) * TRAIN_TRACK_LENGTH, 42);
  }
  for (let i = 0; i < 1000; i++) {
    const a = trainPose(i / 1000), b = trainPose(i / 1000 + .1 / TRAIN_TRACK_LENGTH);
    close(Math.hypot(a.x - b.x, a.z - b.z), .1, .000025);
  }
  const state = createTrainState(); boardTrain(state, playerAt(state));
  const before = { ...state };
  for (const dt of [-1, 0, Infinity, NaN, undefined, Number.MAX_VALUE]) stepTrain(state, dt);
  assert.deepEqual(state, before);
  stepTrain(state, TRAIN_TRACK_LENGTH / TRAIN_PARK.speed);
  close(trainPose(state).x, TRAIN_PARK.station.x); close(trainPose(state).z, TRAIN_PARK.station.z);
});

test('ellipse normals point outside and safe exits stay local at every part of the loop', () => {
  const radii = [...new Set(CHARACTERS.flatMap(character => getCharacterArrangements(character.number).map(form => getCharacterMetrics(form).radius)))];
  assert.ok(Math.max(...radii) >= 20, 'the audit must include the forty-wide form');
  for (let i = 0; i < 1024; i++) {
    const progress = i / 1024, pose = trainPose(progress);
    close(ellipseLevel(pose.x, pose.z), 1, 1e-10);
    close(Math.hypot(pose.outward.x, pose.outward.z), 1);
    assert.ok((pose.x - TRAIN_PARK.x) * pose.outward.x + (pose.z - TRAIN_PARK.z) * pose.outward.z > 0, 'exit normal points into the park');
    for (const radius of radii) {
      const point = boardingPoint({ progress, riderRadius: radius });
      assert.ok(ellipseLevel(point.x, point.z) > 1, 'exit is inside the moving railway');
      assert.equal(collides(point.x, point.z, allObstacles, WORLD, radius), false, `blocked exit at ${progress}, radius ${radius}`);
      assert.ok(Math.hypot(point.x - pose.x, point.z - pose.z) <= radius + 42, 'leaving jumps beyond the nearby bend');
      // Its entire circular footprint stays beyond the rail and the train body.
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        assert.ok(ellipseLevel(point.x + Math.cos(angle) * radius, point.z + Math.sin(angle) * radius) > 1.006, 'exiting character overlaps the train track');
      }
    }
  }
});

test('leaving stops in place, can be reversed by reboarding, and supports every current form', () => {
  for (const character of CHARACTERS) for (const form of getCharacterArrangements(character.number)) {
    const state = createTrainState(), radius = getCharacterMetrics(form).radius;
    // Fast travel was requested before the controller learns the current form.
    assert.equal(boardTrain(state, playerAt(state, character.number, radius)), true);
    stepTrain(state, 23.5, true);
    const progress = state.progress, distance = state.distance, exit = leaveTrain(state);
    assert.equal(state.rider, null); assert.equal(state.speed, 0);
    assert.equal(collides(exit.x, exit.z, allObstacles, WORLD, radius), false);
    stepTrain(state, 400, true); close(state.progress, progress); close(state.distance, distance);
    assert.equal(boardTrain(state, { ...exit, number: character.number, radius }), true);
    close(state.progress, progress);
    stepTrain(state, 1); close(state.distance, distance + TRAIN_PARK.speed);
  }
  const state = createTrainState(); assert.equal(leaveTrain(state), null);
});

test('the station connects to the town road and a broad walkable park interior', () => {
  const route = [{ x: 435, z: 320 }, { x: 435, z: 215 }, TRAIN_PARK.entrance, TRAIN_LANDMARK.arrival, { x: 510, z: 215 }, { x: 635, z: 215 }, { x: 765, z: 215 }];
  for (const radius of [.5, 2.7, 3.5]) for (let segment = 1; segment < route.length; segment++) {
    const a = route[segment - 1], b = route[segment];
    for (let t = 0; t <= 1; t += .01) {
      const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      assert.equal(collides(x, z, allObstacles, WORLD, radius), false, `station access blocked at ${x}, ${z}`);
    }
  }
  assert.equal(TRAIN_LANDMARK.id, 'train-park'); assert.equal(TRAIN_LANDMARK.name, 'Train park');
  assert.equal(TRAIN_PARK.bounds.maxX < WORLD.width, true);
  assert.equal(new Set(TRAIN_OBSTACLES.map(o => o.id)).size, TRAIN_OBSTACLES.length);
});

test('real rails, hundreds of ties, a locomotive and two carriages all follow the closed track', () => {
  assert.deepEqual(park.counts, { zones: 4, engines: 1, carriages: 2, animals: 20, species: 9, ties: 442 });
  for (const name of ['Inner steel rail', 'Outer steel rail']) {
    const rail = park.root.getObjectByName(name);
    assert.equal(rail.geometry.type, 'TubeGeometry');
    assert.equal(rail.geometry.parameters.closed, true);
    assert.ok(rail.geometry.parameters.radius > .05, 'rails are painted lines instead of solid steel');
    rail.geometry.computeBoundingBox();
    assert.ok(rail.geometry.boundingBox.max.y - rail.geometry.boundingBox.min.y > .14);
  }
  const ballast = park.root.getObjectByName('Track ballast');
  for (let i = 1; i < ballast.geometry.attributes.normal.array.length; i += 3) assert.ok(ballast.geometry.attributes.normal.array[i] > .99, 'track bed faces down into the ground');
  let ties = 0;
  park.root.traverse(object => { if (object.isInstancedMesh) ties += object.userData.parts?.filter(p => p.feature === 'railway tie').length || 0; });
  assert.equal(ties, park.counts.ties);
  assert.equal(park.vehicles.length, 3);
  const state = createTrainState(); boardTrain(state, playerAt(state));
  for (const time of [0, 5, 18, 34, 60, 10000]) {
    state.progress = (time * TRAIN_PARK.speed / TRAIN_TRACK_LENGTH) % 1; state.distance = time * TRAIN_PARK.speed;
    park.update(state, time); park.root.updateMatrixWorld(true);
    park.vehicles.forEach((vehicle, i) => {
      const pose = trainPose(state.progress - i * TRAIN_PARK.carriageSpacing / TRAIN_TRACK_LENGTH);
      close(vehicle.position.x, pose.x); close(vehicle.position.z, pose.z); close(vehicle.rotation.y, pose.yaw);
      close(ellipseLevel(vehicle.position.x, vehicle.position.z), 1);
      let wheels = 0, seats = 0;
      vehicle.traverse(object => { if (object.name === 'Rolling train wheel') { wheels++; close(object.rotation.x, state.distance / .64); } if (object.name === 'Passenger seat') seats++; });
      assert.equal(wheels, 4); assert.equal(seats, i ? 3 : 0);
    });
  }
  const zero = trainPose(0), end = trainPose(1); close(zero.x, end.x); close(zero.z, end.z); close(zero.yaw, end.yaw);
});

test('the parked train freezes after a ride, while resumed wheels and cars advance together', () => {
  const state = createTrainState(); boardTrain(state, playerAt(state)); stepTrain(state, 9); park.update(state, 9);
  const moving = trainSnapshot(); leaveTrain(state);
  for (const time of [10, 200, 10000]) { stepTrain(state, 1); park.update(state, time); assert.deepEqual(trainSnapshot(), moving); }
  boardTrain(state, playerAt(state)); stepTrain(state, .3); park.update(state, 10001);
  assert.notDeepEqual(trainSnapshot(), moving);
});

test('four distinctive scenic zones have all nine recognizable animal species and trackside encounters', () => {
  assert.equal(new Set(TRAIN_ZONES.map(z => z.color)).size, 4);
  for (const zone of TRAIN_ZONES) assert.ok(park.root.getObjectByName(`${zone.name} landscape`));
  for (const name of ['Rainforest pool', 'Meadow farm barn', 'Adventure railway station']) assert.ok(park.root.getObjectByName(name));
  const required = {
    camel: 'camel hump', meerkat: 'dark eye patches', monkey: 'curled monkey tail', toucan: 'large golden beak',
    'mountain-goat': 'curved goat horns', 'arctic-fox': 'bushy fox tail', cow: 'cow patches', sheep: 'fluffy wool', pig: 'curly pig tail',
  };
  const rendered = new Map();
  park.root.traverse(object => {
    if (!object.isInstancedMesh) return;
    object.userData.parts.forEach((part, index) => {
      if (!part.animalId) return;
      if (!rendered.has(part.animalId)) rendered.set(part.animalId, []);
      const matrix = new THREE.Matrix4(); object.getMatrixAt(index, matrix);
      rendered.get(part.animalId).push({ feature: part.feature, position: new THREE.Vector3().setFromMatrixPosition(matrix), determinant: matrix.determinant() });
    });
  });
  assert.equal(park.animals.length, 20); assert.equal(new Set(park.animals.map(a => a.id)).size, 20);
  assert.deepEqual([...new Set(park.animals.map(a => a.species))].sort(), Object.keys(required).sort());
  for (const animal of park.animals) {
    assert.ok(animal.features.includes(required[animal.species]));
    const parts = rendered.get(animal.id);
    assert.ok(parts.length > 10, `${animal.species} needs an actual recognizable body`);
    assert.ok(parts.some(p => p.feature === required[animal.species]));
    assert.ok(parts.every(p => p.determinant > 0 && Math.hypot(p.position.x - animal.x, p.position.z - animal.z) < 6));
    assert.equal(collides(animal.x, animal.z, TRAIN_OBSTACLES, WORLD, .6), false, `${animal.species} is embedded in scenery`);
  }
  for (const [species, zone] of [['camel', 'desert'], ['toucan', 'rainforest'], ['arctic-fox', 'snow'], ['sheep', 'farm']]) {
    const residents = park.animals.filter(a => a.species === species);
    const nearest = Math.min(...residents.flatMap(animal => Array.from({ length: 2048 }, (_, i) => {
      const pose = trainPose(i / 2048); return Math.hypot(pose.x - animal.x, pose.z - animal.z);
    })));
    assert.ok(nearest < 8 && nearest > 5, `${zone} has no safely trackside animal`);
  }
});

test('static scenery is batched and all rendered geometry and transforms stay finite', () => {
  park.update({ progress: NaN, distance: Infinity, motionTime: Infinity }, NaN); park.root.updateMatrixWorld(true);
  let meshes = 0, instances = 0; const geometries = new Set();
  park.root.traverse(object => {
    assert.ok(object.matrixWorld.toArray().every(Number.isFinite), object.name);
    if (!object.isMesh) return;
    meshes++; geometries.add(object.geometry);
    if (object.isInstancedMesh) { instances += object.count; assert.ok(Array.from(object.instanceMatrix.array).every(Number.isFinite), object.name); }
  });
  assert.ok(instances > 1000, 'ties, crops, foliage and animal parts should share batches');
  assert.ok(meshes < 250, `park has ${meshes} separate mesh calls`);
  for (const geometry of geometries) assert.ok(Array.from(geometry.attributes.position.array).every(Number.isFinite));
  for (const value of [NaN, Infinity, { progress: Infinity }, null]) {
    const pose = trainPose(value); assert.ok([pose.x, pose.y, pose.z, pose.yaw].every(Number.isFinite));
  }
});
