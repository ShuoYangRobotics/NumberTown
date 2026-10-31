import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, getCharacterMetrics, getCharacterFaceLayout, createCharacter } from '../dist/characters3d.js';
import { getCharacterDefinition } from '../dist/character-data.js';

const key = ({ x, y }) => `${x},${y}`;
const shapes = [
  [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [2, 3], [1, 7], [2, 4], [3, 3], [2, 5],
  [2, 6], [3, 4], [3, 6], [2, 7], [5, 5], [4,4], [4,7], [3,6], [2,10], [2,10],
];
const moods = ['happy', 'excited', 'curious', 'surprised', 'sleepy', 'sad'];

function unitBlocks(root) {
  const blocks = [];
  root.traverse(object => { if (object.userData.unitBlock) blocks.push(object); });
  return blocks;
}

test('One to Twenty have exactly counted, unique, connected unit-cell shapes totaling 210 cubes', () => {
  assert.equal(CHARACTERS.length, 20);
  assert.equal(new Set(CHARACTERS.map(friend => friend.name)).size, 20);
  assert.equal(CHARACTERS.reduce((sum,friend)=>sum+friend.cells.length,0),210);
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

test('Sixteen to Twenty match the supplied shapes, ten-parts, and color groups',()=>{
  const sixteen=getCharacterDefinition(16),seventeen=getCharacterDefinition(17),eighteen=getCharacterDefinition(18),nineteen=getCharacterDefinition(19),twenty=getCharacterDefinition(20);
  assert.deepEqual(sixteen.cells.filter(c=>c.color==='#7541c2').map(key).sort(),['0,0','1,0','1,1','2,0','2,1','3,0']);
  const rainbow=seventeen.cells.filter(c=>c.color!=='#fffaf1');
  assert.deepEqual(rainbow.map(key),['0,3','0,4','0,5','1,5','2,5','3,5','3,6']);
  assert.equal(new Set(rainbow.map(c=>c.color)).size,7);
  for(const cell of seventeen.cells.filter(c=>c.color==='#fffaf1'))assert.ok((cell.x===1||cell.x===2)&&cell.y<=4);
  assert.deepEqual(eighteen.cells.filter(c=>c.color==='#f132c4').map(key).sort(),['0,0','1,0','2,0','2,1','2,2','2,3','2,4','2,5']);
  assert.equal(nineteen.cells.filter(c=>c.x===0).length,10);assert.equal(nineteen.cells.filter(c=>c.x===1).length,9);
  assert.ok(nineteen.cells.filter(c=>c.x===0).every(c=>c.color==='#fffaf1'));
  assert.ok(nineteen.cells.filter(c=>c.x===1).every(c=>c.color!=='#fffaf1'));
  assert.ok(twenty.cells.every(c=>c.outline==='#c58b35'&&c.color!=='#fffaf1'));
  for(const data of[sixteen,seventeen,eighteen,nineteen]){
    const white=data.cells.filter(c=>c.color==='#fffaf1');assert.equal(white.length,10);assert.ok(white.every(c=>c.outline==='#d9384a'));
  }
});

test('definition lookup supports the whole roster and clamps safely',()=>{
  assert.equal(getCharacterDefinition(20).name,'Twenty');
  assert.equal(getCharacterDefinition(200).number,CHARACTERS.length);
  assert.equal(getCharacterDefinition('19').number,19);
  assert.equal(getCharacterDefinition(-3).number,1);
  assert.equal(getCharacterDefinition(NaN).number,1);
});

test('red frames trace the declared outlined cells and never appear on Twenty',()=>{
  for(const data of CHARACTERS){
    const {body}=createCharacter(data.number),frames=body.children.filter(o=>o.name==='red ten frame');
    const outlined=data.cells.filter(c=>c.outline==='#d9384a');
    assert.equal(frames.length,outlined.length?2:0,`${data.name} has the wrong frame`);
    for(const frame of frames){
      assert.equal(frame.userData.outlineCells,outlined.length);
      const p=frame.userData.perimeter;
      let area=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];area+=a.x*b.y-b.x*a.y;}
      assert.equal(Math.abs(area)/2,outlined.length,'raised outline must enclose exactly its declared cells');
    }
  }
});

test('the new characters have low readable faces and their reference accessories',()=>{
  for(const number of[16,17,18,19,20]){
    const model=createCharacter(number),face=getCharacterFaceLayout(number);
    assert.ok(face.eyeY>face.mouthY&&face.eyeY<=2.2);
    assert.equal(model.root.userData.faceCenter.x,face.x);
    assert.equal(model.root.userData.faceCenter.y,(face.eyeY+face.mouthY)/2);
    const names={16:['purple megaphone'],17:['paintbrush','paint palette','colorful paint splash'],18:['square glasses','white wrist band'],19:['eye rim','zigzag eyebrow'],20:['purple top hat','white bow tie','golden cane','purple spectacle temple','white spats']}[number];
    for(const name of names)assert.ok(model.root.getObjectByName(name),`${number} is missing ${name}`);
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
