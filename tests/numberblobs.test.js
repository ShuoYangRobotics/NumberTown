import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { createNumberblobs, createNumberblobSimulation, NUMBERBLOB_COUNT, NUMBERBLOB_DIAMETER, NUMBERBLOB_COLORS } from '../dist/numberblobs.js';
import { createPetRoadGraph, createPetSimulation } from '../dist/town-pets.js';
import { WORLD, OBSTACLES, FRIEND_STARTS, NUMBERBLOB_HOMES, LANDMARKS } from '../dist/world-data.js';
import { CHARACTERS, getCharacterMetrics } from '../dist/character-data.js';
import { TERRAIN_OBSTACLES, groundHeight } from '../dist/terrain-data.js';
import { PARK_OBSTACLES } from '../dist/park.js';
import { FOOTBALL_OBSTACLES } from '../dist/football.js';
import { TRAIN_OBSTACLES } from '../dist/train-park.js';
import { collides } from '../dist/navigation.js';
import { createRoamingController } from '../dist/roaming.js';
import { bodiesOverlap } from '../dist/swimming.js';

const obstacles = [...OBSTACLES, ...TERRAIN_OBSTACLES, ...PARK_OBSTACLES, ...FOOTBALL_OBSTACLES, ...TRAIN_OBSTACLES];
const graph = createPetRoadGraph({ obstacles, world: WORLD });
const options = { obstacles, world: WORLD, graph };
const apart = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('ninety colorful Numberblobs reuse the road graph and spawn clear of all characters and pets', () => {
  const players = CHARACTERS.map((character, index) => ({ number: character.number, ...FRIEND_STARTS[index], y: 0, ...getCharacterMetrics(character.number) }));
  const pets = createPetSimulation({ ...options, players });
  const visitors = [...players, ...pets.animalPoses()];
  const sim = createNumberblobSimulation({ ...options, players: visitors });
  assert.equal(sim.graph, graph, 'the ninety residents share the existing graph instead of building ninety routing maps');
  assert.equal(NUMBERBLOB_COUNT, 90); assert.equal(sim.blobs.length, 90); assert.equal(new Set(sim.blobs.map(blob => blob.id)).size, 90);
  assert.equal(sim.homes.length, NUMBERBLOB_HOMES.length, 'all designated homes have a validated entrance route');
  assert.ok(new Set(sim.blobs.map(blob => blob.color)).size >= 10);
  assert.ok(sim.blobs.every(blob => NUMBERBLOB_COLORS.includes(blob.color)));
  assert.ok(sim.blobs.some(blob => apart(blob, { x: 90, z: 145 }) < 16));
  assert.ok(sim.blobs.some(blob => blob.x < 0)); assert.ok(sim.blobs.some(blob => blob.x > 430));
  for (const blob of sim.blobs) {
    assert.ok(!collides(blob.x, blob.z, obstacles, WORLD, blob.radius));
    for (const visitor of visitors) assert.ok(apart(blob, visitor) >= blob.radius + visitor.radius, `${blob.id} overlaps a starting visitor`);
  }
});

