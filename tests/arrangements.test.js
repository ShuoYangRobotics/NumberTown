import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, getCharacterDefinition, getCharacterMetrics } from '../dist/character-data.js';
import { getCharacterArrangements, getNextArrangement, createCrazyArrangement, findArrangementPosition } from '../dist/arrangements.js';
import { createCharacter, getCharacterFaceLayout } from '../dist/characters3d.js';
import { collides } from '../dist/navigation.js';
import { Box3 } from '../dist/vendor/three.module.js';

const positionKey = cell => `${cell.x},${cell.y},${cell.z ?? 0}`;
const styles = cells => cells.map(({ color, outline }) => JSON.stringify([color, outline ?? null])).sort();
const geometry = form => form.cells.map(positionKey).sort().join(';');
const world = { width: 60, depth: 60, margin: 1 };
const rectangle = (number, width) => getCharacterArrangements(number).find(form => form.width === width && form.depth === 1 && form.width * form.height === number);
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-8, message ?? `${actual} != ${expected}`);

function assertConnected(form) {
  if (!form.cells.length) return;
  const remaining = new Set(form.cells.map(positionKey)), queue = [form.cells[0]];
  remaining.delete(positionKey(queue[0]));
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const point = { x: cell.x + dx, y: cell.y + dy, z: (cell.z ?? 0) + dz }, key = positionKey(point);
      if (remaining.delete(key)) queue.push(point);
    }
  }
  assert.equal(remaining.size, 0, `${form.number}/${form.formId}: floating or corner-touching cubes`);
}
function assertExactForm(form, original) {
  assert.ok(Object.isFrozen(form) && Object.isFrozen(form.cells) && Object.isFrozen(form.originalShape));
  assert.equal(form.cells.length, original.number);
  assert.equal(new Set(form.cells.map(positionKey)).size, original.number);
  assert.deepEqual(styles(form.cells), styles(original.cells), 'every original color and outline must be retained');
  for (const key of ['number', 'name', 'description', 'color', 'dark']) assert.equal(form[key], original[key]);
  for (const cell of form.cells) {
    assert.ok(Object.isFrozen(cell));
    for (const dimension of ['x', 'y', 'z']) assert.ok(Number.isInteger(cell[dimension]) && cell[dimension] >= 0);
  }
  if (original.number) for (const [axis, dimension] of [['x', 'width'], ['y', 'height'], ['z', 'depth']]) {
    assert.equal(Math.min(...form.cells.map(c => c[axis])), 0, 'body coordinates should be normalized');
    assert.equal(Math.max(...form.cells.map(c => c[axis])) + 1, form[dimension], 'dimensions must match occupied cubes');
  }
  assertConnected(form);
}

test('all fifty-one identities have cached immutable shapes and every factor orientation', () => {
  assert.deepEqual(CHARACTERS.map(c => c.number), Array.from({ length: 51 }, (_, i) => i));
  for (const original of CHARACTERS) {
    const forms = getCharacterArrangements(original.number), first = forms[0];
    assert.equal(getCharacterArrangements(original.number), forms);
    assert.ok(Object.isFrozen(forms));
    assert.equal(first.formId, 'original'); assert.equal(first.transformed, false);
    assert.deepEqual(first.cells, original.cells);
    assert.deepEqual(first.originalShape, { width: original.width, height: original.height, depth: original.depth });
    assert.equal(new Set(forms.map(form => form.formId)).size, forms.length);
    assert.equal(new Set(forms.map(geometry)).size, forms.length, `${original.number}: duplicate geometry`);
    const requiredFactors = [];
    for (let width = 1; width <= original.number; width++) if (original.number % width === 0) requiredFactors.push(`${width}x${original.number / width}`);
    const actualFactors = forms.filter(form => form.depth === 1 && form.width * form.height === original.number).map(form => `${form.width}x${form.height}`);
    assert.deepEqual(actualFactors.sort(), requiredFactors.sort(), `${original.number}: missing factor orientation`);
    for (const form of forms) {
      assertExactForm(form, original);
      assert.equal(typeof form.label, 'string'); assert.ok(form.label.length > 0);
      assert.equal(typeof form.shapeKind, 'string');
      if (form === first) continue;
      assert.equal(form.transformed, true);
      if (form.shapeKind === 'rectangle') {
        assert.equal(form.formId, `${form.width}x${form.height}`);
        assert.equal(form.depth, 1); assert.equal(form.width * form.height, original.number);
      }
      if (form.shapeKind === 'crazy') assert.notEqual(form.width * form.height * form.depth, original.number);
    }
    const factors = forms.filter(form => form.shapeKind === 'rectangle');
    for (let i = 1; i < factors.length; i++) {
      const before = factors[i - 1], after = factors[i];
      const a = Math.abs(before.width - before.height), b = Math.abs(after.width - after.height);
      assert.ok(a < b || a === b && before.width < after.width, 'factor order must remain near-square first');
    }
    if (original.number >= 3) {
      assert.ok(forms.some(form => form.shapeKind === 'stairs'));
      assert.ok(forms.some(form => form.shapeKind === 'crazy'));
      assert.ok(forms.length >= 5);
    }
  }
});

