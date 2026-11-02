import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { createPetSimulation, createTownPets, TOWN_PET_COUNTS } from '../dist/town-pets.js';
import { WORLD, OBSTACLES, FRIEND_STARTS } from '../dist/world-data.js';
import { TERRAIN_OBSTACLES } from '../dist/terrain-data.js';
import { PARK_OBSTACLES } from '../dist/park.js';
import { FOOTBALL_OBSTACLES } from '../dist/football.js';
import { TRAIN_OBSTACLES } from '../dist/train-park.js';
import { collides } from '../dist/navigation.js';
import { createRoamingController } from '../dist/roaming.js';
import { bodiesOverlap } from '../dist/swimming.js';

const obstacles = [...OBSTACLES, ...TERRAIN_OBSTACLES, ...PARK_OBSTACLES, ...FOOTBALL_OBSTACLES, ...TRAIN_OBSTACLES];
const options = { obstacles, world: WORLD };
const apart = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test('twenty distinct pets start on both banks and both markets, with a cat and dog by the square', () => {
  const initialPlayers = FRIEND_STARTS.map((p, i) => ({ ...p, number: i, y: 0, height: 5, radius: 2.7 }));
  const sim = createPetSimulation({ ...options, players: initialPlayers });
  assert.deepEqual(TOWN_PET_COUNTS, { cats: 10, dogs: 10 });
  assert.equal(sim.pets.length, 20); assert.equal(new Set(sim.pets.map(p => p.id)).size, 20);
  for (const species of ['cat', 'dog']) {
    assert.equal(sim.pets.filter(p => p.species === species).length, 10);
    assert.ok(sim.pets.some(p => p.species === species && apart(p, { x: 90, z: 145 }) < 25));
    assert.ok(sim.pets.some(p => p.species === species && p.x < 0));
    assert.ok(sim.pets.some(p => p.species === species && p.x > 260 && p.x < 330));
    assert.ok(sim.pets.some(p => p.species === species && p.x > 430));
  }
  for (const pet of sim.pets) {
    assert.ok(!collides(pet.x, pet.z, obstacles, WORLD, pet.radius), `${pet.id} inside obstacle`);
    for (const player of initialPlayers) assert.ok(apart(pet, player) >= pet.radius + player.radius);
    for (const other of sim.pets) if (pet !== other) assert.ok(apart(pet, other) > pet.radius + other.radius);
  }
});

test('five minutes of seeded walking stays on dry, unobstructed routes, without pet collisions or jumps', () => {
  const sim = createPetSimulation(options), repeat = createPetSimulation(options);
  let bridges = false;
  for (let frame = 0; frame < 3000; frame++) {
    const previous = sim.pets.map(p => ({ x: p.x, y: p.y, z: p.z }));
    sim.update(.1, frame * .1); repeat.update(.1, frame * .1);
    for (let i = 0; i < sim.pets.length; i++) {
      const pet = sim.pets[i];
      assert.ok(apart(pet, previous[i]) <= pet.speed * .1 + .0001, `${pet.id} jumped`);
      assert.ok(!collides(pet.x, pet.z, obstacles, WORLD, pet.radius), `${pet.id} crossed an obstacle at ${frame * .1}`);
      assert.ok(pet.y >= 0 && pet.y < 1, 'pets stay in town rather than climb or swim');
      if (pet.x > 228 && pet.x < 251) bridges = true;
      for (let j = 0; j < i; j++) assert.ok(apart(pet, sim.pets[j]) >= pet.radius + sim.pets[j].radius - .001);
    }
  }
  for (const pet of sim.pets) assert.ok(pet.distanceWalked > 300 && pet.visits > 70, `${pet.id} did not explore`);
  assert.ok(bridges, 'some pets cross the river using the bridge routes');
  assert.deepEqual(sim.diagnosticSnapshot(), repeat.diagnosticSnapshot(), 'same seed gives the same safe wandering');
});

test('pets stop before a numberblock on their route and continue after the path is clear', () => {
  const sim = createPetSimulation(options), pet = sim.pets[6];
  sim.update(.1, 5);
  const target = sim.graph[pet.target], dx = target.x - pet.x, dz = target.z - pet.z, length = Math.hypot(dx, dz);
  const player = { number: 50, x: pet.x + dx / length * 4, z: pet.z + dz / length * 4, y: 0, height: 10, radius: 1.7 };
  const before = pet.distanceWalked;
  for (let frame = 0; frame < 70; frame++) {
    sim.update(.1, 5 + frame * .1, [player]);
    assert.ok(apart(pet, player) >= pet.radius + player.radius, 'pet walked through the character');
  }
  for (let frame = 0; frame < 100; frame++) sim.update(.1, 12 + frame * .1, []);
  assert.ok(pet.distanceWalked > before + 10, 'pet remains mobile after yielding');
});

