import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, getCharacterDefinition, getCharacterMetrics } from '../dist/character-data.js';
import { getCharacterArrangements, getNextArrangement, findArrangementPosition } from '../dist/arrangements.js';
import { createCharacter, getCharacterFaceLayout } from '../dist/characters3d.js';
import { collides } from '../dist/navigation.js';
import { Box3 } from '../dist/vendor/three.module.js';

const positionKey = cell => `${cell.x},${cell.y},${cell.z ?? 0}`;
const styles = cells => cells.map(({ color, outline }) => JSON.stringify([color, outline ?? null])).sort();
const geometry = form => form.cells.map(positionKey).sort().join(';');
const world = { width: 60, depth: 60, margin: 1 };
const rectangle = (number, width) => getCharacterArrangements(number).find(form => form.width === width && form.depth === 1);
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-8, message ?? `${actual} != ${expected}`);

test('all thirty-one identities have immutable, complete factor arrangements without duplicate shapes', () => {
  assert.equal(CHARACTERS.length, 31);
  for (const original of CHARACTERS) {
    const forms = getCharacterArrangements(original.number), first = forms[0];
    assert.equal(getCharacterArrangements(original.number), forms, 'definitions are cached');
    assert.ok(Object.isFrozen(forms));
    assert.equal(first.formId, 'original');
    assert.equal(first.transformed, false);
    assert.deepEqual(first.cells, original.cells);
    assert.deepEqual(first.originalShape, { width: original.width, height: original.height, depth: original.depth });
    assert.equal(new Set(forms.map(form => form.formId)).size, forms.length);
    assert.equal(new Set(forms.map(geometry)).size, forms.length, `${original.number}: duplicate geometry`);
    const requiredFactors = [];
    for (let width = 1; width <= original.number; width++) {
      if (original.number % width === 0) requiredFactors.push(`${width}x${original.number / width}`);
    }
    const actualFactors = forms.filter(form => form.depth === 1 && form.width * form.height === original.number)
      .map(form => `${form.width}x${form.height}`);
    assert.deepEqual(actualFactors.sort(), requiredFactors.sort(), `${original.number}: missing factor orientation`);
    for (const form of forms) {
      assert.ok(Object.isFrozen(form) && Object.isFrozen(form.cells) && Object.isFrozen(form.originalShape));
      assert.equal(form.cells.length, original.number);
      assert.equal(new Set(form.cells.map(positionKey)).size, original.number);
      assert.deepEqual(styles(form.cells), styles(original.cells), 'rearrangement must preserve every cube color and outline');
      for (const key of ['number', 'name', 'description', 'color', 'dark']) assert.equal(form[key], original[key]);
      for (const cell of form.cells) {
        assert.ok(Object.isFrozen(cell));
        for (const dimension of ['x', 'y', 'z']) assert.ok(Number.isInteger(cell[dimension]) && cell[dimension] >= 0);
      }
      if (form === first) continue;
      assert.equal(form.transformed, true);
      assert.equal(form.formId, `${form.width}x${form.height}`);
      assert.equal(form.depth, 1);
      form.cells.forEach((cell, index) => assert.deepEqual([cell.x, cell.y, cell.z], [index % form.width, Math.floor(index / form.width), 0]));
    }
    const variants = forms.slice(1);
    for (let index = 1; index < variants.length; index++) {
      const before = variants[index - 1], after = variants[index];
      const a = Math.abs(before.width - before.height), b = Math.abs(after.width - after.height);
      assert.ok(a < b || a === b && before.width < after.width, 'near squares precede narrow forms; tall wins ties');
    }
  }
});