test('tens bodies and last-digit caps/sides contain the actual colored ones, even when the original stripe is elsewhere', () => {
  for (let number = 11; number <= 49; number++) {
    if (!(number % 10)) continue;
    const original = getCharacterDefinition(number), count = number - number % 10;
    const frequencies = new Map();
    for (const cell of original.cells) frequencies.set(cell.color, (frequencies.get(cell.color) ?? 0) + 1);
    const color = [...frequencies].sort((a, b) => b[1] - a[1])[0][0];
    const ones = original.cells.filter(cell => cell.color !== color);
    assert.equal(ones.length, number % 10);
    for (const placement of ['top', 'side']) {
      const form = getCharacterArrangements(number).find(form => form.shapeKind === `tens-${placement}`);
      assert.ok(form, `${number} needs ones on the ${placement}`);
      const { decomposition } = form, { body } = decomposition;
      assert.ok(Object.isFrozen(decomposition) && Object.isFrozen(body) && Object.isFrozen(decomposition.extra));
      assert.deepEqual([decomposition.tens, decomposition.ones, decomposition.placement], [Math.floor(number / 10), number % 10, placement]);
      const inside = cell => cell.x >= body.x && cell.x < body.x + body.width && cell.y >= body.y && cell.y < body.y + body.height;
      const base = form.cells.filter(inside), extra = form.cells.filter(cell => !inside(cell));
      assert.equal(base.length, count); assert.equal(extra.length, number % 10);
      assert.ok(base.every(cell => cell.color === color), `${number}: colored ones remain inside the tens body`);
      assert.deepEqual(styles(extra), styles(ones), `${number}: missing colored last-digit cubes`);
      assert.ok(extra.every(cell => placement === 'top' ? cell.y >= body.y + body.height : cell.x >= body.x + body.width));
      assertConnected(form);
    }
  }
});

test('recognizable curated forms are connected actual stairs, T bars, L corners, pyramids and zigzags', () => {
  for (const number of [8, 11, 17, 23, 28, 31, 36, 40]) {
    const forms = getCharacterArrangements(number);
    for (const kind of ['stairs', 'tee', 'corner', 'pyramid', 'zigzag']) {
      const form = forms.find(f => f.shapeKind === kind);
      assert.ok(form, `${number} missing ${kind}`); assert.equal(form.depth, 1);
      assert.notEqual(form.width * form.height, number, `${kind} is just a rectangle`);
      if (kind === 'tee') assert.equal(form.cells.filter(c => c.y === form.height - 1).length, form.width, 'T needs a complete upper crossbar');
      if (kind === 'corner') assert.equal(form.cells.filter(c => c.y === 0).length, form.width, 'L needs a full bottom leg');
      if (kind === 'pyramid') {
        const rows = Array.from({ length: form.height }, (_, y) => form.cells.filter(c => c.y === y).length);
        assert.ok(rows.every((width, i) => !i || width <= rows[i - 1]), 'pyramid widens upward');
      }
    }
  }
});

