import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, getCharacterMetrics, createCharacter } from '../dist/characters3d.js';
import { getCharacterDefinition } from '../dist/character-data.js';

const key = ({ x, y }) => `${x},${y}`;
const shapes = [
  [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [2, 3], [1, 7], [2, 4], [3, 3], [2, 5],
  [2, 6], [3, 4], [3, 6], [2, 7], [5, 5],
];
const moods = ['happy', 'excited', 'curious', 'surprised', 'sleepy', 'sad'];

function unitBlocks(root) {
  const blocks = [];
  root.traverse(object => { if (object.userData.unitBlock) blocks.push(object); });
  return blocks;
}

test('One to Fifteen have exactly counted, unique, connected unit-cell shapes', () => {
  assert.equal(CHARACTERS.length, 15);
  assert.equal(new Set(CHARACTERS.map(friend => friend.name)).size, 15);
  for (const [index, friend] of CHARACTERS.entries()) {
    assert.equal(friend.number, index + 1);
    assert.equal(friend.cells.length, friend.number);
    assert.deepEqual([friend.width, friend.height], shapes[index]);
    const cells = new Set(friend.cells.map(key));
    assert.equal(cells.size, friend.number, `${friend.name} has overlapping cubes`);
    for (const cell of friend.cells) {
      assert.ok(Number.isInteger(cell.x) && Number.isInteger(cell.y) && cell.x >= 0 && cell.y >= 0);
      assert.match(cell.color, /^#[0-9a-f]{6}$/i);
    }
    const queue = [friend.cells[0]], seen = new Set([key(queue[0])]);
    for (let head = 0; head < queue.length; head++) {
      const { x, y } = queue[head];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = { x: x + dx, y: y + dy }, id = key(next);
        if (!cells.has(id) || seen.has(id)) continue;
        seen.add(id); queue.push(next);
      }
    }
    assert.equal(seen.size, friend.number, `${friend.name} has detached cubes`);
  }
});

test('Eleven to Fifteen match the supplied reference arrangements and colors', () => {
  const eleven = getCharacterDefinition(11);
  assert.deepEqual(eleven.cells.filter(cell => cell.y >= 5).map(key), ['1,5']);
  const twelve = getCharacterDefinition(12);
  assert.deepEqual(twelve.cells.filter(cell => cell.color === '#ffb349').map(key).sort(), ['1,1', '1,2']);
  const thirteen = getCharacterDefinition(13);
  assert.deepEqual(thirteen.cells.filter(cell => cell.color === '#f6d649').map(key).sort(), ['1,5', '2,4', '2,5']);
  const fourteen = getCharacterDefinition(14);
  assert.deepEqual(fourteen.cells.filter(cell => cell.color === '#61c981').map(key).sort(), ['0,5', '0,6', '1,5', '1,6']);
  const fifteen = getCharacterDefinition(15);
  for (let x = 0; x < 5; x++) {
    const column = fifteen.cells.filter(cell => cell.x === x);
    assert.equal(column.length, x + 1);
    assert.deepEqual(column.map(cell => cell.y), Array.from({ length: x + 1 }, (_, y) => y));
    for (const cell of column) {
      assert.equal(cell.color, x === 4 ? '#4dc5df' : '#fffaf1');
      assert.equal(cell.outline, x === 4 ? undefined : '#d9384a');
    }
  }
  for (const number of [10, 11, 13, 14, 15]) {
    const white = getCharacterDefinition(number).cells.filter(cell => cell.color === '#fffaf1');
    assert.equal(white.length, 10, `${number} must visibly contain a white ten`);
    assert.ok(white.every(cell => cell.outline === '#d9384a'));
  }
});

test('3D bodies contain exact unscaled 1×1×1 cubes, flush on the declared grid', () => {
  for (const data of CHARACTERS) {
    const character = createCharacter(data.number);
    const blocks = unitBlocks(character.root);
    assert.equal(blocks.length, data.number);
    assert.equal(unitBlocks(character.body).length, data.number);
    const actual = blocks.map(block => {
      assert.ok(block.isMesh, 'unit blocks must be real meshes');
      assert.equal(block.geometry.type, 'BoxGeometry');
      assert.equal(block.geometry.parameters.width, 1);
      assert.equal(block.geometry.parameters.height, 1);
      assert.equal(block.geometry.parameters.depth, 1);
      assert.deepEqual(block.scale.toArray(), [1, 1, 1], 'body cubes cannot be stretched');
      assert.deepEqual(block.rotation.toArray().slice(0, 3), [0, 0, 0]);
      const { x, y } = block.userData.cell;
      assert.ok(Math.abs(block.position.x - (x + .5 - data.width / 2)) < 1e-10);
      assert.ok(Math.abs(block.position.y - (y + .85)) < 1e-10);
      assert.equal(block.position.z, 0);
      return key({ x, y });
    });
    assert.deepEqual(actual.sort(), data.cells.map(key).sort());
    const left = Math.min(...blocks.map(block => block.position.x - .5));
    const right = Math.max(...blocks.map(block => block.position.x + .5));
    const bottom = Math.min(...blocks.map(block => block.position.y - .5));
    const top = Math.max(...blocks.map(block => block.position.y + .5));
    assert.equal(right - left, data.width);
    assert.ok(Math.abs(top - bottom - data.height) < 1e-10);
    assert.ok(Math.abs(bottom - .35) < 1e-10);
    assert.equal(left + right, 0, 'the bounding body must be centered horizontally');
  }
});

test('body metrics reflect cube dimensions and enclose the ground footprint', () => {
  for (const data of CHARACTERS) {
    const metrics = getCharacterMetrics(data.number);
    assert.equal(metrics.width, data.width);
    assert.equal(metrics.height, data.height);
    assert.equal(metrics.depth, 1);
    assert.ok(metrics.radius >= data.width / 2);
    assert.ok(Math.abs(metrics.radius - Math.hypot(data.width / 2, .5)) < 1e-10);
    const character = createCharacter(data.number);
    assert.equal(character.height, metrics.height);
    assert.equal(character.width, metrics.width);
    assert.equal(character.radius, metrics.radius);
  }
});

test('every character has six different prebuilt mesh expressions, with no canvas or document', () => {
  assert.equal(typeof document, 'undefined');
  for (const data of CHARACTERS) {
    const character = createCharacter(data.number);
    const expressions = character.root.children.filter(object => object.name.startsWith('expression '));
    assert.equal(expressions.length, 6);
    const sceneChildren = character.root.children.length;
    const signatures = [];
    for (const emotion of moods) {
      assert.equal(character.setEmotion(emotion), emotion);
      assert.equal(character.root.userData.emotion, emotion);
      const visible = expressions.filter(object => object.visible);
      assert.equal(visible.length, 1);
      assert.equal(visible[0].name, `expression ${emotion}`);
      let meshCount = 0;
      const signature = [];
      visible[0].traverse(object => {
        if (!object.isMesh) return;
        meshCount++;
        const vertices = object.geometry.getAttribute('position');
        signature.push([object.name, object.position.toArray(), object.scale.toArray(), Array.from(vertices.array).slice(0, 24)]);
      });
      assert.ok(meshCount >= 2, `${data.name}/${emotion} needs visible mesh features`);
      signatures.push(JSON.stringify(signature));
      assert.equal(character.root.children.length, sceneChildren, 'emotion changes must reuse prebuilt art');
    }
    assert.equal(new Set(signatures).size, 6, `${data.name} repeats an emotion face`);
    assert.equal(character.setEmotion('unrecognized'), 'happy');
  }
});

test('walking animates limbs while preserving externally owned position, heading, and unit cubes', () => {
  for (const data of CHARACTERS) {
    const character = createCharacter(data.number);
    character.root.position.set(9, 2.5, -7);
    character.root.rotation.y = .83;
    const blocks = unitBlocks(character.root);
    const original = blocks.map(block => block.position.toArray());
    character.update(.016, { time: .43, moving: true, emotion: 'curious' });
    assert.deepEqual(character.root.position.toArray(), [9, 2.5, -7]);
    assert.equal(character.root.rotation.y, .83);
    assert.deepEqual(blocks.map(block => block.position.toArray()), original);
    assert.equal(character.root.userData.emotion, 'curious');
    let movingLimbs = 0;
    character.root.children.forEach(object => {
      if (object.children.some(child => child.name === 'arm' || child.name === 'tentacle' || child.name === 'walking shoe') && Math.abs(object.rotation.x) > .01) movingLimbs++;
    });
    assert.ok(movingLimbs >= 4, `${data.name} must animate both feet and arms`);
    for (let i = 0; i < 10; i++) character.update(.016, { moving: i % 2 === 0 });
    character.root.traverse(object => {
      assert.ok([...object.position.toArray(), ...object.scale.toArray(), ...object.quaternion.toArray()].every(Number.isFinite));
    });
  }
});

test('Eight has exactly six arm tentacles and two walking shoes', () => {
  const { root } = createCharacter(8);
  let tentacles = 0, feet = 0;
  root.traverse(object => { if (object.name === 'tentacle') tentacles++; if (object.name === 'walking shoe') feet++; });
  assert.equal(tentacles, 6);
  assert.equal(feet, 2);
});