test('stable cycling restores the exact cube, windowed, and original shapes', () => {
  for (let number = 0; number <= 30; number++) {
    const forms = getCharacterArrangements(number);
    let form = forms[0];
    for (let index = 1; index < forms.length; index++) {
      form = getNextArrangement(number, form.formId);
      assert.equal(form, forms[index]);
    }
    assert.equal(getNextArrangement(number, form.formId), forms[0]);
    assert.equal(getNextArrangement(number, 'missing'), forms[0]);
  }
  assert.equal(getCharacterArrangements(0).length, 1);
  assert.equal(getCharacterArrangements(0)[0].cells.length, 0);
  assert.equal(getNextArrangement(0).number, 0);
  assert.equal(getCharacterArrangements(1).length, 1);
  const cube = getCharacterArrangements(27)[0], windows = getCharacterArrangements(28)[0];
  assert.deepEqual([cube.width, cube.height, cube.depth], [3, 3, 3]);
  assert.equal(new Set(cube.cells.map(cell => cell.z)).size, 3);
  assert.equal(windows.width * windows.height - windows.cells.length, 5);
  for (const y of [1, 3, 5, 7, 9]) assert.ok(!windows.cells.some(cell => cell.x === 1 && cell.y === y));
  assert.deepEqual(cube.cells, getCharacterDefinition(27).cells);
  assert.deepEqual(windows.cells, getCharacterDefinition(28).cells);
});

test('placement keeps an already clear player still and uses the new full footprint', () => {
  const player = { number: 21, x: 30, z: 30, radius: getCharacterMetrics(21).radius };
  const before = { ...player }, definition = rectangle(21, 7);
  const result = findArrangementPosition(player, definition, { obstacles: [], world });
  assert.deepEqual(result, { position: { x: 30, z: 30 }, metrics: getCharacterMetrics(definition) });
  assert.deepEqual(player, before, 'placement does not move or transform the caller');
  assert.ok(result.metrics.depth > definition.depth, 'the transformed explorer backpack is part of the footprint');
});

test('growth beside a wall takes a short step in the old body before adopting the larger footprint', () => {
  const player = { number: 2, x: 19, z: 30, radius: .8 }, definition = rectangle(12, 4);
  const obstacles = [{ x: 20, z: 0, w: 2, d: 60 }], metrics = getCharacterMetrics(definition);
  assert.equal(collides(player.x, player.z, obstacles, world, player.radius), false);
  assert.equal(collides(player.x, player.z, obstacles, world, metrics.radius), true);
  assert.equal(findArrangementPosition(player, definition, { obstacles, world, maxDistance: 0 }), null);
  const result = findArrangementPosition(player, definition, { obstacles, world });
  assert.ok(result);
  assert.ok(result.position.x + metrics.radius <= 20);
  assert.ok(Math.hypot(result.position.x - player.x, result.position.z - player.z) <= 1.25 + 1e-8);
  assert.equal(collides(result.position.x, result.position.z, obstacles, world, metrics.radius), false);
  for (let t = 0; t <= 1; t += .01) {
    assert.equal(collides(player.x + (result.position.x - player.x) * t, player.z + (result.position.z - player.z) * t, obstacles, world, player.radius), false);
  }
});

test('local placement cannot cross a thin wall or river callback to reach an otherwise fitting bank', () => {
  const map = { width: 40, depth: 40, margin: 1 }, player = { number: 1, x: 8, z: 20, radius: .7 };
  const definition = rectangle(10, 10), metrics = getCharacterMetrics(definition);
  const wall = { x: 10, z: 0, w: .1, d: 40 };
  const river = { blocks: (x, z, radius) => x + radius > 10 && x - radius < 10.1 };
  for (const obstacle of [wall, river]) {
    assert.equal(collides(16, 20, [obstacle], map, metrics.radius), false, 'a distant candidate exists');
    assert.equal(findArrangementPosition(player, definition, { obstacles: [obstacle], world: map }), null, 'the old body cannot cross to that candidate');
  }
});