test('every friend above thirty gets eight distinct compact funny forms before factor rectangles', () => {
  const kinds = ['diamond', 'butterfly', 'window-frame', 'robot', 'rocket', 'puppy', 'castle', 'bridge'];
  for (let number = 31; number <= 50; number++) {
    const original = getCharacterDefinition(number), forms = getCharacterArrangements(number);
    const funny = forms.filter(form => form.family === 'funny');
    assert.deepEqual(funny.map(form => form.shapeKind), kinds, `${number}: missing funny form`);
    assert.deepEqual(forms.slice(1, 9), funny, 'T should reach the new funny forms immediately');
    assert.equal(getNextArrangement(number, 'original'), funny[0]);
    for (const form of funny) {
      assertExactForm(form, original);
      assert.equal(form.formId, form.shapeKind);
      assert.ok(form.width <= 11 && form.height <= 11 && form.depth <= 3, `${number}/${form.formId}: oversized funny shape`);
      assert.notEqual(form.width * form.height * form.depth, number, 'a funny form must be more than a solid box');
    }
    assert.equal(funny.filter(form => form.depth === 3).length, 2, 'the castle and bridge need real depth');
    assert.deepEqual(forms[0].cells, original.cells, 'funny forms must not alter the original reference');
  }
  assert.equal(getCharacterArrangements(30).some(form => form.family === 'funny'), false);
});

function enclosedAir(form) {
  const occupied = new Set(form.cells.map(cell => `${cell.x},${cell.y}`)), outside = new Set(['-1,-1']);
  const queue = [[-1, -1]];
  for (let i = 0; i < queue.length; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = queue[i][0] + dx, y = queue[i][1] + dy, key = `${x},${y}`;
    if (x < -1 || x > form.width || y < -1 || y > form.height || occupied.has(key) || outside.has(key)) continue;
    outside.add(key); queue.push([x, y]);
  }
  let holes = 0;
  for (let x = 0; x < form.width; x++) for (let y = 0; y < form.height; y++) if (!occupied.has(`${x},${y}`) && !outside.has(`${x},${y}`)) holes++;
  return holes;
}

test('diamond, wings, frames and character silhouettes keep their recognizable features at every count', () => {
  for (let number = 31; number <= 50; number++) {
    const forms = getCharacterArrangements(number), get = kind => forms.find(form => form.shapeKind === kind);
    const wings = get('butterfly'), waist = wings.cells.filter(cell => cell.y === 3);
    assert.equal(waist.length, 1, `${number}: wings lost their narrow waist`);
    for (const side of [-1, 1]) for (const dy of [-1, 1]) {
      assert.ok(wings.cells.some(cell => (cell.x - waist[0].x) * side >= 2 && (cell.y - 3) * dy >= 1), `${number}: missing wing quadrant`);
    }
    assert.ok(enclosedAir(get('window-frame')) >= 9, `${number}: frame opening was filled`);
    const robot = get('robot');
    assert.ok(robot.cells.filter(cell => cell.y === 7).length >= 5, `${number}: robot needs its wide head`);
    const robotFeet = robot.cells.filter(cell => cell.y === 0).map(cell => cell.x).sort((a, b) => a - b);
    assert.ok(robotFeet.some((x, i) => i && x - robotFeet[i - 1] > 1), `${number}: robot needs separate feet`);
    const rocket = get('rocket');
    const top = rocket.cells.filter(cell => cell.y === rocket.height - 1).length, fins = rocket.cells.filter(cell => cell.y === 2).length;
    assert.ok(top < fins, `${number}: rocket nose should taper above its fins`);
    const puppy = get('puppy'), paws = puppy.cells.filter(cell => cell.y === 0).map(cell => cell.x).sort((a, b) => a - b);
    assert.ok(paws.some((x, i) => i && x - paws[i - 1] > 1), `${number}: puppy needs separate paws`);
    assert.ok(puppy.cells.some(cell => cell.x === 0 && cell.y >= 5), `${number}: puppy is missing its raised tail`);
    assert.ok(puppy.cells.some(cell => cell.x === puppy.width - 1 && cell.y >= 4), `${number}: puppy is missing its snout`);
  }
  const diamond = getCharacterArrangements(41).find(form => form.shapeKind === 'diamond');
  assert.deepEqual(Array.from({ length: diamond.height }, (_, y) => diamond.cells.filter(cell => cell.y === y).length), [1, 3, 5, 7, 9, 7, 5, 3, 1]);
  assert.deepEqual([diamond.width, diamond.height, diamond.depth], [9, 9, 1]);
  assert.equal(getCharacterArrangements(43)[0].cells.length, 43);
  assert.ok(enclosedAir(getCharacterArrangements(43)[0]) > 0, 'the reference Forty-Three frame keeps its opening');
});