test('roaming numberblocks and pets yield to each other while both keep exploring a busy market', () => {
  const players = [
    { number: 40, x: -115, z: 218, y: 0, height: 10, radius: 2.7, yaw: 0 },
    { number: 50, x: -15, z: 218, y: 0, height: 10, radius: 2.7, yaw: 0 },
  ];
  const sim = createPetSimulation({ ...options, players });
  let seed = 503, closestGap = Infinity;
  const controller = createRoamingController({ ...options,
    destinations: [{ id: 'west', x: -115, z: 218 }, { id: 'east', x: -15, z: 218 }, { id: 'north', x: -65, z: 170 }],
    random: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; },
    dynamicObstacles: player => sim.animalPoses().filter(pet => bodiesOverlap(player, pet)),
  });
  const destinations = players.map(() => new Set());
  function checkClearance(phase) {
    for (const player of players) for (const pet of sim.pets) {
      const gap = apart(player, pet) - player.radius - pet.radius;
      closestGap = Math.min(closestGap, gap);
      assert.ok(gap >= -.000001, `${phase}: ${player.number} overlaps ${pet.id}`);
    }
    assert.ok(apart(players[0], players[1]) >= players[0].radius + players[1].radius);
  }
  for (let frame = 0; frame < 3200; frame++) {
    const before = players.map(player => ({ x: player.x, z: player.z }));
    // Match the game order: the numberblocks first avoid the pets' current
    // footprints, then pets yield to the numberblocks' new positions.
    controller.update(players, null, .1, frame / 10); checkClearance('numberblock movement');
    sim.update(.1, frame / 10, players); checkClearance('pet movement');
    for (let index = 0; index < players.length; index++) {
      const player = players[index], state = controller.stateFor(player);
      assert.ok(apart(player, before[index]) <= .28, 'yielding must not teleport numberblocks');
      assert.ok(!collides(player.x, player.z, obstacles, WORLD, player.radius));
      if (state.id) destinations[index].add(state.id);
    }
  }
  assert.ok(closestGap < .5, 'exercise close encounters, not just disjoint paths');
  for (let index = 0; index < players.length; index++) {
    assert.ok(controller.stateFor(players[index]).visits >= 4, 'a numberblock remained stuck behind a pet');
    assert.equal(destinations[index].size, 3, 'numberblocks still visit every destination');
  }
  for (const pet of sim.pets) assert.ok(pet.distanceWalked > 100, `${pet.id} remained stuck behind a numberblock`);
});

test('approach greetings use the selected body edge and height, with distance hysteresis and a cooldown', () => {
  const sim = createPetSimulation(options), cat = sim.pets[6];
  const selected = { number: 40, x: cat.x + cat.radius + 4, z: cat.z, radius: 2, y: 0, height: 10 };
  assert.equal(sim.greet({ ...selected, y: 40 }, 0), null, 'a character on a high deck must not trigger ground pets');
  assert.equal(sim.greet({ ...selected, hidden: true }, 0), null);
  assert.equal(sim.greet({ ...selected, onboard: true }, 0), null);
  const first = sim.greet(selected, 1);
  assert.equal(first.species, 'cat'); assert.equal(first.text, 'Meow!'); assert.equal(first.id, cat.id);
  const before = { x: cat.x, z: cat.z };
  sim.update(.1, 2, [selected]); assert.deepEqual({ x: cat.x, z: cat.z }, before, 'the pet pauses to greet');
  assert.equal(sim.greet(selected, 4), null); assert.equal(sim.greet(selected, 30), null, 'standing nearby does not repeat greetings');
  sim.greet({ ...selected, x: selected.x + 5 }, 31);
  assert.equal(sim.greet(selected, 32), null, 'small movement inside the exit radius does not retrigger');
  sim.greet({ ...selected, x: selected.x + 20 }, 33);
  assert.equal(sim.greet(selected, 34)?.id, cat.id, 'leaving and returning after cooldown greets again');
  const dog = sim.pets[19], dogVisitor = { ...selected, x: dog.x + dog.radius + 3, z: dog.z };
  const bark = sim.greet(dogVisitor, 40);
  assert.equal(bark.species, 'dog'); assert.equal(bark.text, 'Woof!');
});

test('all pet models are finite 3D geometry, animated in three shared batches, with complete disposal', () => {
  const pets = createTownPets(options);
  assert.equal(typeof document, 'undefined'); assert.equal(pets.root.children.length, 3);
  assert.ok(pets.root.children.every(mesh => mesh.isInstancedMesh));
  const matrices = pets.root.children.map(mesh => new Float32Array(mesh.instanceMatrix.array));
  pets.update(.1, 4, []);
  assert.ok(pets.root.children.some((mesh, index) => mesh.instanceMatrix.array.some((value, offset) => value !== matrices[index][offset])));
  for (const value of [NaN, Infinity, -10, 900]) pets.update(value, value, []);
  const geometries = new Set(), materials = new Set();
  for (const mesh of pets.root.children) {
    assert.ok([...mesh.instanceMatrix.array].every(Number.isFinite));
    assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));
    assert.ok(mesh.count > 20); geometries.add(mesh.geometry); materials.add(mesh.material);
  }
  const point = new THREE.Vector3(), matrix = new THREE.Matrix4();
  // Paws and animated tails stay above the local paving.
  for (const mesh of pets.root.children) for (let instance = 0; instance < mesh.count; instance++) {
    mesh.getMatrixAt(instance, matrix);
    const vertices = mesh.geometry.attributes.position;
    for (let vertex = 0; vertex < vertices.count; vertex++) {
      point.fromBufferAttribute(vertices, vertex).applyMatrix4(matrix);
      assert.ok(point.y >= -.01, `${mesh.name} goes below the paving`);
    }
  }
  let geometryDisposals = 0, materialDisposals = 0;
  for (const geometry of geometries) geometry.addEventListener('dispose', () => geometryDisposals++);
  for (const material of materials) material.addEventListener('dispose', () => materialDisposals++);
  new THREE.Scene().add(pets.root); pets.dispose(); pets.dispose();
  assert.equal(pets.root.parent, null); assert.equal(geometryDisposals, 3); assert.equal(materialDisposals, 1);
});
