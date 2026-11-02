import test from 'node:test';
import assert from 'node:assert/strict';
import { ANIMAL_FACTS, createAnimalEncounters } from '../dist/animal-facts.js';
import { createSeaLife, SEA_LIFE_COUNTS, fishPose, starPose, turtlePose } from '../dist/sea-life.js';
import { createTown } from '../dist/world3d.js';

const species = ['fish', 'sea-star', 'sea-turtle', 'crab', 'sea-urchin', 'coral', 'duck', 'camel', 'meerkat',
  'monkey', 'toucan', 'mountain-goat', 'arctic-fox', 'cow', 'sheep', 'pig', 'cat', 'dog'];
const player = (overrides = {}) => ({ number: 0, x: 0, y: 0, z: 0, height: 1, radius: .6, ...overrides });
const animal = (overrides = {}) => ({ id: 'fish-1', species: 'fish', x: 3, y: .5, z: 0, radius: .5, ...overrides });
const seeded = () => {
  let seed = 81;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
};

test('all eighteen animal types have distinct, short, immutable fact pools', () => {
  assert.deepEqual(Object.keys(ANIMAL_FACTS).sort(), [...species].sort());
  assert.ok(Object.isFrozen(ANIMAL_FACTS));
  for (const [type, facts] of Object.entries(ANIMAL_FACTS)) {
    assert.ok(Object.isFrozen(facts)); assert.ok(facts.length >= 3);
    assert.equal(new Set(facts).size, facts.length);
    for (const fact of facts) assert.ok(typeof fact === 'string' && fact.length > 12 && fact.length <= 70, `${type}: ${fact}`);
  }
});

test('a nearby animal yields a supported fact for Zero and every other selected number', () => {
  for (let number = 0; number <= 30; number++) for (const type of species) {
    const encounters = createAnimalEncounters({ random: () => 0 });
    const result = encounters.update(player({ number }), [animal({ id: 0, species: type })], 0);
    assert.deepEqual(result, { text: ANIMAL_FACTS[type][0], kind: 'animal', species: type, animalId: 0 });
  }
});

test('proximity checks actual vertical separation, including swimming, tall bodies and animals overhead', () => {
  const crab = animal({ id: 'deep-crab', species: 'crab', x: 0, y: -18 });
  assert.equal(createAnimalEncounters().update(player({ y: -3 }), [crab], 0), null, 'floating fifteen metres above a crab is not approaching it');
  assert.ok(createAnimalEncounters().update(player({ y: -18 }), [crab], 0), 'walking beside the same crab triggers a fact');
  assert.equal(createAnimalEncounters().update(player({ y: -18 }), [animal({ x: 0, y: 0 })], 0), null, 'a surface fish is far above a short seabed visitor');
  assert.ok(createAnimalEncounters().update(player({ number: 30, y: -18, height: 30 }), [animal({ x: 0, y: 0 })], 0), 'a fish beside a tall body is nearby');
  assert.equal(createAnimalEncounters().update(player({ number: 30, y: -3, height: 30 }), [crab], 0), null, 'height cannot extend proximity below the feet');
  assert.equal(createAnimalEncounters().update(player(), [animal({ x: 9, y: -9 })], 0), null, 'diagonal distance also matters');
});

test('animal radius is preferred over size, and distant animals remain silent', () => {
  assert.equal(createAnimalEncounters().update(player(), [animal({ x: 50 })], 0), null);
  assert.ok(createAnimalEncounters().update(player(), [animal({ x: 12, radius: 2 })], 0));
  assert.ok(createAnimalEncounters().update(player(), [animal({ x: 12, radius: undefined, size: 2 })], 0));
  assert.equal(createAnimalEncounters().update(player(), [animal({ x: 12, radius: .1, size: 20 })], 0), null);
  assert.ok(createAnimalEncounters().update(player({ radius: 15 }), [animal({ x: 24 })], 0), 'a wide body can be close without its center being close');
});

test('global and species cooldowns prevent rapid chatter and survive character switches', () => {
  const encounters = createAnimalEncounters({ random: () => 0 });
  const fish = animal(), cow = animal({ id: 'cow', species: 'cow', x: 5 });
  assert.equal(encounters.update(player(), [fish], 0).species, 'fish');
  for (const time of [1, 5, 11.9]) assert.equal(encounters.update(player({ number: 30 }), [cow], time), null);
  assert.equal(encounters.update(player({ number: 1 }), [cow], 12).species, 'cow');
  assert.equal(encounters.update(player(), [fish], 24), null, 'another character cannot bypass a species cooldown');
  assert.equal(encounters.update(player(), [animal({ id: 'fish-2' })], 49.9), null, 'another fish cannot bypass a species cooldown');
  assert.equal(encounters.update(player(), [fish], 50).species, 'fish');
});