test('chunky castles have four towers and a doorway; bridges have a supported deck and open span', () => {
  for (let number = 31; number <= 50; number++) {
    const forms = getCharacterArrangements(number);
    const castle = forms.find(form => form.shapeKind === 'castle'), bridge = forms.find(form => form.shapeKind === 'bridge');
    const castleCells = new Set(castle.cells.map(positionKey)), bridgeCells = new Set(bridge.cells.map(positionKey));
    for (const x of [0, 4]) for (const z of [0, 2]) for (let y = 0; y <= 3; y++) assert.ok(castleCells.has(`${x},${y},${z}`), `${number}: missing castle tower block`);
    for (let x = 1; x <= 3; x++) {
      assert.equal(castleCells.has(`${x},1,2`), false, `${number}: castle entrance is blocked`);
      assert.ok(castleCells.has(`${x},2,2`), `${number}: missing doorway lintel`);
    }
    for (let x = 0; x < 7; x++) for (let z = 0; z < 3; z++) assert.ok(bridgeCells.has(`${x},2,${z}`), `${number}: missing bridge deck block`);
    for (let x = 1; x <= 5; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 3; z++) assert.equal(bridgeCells.has(`${x},${y},${z}`), false, `${number}: bridge span is filled`);
    for (const x of [0, 6]) for (const z of [0, 2]) for (let y = 0; y < 2; y++) assert.ok(bridgeCells.has(`${x},${y},${z}`), `${number}: missing bridge pier block`);
  }
});

test('seeded crazy shapes preserve every cube and stay connected, compact and varied for 0–50', () => {
  const depths = new Set();
  for (const original of CHARACTERS) {
    const geometries = new Set(), ids = new Set();
    for (let seed = 0; seed < 64; seed++) {
      const form = createCrazyArrangement(original.number, seed);
      assert.deepEqual(form, createCrazyArrangement(original.number, seed), 'same seed must reproduce the exact shape');
      assertExactForm(form, original);
      geometries.add(geometry(form)); ids.add(form.formId); depths.add(form.depth);
      if (original.number < 2) { assert.equal(form.formId, 'original'); continue; }
      assert.match(form.formId, /^crazy:/);
      const limit = Math.max(3, Math.ceil(Math.sqrt(original.number) * 1.55));
      assert.ok(form.width <= limit && form.height <= limit && form.depth <= 3, 'a random tendril escaped the compact play footprint');
      if (original.number >= 3) assert.notEqual(form.width * form.height * form.depth, original.number, 'crazy shape accidentally became a solid box');
    }
    if (original.number < 2) assert.equal(geometries.size, 1);
    else if (original.number === 2) assert.equal(geometries.size, 2, 'two cubes have only the two planar domino orientations');
    else if (original.number === 3) assert.ok(geometries.size >= 3);
    else if (original.number === 4) assert.ok(geometries.size >= 8);
    else if (original.number === 5) assert.ok(geometries.size >= 15);
    else if (original.number === 6) assert.ok(geometries.size >= 25);
    else assert.ok(geometries.size >= 40, `${original.number}: only ${geometries.size} different shapes in 64 seeds`);
    if (original.number >= 2) assert.equal(ids.size, 64, 'fresh seeds need distinct form identifiers');
  }
  for (const depth of [1, 2, 3]) assert.ok(depths.has(depth), `no random shapes use depth ${depth}`);
  assert.deepEqual(createCrazyArrangement(36, 'a beach afternoon'), createCrazyArrangement(36, 'a beach afternoon'));
});