test('continuous bouncing routes stay clear of scenery and other blobs, with genuine home entrances and exits', () => {
  const sim = createNumberblobSimulation(options), repeat = createNumberblobSimulation(options);
  const visited = new Set(), exited = new Set(); let hiddenSamples = 0, bouncingSamples = 0;
  const filtered = new Map(NUMBERBLOB_HOMES.map(home => [home.id, obstacles.filter(obstacle => obstacle.id !== home.id)]));
  for (let frame = 0; frame < 1600; frame++) {
    const previous = sim.blobs.map(blob => ({ x: blob.x, z: blob.z }));
    sim.update(.1, frame / 10); repeat.update(.1, frame / 10);
    for (let index = 0; index < sim.blobs.length; index++) {
      const blob = sim.blobs[index], doorway = blob.home && ['home-entering', 'inside', 'home-exiting'].includes(blob.mode);
      assert.ok(apart(blob, previous[index]) <= blob.speed * .1 + .00001, `${blob.id} teleported`);
      assert.ok(!collides(blob.x, blob.z, doorway ? filtered.get(blob.home.id) : obstacles, WORLD, blob.radius), `${blob.id} crossed unrelated scenery`);
      assert.ok(blob.jump >= 0 && blob.jump <= .34); near(blob.y, groundHeight(blob.x, blob.z) + blob.jump);
      if (blob.jump > .2) bouncingSamples++;
      if (!blob.visible) {
        hiddenSamples++;
        assert.ok(blob.home && doorway, 'residents can disappear only while actually inside their own home');
        const depth = (blob.home.facadeZ - blob.z) * blob.home.outward;
        assert.ok(depth > blob.radius, 'the entire body must enter the doorway before it is hidden');
        assert.ok(!sim.animalPoses().includes(blob));
      }
      if (blob.homesEntered) visited.add(blob.id); if (blob.homesExited) exited.add(blob.id);
      if (blob.visible) for (let other = 0; other < index; other++) {
        const peer = sim.blobs[other];
        if (peer.visible) assert.ok(apart(blob, peer) >= blob.radius + peer.radius - .00001, 'residents overlapped');
      }
    }
  }
  assert.ok(bouncingSamples > 1000 && hiddenSamples > 100);
  assert.ok(visited.size >= 15 && exited.size >= 15, 'residents must visit homes and return to town, not remain permanently hidden');
  assert.ok(sim.blobs.every(blob => blob.distanceWalked > 80), 'every resident explores');
  assert.deepEqual(sim.diagnosticSnapshot(), repeat.diagnosticSnapshot(), 'seeded town life is reproducible');
});

test('selected-only greetings use body distance, height, hysteresis, and one shared quiet interval', () => {
  const sim = createNumberblobSimulation(options);
  const blob = sim.blobs.find(item => sim.blobs.every(other => item === other || apart(item, other) > 15));
  const selected = { number: 20, x: blob.x + 4, z: blob.z, y: 0, height: 10, radius: 1 };
  assert.equal(sim.greet({ ...selected, y: 15 }, 0), null);
  assert.equal(sim.greet({ ...selected, visible: false }, 0), null);
  assert.equal(sim.greet({ ...selected, onFoot: false }, 0), null);
  assert.equal(sim.greet({ ...selected, onboard: true }, 0), null);
  assert.equal(sim.greet(selected, 1)?.id, blob.id);
  assert.equal(sim.greet(selected, 20), null); assert.equal(sim.greet(selected, 100), null, 'waiting beside one blob must not cause repeated chatter');
  sim.greet({ ...selected, x: 100000 }, 101);
  assert.equal(sim.greet(selected, 102)?.id, blob.id);
  const other = sim.blobs.find(item => apart(item, blob) > 50);
  assert.equal(sim.greet({ ...selected, x: other.x + 3, z: other.z }, 103), null, 'a crowd cannot start a chorus');
  sim.setTalking(blob.id, 110);
  const before = { x: blob.x, z: blob.z };
  sim.update(.1, 104, [selected]); assert.deepEqual({ x: blob.x, z: blob.z }, before);
  assert.ok(blob.talking && blob.mouthOpen > .15, 'the speaking resident stays in place and opens its mouth');
  sim.update(.1, 111, []); assert.equal(blob.talking, false, 'an abandoned speech callback cannot leave a resident stuck forever');
  sim.setTalking(other.id, 120); sim.stopTalking(); assert.ok(sim.blobs.every(item => !item.talking));
});