test('new approaches take priority, including entries that occurred during the global cooldown', () => {
  const encounters = createAnimalEncounters({ random: () => 0 });
  const fish = animal({ x: 1 }), cow = animal({ id: 'cow', species: 'cow', x: 4 }), camel = animal({ id: 'camel', species: 'camel', x: 9 });
  encounters.update(player(), [fish], 0);
  assert.equal(encounters.update(player(), [fish, cow], 5), null);
  assert.equal(encounters.update(player(), [fish, cow, camel], 6), null);
  assert.equal(encounters.update(player(), [fish, cow, camel], 12).species, 'camel', 'the newly approached camel gets its turn');
  assert.equal(encounters.update(player(), [fish, cow, camel], 24).species, 'cow', 'the waiting cow is still pending');
  const pig = animal({ id: 'pig', species: 'pig', x: 10 });
  assert.equal(encounters.update(player(), [fish, cow, camel, pig], 50).species, 'pig', 'a new encounter wins over repeating the closer fish');
});

test('leaving, returning, and empty frames do not clear cooldowns or cause immediate repeats', () => {
  const encounters = createAnimalEncounters({ random: () => 0 }), fish = animal();
  const first = encounters.update(player(), [fish], 0);
  assert.equal(encounters.update(player(), [], 1), null);
  assert.equal(encounters.update(player(), [fish], 2), null);
  const second = encounters.update(player(), [fish], 50);
  assert.ok(second); assert.notEqual(second.text, first.text);
  const third = encounters.update(player(), [fish], 100);
  assert.notEqual(third.text, second.text);
});

test('seeded selection is deterministic, with valid output even if the random source is out of range', () => {
  const left = createAnimalEncounters({ random: seeded() }), right = createAnimalEncounters({ random: seeded() });
  for (let i = 0; i < 40; i++) {
    const animals = [animal({ species: species[i % species.length] })];
    assert.deepEqual(left.update(player(), animals, i * 60), right.update(player(), animals, i * 60));
  }
  for (const value of [-1, 1, 100, NaN, Infinity]) {
    const result = createAnimalEncounters({ random: () => value }).update(player(), [animal()], 0);
    assert.ok(ANIMAL_FACTS.fish.includes(result.text));
  }
});

test('invalid players, animal data and clocks never produce facts or consume a valid encounter', () => {
  const encounters = createAnimalEncounters();
  for (const invalid of [null, player({ number: -1 }), player({ number: 1.5 }), player({ y: undefined }), player({ x: NaN })]) {
    assert.equal(encounters.update(invalid, [animal()], 0), null);
  }
  for (const invalid of [null, animal({ id: '' }), animal({ species: 'constructor' }), animal({ species: 'dragon' }),
    animal({ y: NaN }), animal({ z: Infinity }), animal({ radius: Infinity }), animal({ radius: -1 })]) {
    assert.equal(encounters.update(player(), [invalid], 0), null);
  }
  for (const time of [-1, NaN, Infinity]) assert.equal(encounters.update(player(), [animal()], time), null);
  assert.equal(encounters.update(player(), null, 0), null);
  assert.ok(encounters.update(player(), [animal()], 0));
});

test('reset and a restarted clock allow a fresh session', () => {
  const encounters = createAnimalEncounters({ random: () => 0 });
  const first = encounters.update(player(), [animal()], 100);
  assert.equal(encounters.update(player(), [animal()], 101), null);
  encounters.reset(); assert.deepEqual(encounters.update(player(), [animal()], 0), first);
  assert.ok(encounters.update(player(), [animal()], 60));
  assert.deepEqual(encounters.update(player(), [animal()], 0), first);
});

test('lightweight sea-life encounters match the moving fish, sea stars and turtles with stable IDs', () => {
  const life = createSeaLife(), first = life.animalPoses(0);
  assert.equal(first.length, SEA_LIFE_COUNTS.fish + SEA_LIFE_COUNTS.stars + SEA_LIFE_COUNTS.turtles);
  assert.equal(new Set(first.map(item => item.id)).size, first.length);
  for (const time of [0, 17, 85, 180]) {
    const poses = life.animalPoses(time); assert.equal(poses, first, 'the result array is reused');
    for (const [type, count, poseAt] of [['fish', SEA_LIFE_COUNTS.fish, fishPose], ['sea-star', SEA_LIFE_COUNTS.stars, starPose], ['sea-turtle', SEA_LIFE_COUNTS.turtles, turtlePose]]) {
      const animals = poses.filter(item => item.species === type); assert.equal(animals.length, count);
      for (const [index, item] of animals.entries()) {
        const expected = poseAt(index, time);
        for (const key of ['x', 'y', 'z']) assert.equal(item[key], expected[key]);
        assert.ok(item.radius > 0 && Number.isFinite(item.radius));
        assert.ok(Object.keys(item).length <= 6, 'encounters do not need diagnostic or animation data');
      }
    }
  }
  life.dispose();
});

test('all six original pond ducks expose encounters at their actual rendered positions', () => {
  const town = createTown(), ducks = town.root.children.filter(item => item.name === 'Pond duck');
  assert.equal(ducks.length, 6);
  for (const time of [0, 10, 60, 180]) {
    town.update(time); const poses = town.animalPoses(time); assert.equal(poses.length, 6);
    for (const duck of ducks) {
      const pose = poses.find(item => item.id === duck.userData.animalId); assert.ok(pose); assert.equal(pose.species, 'duck');
      for (const key of ['x', 'y', 'z']) assert.equal(pose[key], duck.position[key]);
      assert.ok(createAnimalEncounters().update(player({ x: pose.x, y: 0, z: pose.z }), [pose], 0));
    }
  }
});