test('stable cycling restores original depth, window holes and exact cells; Zero and One do not invent shapes', () => {
  for (let number = 0; number <= 50; number++) {
    const forms = getCharacterArrangements(number);
    let form = forms[0];
    for (let index = 1; index < forms.length; index++) { form = getNextArrangement(number, form.formId); assert.equal(form, forms[index]); }
    assert.equal(getNextArrangement(number, form.formId), forms[0]);
    assert.equal(getNextArrangement(number, 'missing'), forms[0]);
  }
  assert.equal(getCharacterArrangements(0).length, 1); assert.equal(getCharacterArrangements(0)[0].cells.length, 0);
  assert.equal(getCharacterArrangements(1).length, 1); assert.equal(getCharacterArrangements(2).length, 2);
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

test('placement preserves the caller guard and checks it against the new body at every candidate', () => {
  const player = { number: 1, x: 30, z: 30, radius: .7 }, definition = rectangle(12, 4), expected = getCharacterMetrics(definition);
  const visited = [], canPlace = (point, metrics) => {
    assert.deepEqual(metrics, expected, 'the guard must receive the transformed body metrics');
    visited.push({ ...point });
    return point.x >= 30.5;
  };
  const result = findArrangementPosition(player, definition, { obstacles: [], world, maxDistance: 1, canPlace });
  assert.ok(result && result.position.x >= 30.5);
  assert.deepEqual(visited[0], { x: 30, z: 30 });
  assert.ok(visited.length > 1, 'a rejected candidate must not bypass the guard');
  assert.equal(findArrangementPosition(player, definition, { obstacles: [], world, maxDistance: 1, canPlace: () => false }), null);
  assert.deepEqual(player, { number: 1, x: 30, z: 30, radius: .7 });
});

test('every rendered arrangement retains unit cubes; faces, arms and feet attach to occupied surface cells', () => {
  for (const original of CHARACTERS) {
    for (const definition of [...getCharacterArrangements(original.number), ...([3, 8, 21, 27, 36, 40, 41, 43, 45, 47, 50].includes(original.number) ? [createCrazyArrangement(original.number, 3), createCrazyArrangement(original.number, 17)] : [])]) {
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
        const occupied = new Set(definition.cells.map(positionKey));
        const faceCell = model.root.userData.faceCell, patch = model.root.userData.facePatch;
        assert.ok(faceCell && occupied.has(positionKey(faceCell)), `${label}: face is attached to empty space`);
        assert.equal(occupied.has(positionKey({ ...faceCell, z: faceCell.z + 1 })), false, `${label}: face is buried behind another cube`);
        assert.ok(patch && patch.width >= 1 && patch.height >= 1, `${label}: missing occupied face patch`);
        for (let x = patch.x; x < patch.x + patch.width; x++) for (let y = patch.y; y < patch.y + patch.height; y++) {
          assert.ok(occupied.has(positionKey({ x, y, z: patch.z })), `${label}: face patch spans a hole`);
          assert.equal(occupied.has(positionKey({ x, y, z: patch.z + 1 })), false, `${label}: face patch is behind a cube`);
        }
        assert.ok(center.x >= patch.x - definition.width / 2 && center.x <= patch.x + patch.width - definition.width / 2, `${label}: face center misses its patch`);
        assert.ok(center.y >= .35 + patch.y && center.y <= .35 + patch.y + patch.height, `${label}: face center is outside its cubes`);
        const attachments = model.root.userData.armAttachments;
        assert.ok(attachments?.length >= 2, `${label}: missing arms`);
        for (const arm of attachments) {
          assert.ok(arm.cell && occupied.has(positionKey(arm.cell)), `${label}: detached arm`);
          assert.equal(occupied.has(positionKey({ ...arm.cell, x: arm.cell.x + arm.side })), false, `${label}: arm emerges inside a neighbor`);
          close(arm.x, arm.cell.x + (arm.side > 0 ? 1 : 0) - definition.width / 2, `${label}: arm is off the body surface`);
          assert.ok(arm.y >= .35 + arm.cell.y && arm.y <= 1.35 + arm.cell.y, `${label}: arm pivot outside its cube`);
        }
        const feet = model.root.userData.footAttachments;
        assert.ok(feet?.length >= 2, `${label}: missing feet`);
        for (const foot of feet) {
          assert.ok(occupied.has(positionKey(foot.cell)), `${label}: foot is attached to empty space`);
          assert.equal(foot.cell.y, 0, `${label}: foot floats above the ground`);
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