test('all bodies are unit spheres with physically hinged upper halves, attached eyes, and just four render batches', () => {
  const residents = createNumberblobs(options), shells = residents.root.getObjectByName('Unit spherical hinged body halves');
  assert.equal(NUMBERBLOB_DIAMETER, 1); assert.equal(residents.root.children.length, 4);
  assert.ok(residents.root.children.every(mesh => mesh.isInstancedMesh)); assert.equal(shells.count, 180);
  const blob = residents.blobs[0], center = new THREE.Vector3(blob.x, blob.y + .565, blob.z);
  const matrix = new THREE.Matrix4(), point = new THREE.Vector3(), vertices = shells.geometry.attributes.position;
  for (const instance of [0, 1]) {
    shells.getMatrixAt(instance, matrix);
    for (let vertex = 0; vertex < vertices.count; vertex++) {
      point.fromBufferAttribute(vertices, vertex).applyMatrix4(matrix);
      near(point.distanceTo(center), .5, .00002);
    }
  }
  const upperClosed = new THREE.Matrix4(), lowerClosed = new THREE.Matrix4();
  shells.getMatrixAt(0, upperClosed); shells.getMatrixAt(1, lowerClosed);
  residents.setTalking(blob.id, 20); residents.update(.1, 4, []);
  const upperOpen = new THREE.Matrix4(), lowerOpen = new THREE.Matrix4();
  shells.getMatrixAt(0, upperOpen); shells.getMatrixAt(1, lowerOpen);
  assert.notDeepEqual(upperOpen.elements, upperClosed.elements);
  assert.deepEqual(lowerOpen.elements, lowerClosed.elements, 'talking rotates the upper hemisphere while the lower half stays spherical and still');
  assert.ok(blob.mouthOpen > .15 && blob.mouthOpen <= .65);
  const eyeMesh = residents.root.getObjectByName('Googly eyes, pupils, highlights and tongues');
  eyeMesh.getMatrixAt(0, matrix); point.setFromMatrixPosition(matrix);
  assert.ok(point.y > blob.y + 1, 'googly eyes ride on the raised top hemisphere');
  const resources = new Set(), materials = new Set(); let disposedGeometries = 0, disposedMaterials = 0;
  for (const time of [NaN, Infinity, -1, 4.5]) residents.update(.05, time, []);
  for (const mesh of residents.root.children) {
    assert.ok([...mesh.instanceMatrix.array].every(Number.isFinite));
    assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));
    resources.add(mesh.geometry); materials.add(mesh.material);
  }
  for (const geometry of resources) geometry.addEventListener('dispose', () => disposedGeometries++);
  for (const material of materials) material.addEventListener('dispose', () => disposedMaterials++);
  new THREE.Scene().add(residents.root); residents.dispose(); residents.dispose();
  assert.equal(residents.root.parent, null); assert.equal(disposedGeometries, 4); assert.equal(disposedMaterials, 1);
});

test('all 51 numberblocks, 20 pets, and 90 Numberblobs share the town without overlaps or permanent traffic jams', () => {
  const players = CHARACTERS.map((character, index) => ({ number: character.number, ...FRIEND_STARTS[index], y: 0,
    height: character.height, ...getCharacterMetrics(character.number), yaw: 0, moving: false }));
  const active = players.find(player => player.number === 27), original = { ...active };
  const pets = createPetSimulation({ ...options, players });
  const sim = createNumberblobSimulation({ ...options, players: [...players, ...pets.animalPoses()] });
  let seed = 503, closestGap = Infinity;
  const controller = createRoamingController({ ...options, destinations: LANDMARKS,
    random: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; },
    dynamicObstacles: player => [...sim.animalPoses(), ...pets.animalPoses()].filter(other => bodiesOverlap(player, other)),
  });
  function check() {
    for (const blob of sim.animalPoses()) for (const other of [...players, ...pets.animalPoses()]) {
      const dx = blob.x - other.x, dz = blob.z - other.z, radius = blob.radius + other.radius;
      const squared = dx * dx + dz * dz;
      if (squared < (radius + .5) ** 2) closestGap = Math.min(closestGap, Math.sqrt(squared) - radius);
      if (squared < (radius - .00001) ** 2) assert.fail(`${blob.id} overlaps ${other.id ?? other.number}`);
    }
    for (const pet of pets.pets) for (const player of players) {
      if (apart(pet, player) < pet.radius + player.radius - .00001) assert.fail(`${pet.id} overlaps ${player.number}`);
    }
  }
  for (let frame = 0; frame < 6000; frame++) {
    controller.update(players, active, .1, frame / 10); check();
    for (const player of players) player.y = groundHeight(player.x, player.z);
    pets.update(.1, frame / 10, [...players, ...sim.animalPoses()]); check();
    sim.update(.1, frame / 10, [...players, ...pets.animalPoses()]); check();
  }
  assert.ok(closestGap < .5, 'the residents really meet on their routes');
  assert.deepEqual(active, original, 'autonomous traffic cannot move the selected character');
  for (const player of players) if (player !== active) assert.ok(controller.stateFor(player).visits >= 1,
    `Numberblock ${player.number} never reaches a destination: ${JSON.stringify(controller.stateFor(player))}`);
  for (const blob of sim.blobs) assert.ok(blob.distanceWalked > 80, `${blob.id} remained stuck`);
  for (const pet of pets.pets) assert.ok(pet.distanceWalked > 80, `${pet.id} remained stuck`);
});