test('nearby characters, terrain steps, and world bounds remain part of safe placement', () => {
  const definition = rectangle(10, 10), player = { number: 1, x: 8, z: 20, radius: .7 };
  const map = { width: 40, depth: 40, margin: 1 }, obstacles = [{ x: 0, z: 0, w: 4, d: 40 }];
  assert.ok(findArrangementPosition(player, definition, { obstacles, world: map }));
  assert.equal(findArrangementPosition(player, definition, { obstacles, world: map, groundHeight: x => x >= 9 ? 20 : 0 }), null, 'a cliff is not a short step');
  assert.ok(findArrangementPosition(player, definition, { obstacles, world: map, groundHeight: x => x * .2 }));
  assert.equal(findArrangementPosition(player, definition, { obstacles, world: map, groundHeight: () => null }), null);
  const friend = { x: 23, z: 30, radius: 1.3 }, nearby = { number: 2, x: 20, z: 30, radius: .7 };
  const result = findArrangementPosition(nearby, rectangle(12, 4), { obstacles: [friend], world });
  assert.ok(result && result.position.x < nearby.x);
  assert.equal(collides(result.position.x, result.position.z, [friend], world, result.metrics.radius), false);
  const northern = { number: 2, x: 20, z: -20, radius: .7 };
  assert.deepEqual(findArrangementPosition(northern, rectangle(2, 2), { obstacles: [], world: { ...world, minZ: -40 } }).position, { x: 20, z: -20 });
  assert.equal(findArrangementPosition(player, definition, { obstacles: [], world, maxDistance: -1 }), null);
});

test('every rendered arrangement retains exact unit cubes and finite geometry; variant faces and arms sit near the lower third', () => {
  for (const original of CHARACTERS) {
    for (const definition of getCharacterArrangements(original.number)) {
      const label = `${original.number}/${definition.formId}`, model = createCharacter(original.number, { definition });
      const blocks = [];
      model.root.updateMatrixWorld(true);
      model.root.traverse(object => {
        if (object.userData.unitBlock) blocks.push(object);
        for (const value of [...object.position.toArray(), ...object.scale.toArray(), ...object.quaternion.toArray()]) assert.ok(Number.isFinite(value), `${label}: invalid transform`);
        const positions = object.geometry?.getAttribute('position');
        if (positions) for (const value of positions.array) assert.ok(Number.isFinite(value), `${label}: invalid mesh vertex`);
      });
      assert.equal(blocks.length, original.number, label);
      assert.deepEqual(blocks.map(block => positionKey(block.userData.cell)).sort(), definition.cells.map(positionKey).sort(), `${label}: wrong cells`);
      for (const block of blocks) {
        assert.deepEqual(block.scale.toArray(), [1, 1, 1], `${label}: stretched cube`);
        assert.deepEqual(block.rotation.toArray().slice(0, 3), [0, 0, 0]);
        const { width, height, depth } = block.geometry.parameters;
        assert.deepEqual([width, height, depth], [1, 1, 1], label);
        const cell = block.userData.cell;
        close(block.position.x, cell.x + .5 - definition.width / 2);
        close(block.position.y, cell.y + .85);
        close(block.position.z, (cell.z ?? 0) - (definition.depth - 1) / 2);
      }
      close(model.radius, getCharacterMetrics(definition).radius, `${label}: collision radius differs from geometry`);
      if (definition.transformed) {
        const face = getCharacterFaceLayout(original.number, definition), center = model.root.userData.faceCenter;
        assert.ok(center, `${label}: missing face center`);
        close(center.x, face.x);
        close(center.y, (face.eyeY + face.mouthY) / 2);
        assert.ok(face.eyeY > face.mouthY);
        assert.ok(Math.abs(center.y - (.35 + definition.height / 3)) <= .3, `${label}: face is not in the lower third`);
        const attachments = model.root.userData.armAttachments;
        assert.ok(attachments?.length >= 2, `${label}: missing arms`);
        for (const arm of attachments) {
          assert.ok(Math.abs(arm.y - (.35 + definition.height / 3)) <= .5, `${label}: arms do not follow the new body`);
          close(Math.abs(arm.x), definition.width / 2, `${label}: detached arm`);
        }
        if (definition.height === 1) {
          for (const mood of ['happy', 'excited', 'curious', 'surprised', 'sleepy', 'sad']) {
            const expression = model.root.getObjectByName(`expression ${mood}`);
            assert.ok(expression, `${label}: missing ${mood} expression`);
            const bounds = new Box3().setFromObject(expression);
            assert.ok(bounds.min.y >= .2 && bounds.max.y <= 1.5, `${label}/${mood}: one-row face spills vertically (${bounds.min.y},${bounds.max.y})`);
            assert.ok(bounds.min.x >= -definition.width / 2 -.1 && bounds.max.x <= definition.width / 2 + .1, `${label}/${mood}: face is wider than body`);
          }
        }
      }
      model.dispose?.();
    }
  }
});
