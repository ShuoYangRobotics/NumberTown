import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, getCharacterMetrics, getCharacterFaceLayout, createCharacter } from '../dist/characters3d.js';
import { getCharacterDefinition } from '../dist/character-data.js';
import { Box3, Raycaster, Vector3 } from '../dist/vendor/three.module.js';

const key = ({ x, y }) => `${x},${y}`;
const key3 = ({ x, y, z=0 }) => `${x},${y},${z}`;
const shapes = [
  [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [2, 3], [1, 7], [2, 4], [3, 3], [2, 5],
  [2, 6], [3, 4], [3, 6], [2, 7], [5, 5], [4,4], [4,7], [3,6], [2,10], [2,10],
  [3,7], [4,6], [3,10], [3,8], [5,5], [4,7], [3,3], [3,11], [3,10], [3,10],
];
const moods = ['happy', 'excited', 'curious', 'surprised', 'sleepy', 'sad'];

function unitBlocks(root) {
  const blocks = [];
  root.traverse(object => { if (object.userData.unitBlock) blocks.push(object); });
  return blocks;
}

test('Zero to Thirty preserve 31 identities and 465 counted, connected unit cubes', () => {
  assert.equal(CHARACTERS.length, 31);
  assert.equal(new Set(CHARACTERS.map(friend => friend.name)).size, 31);
  assert.equal(CHARACTERS.reduce((sum,friend)=>sum+friend.cells.length,0),465);
  for (const [index, friend] of CHARACTERS.entries()) {
    assert.equal(friend.number, index);
    assert.equal(friend.cells.length, friend.number);
    if(friend.number===0){assert.deepEqual(friend.cells,[]);continue;}
    assert.deepEqual([friend.width, friend.height], shapes[friend.number-1]);
    const cells = new Set(friend.cells.map(key3));
    assert.equal(cells.size, friend.number, `${friend.name} has overlapping cubes`);
    for (const cell of friend.cells) {
      assert.ok(Number.isInteger(cell.x) && Number.isInteger(cell.y) && cell.x >= 0 && cell.y >= 0);
      assert.match(cell.color, /^#[0-9a-f]{6}$/i);
    }
    const queue = [friend.cells[0]], seen = new Set([key3(queue[0])]);
    for (let head = 0; head < queue.length; head++) {
      const { x, y, z=0 } = queue[head];
      for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
        const next = { x: x + dx, y: y + dy, z:z+dz }, id = key3(next);
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
  assert.equal(getCharacterDefinition(0).name,'Zero');
  assert.equal(getCharacterDefinition('0').number,0);
  assert.equal(getCharacterDefinition(30).name,'Thirty');
  assert.equal(getCharacterDefinition(200).number,30);
  assert.equal(getCharacterDefinition('19').number,19);
  assert.equal(getCharacterDefinition(-3).number,1);
  assert.equal(getCharacterDefinition(NaN).number,1);
  for(const input of[undefined,null,'',false,'not a number',Infinity,-.2])assert.equal(getCharacterDefinition(input).number,1);
  for(const data of CHARACTERS)assert.equal(getCharacterDefinition(data.number),data,'identity lookup must not assume index equals number minus one');
});

test('Zero is only a floating coral mouth and one black numeral, with no cubes, eyes, or limbs',()=>{
  const definition=getCharacterDefinition(0),zero=createCharacter(0),one=createCharacter(1);
  assert.equal(CHARACTERS[0],definition);assert.deepEqual(definition.cells,[]);
  assert.equal(unitBlocks(zero.root).length,0);assert.equal(zero.body.children.length,0);
  assert.deepEqual(zero.root.userData.armAttachments,[]);
  assert.ok(zero.root.getObjectByName('coral floating lip'));
  assert.ok(zero.root.getObjectByName('zero smiling teeth'));
  const numeral=zero.root.getObjectByName('black zero numeral');
  assert.ok(numeral.isMesh);assert.equal(numeral.material.color.getHexString(),'080c0c');
  let labels=0;
  zero.root.traverse(object=>{
    if(object.name==='number 0')labels++;
    assert.ok(!['eye white','pupil','arm','tentacle','hand','walking shoe','number plaque'].includes(object.name));
    if(object.geometry)assert.ok(Array.from(object.geometry.getAttribute('position').array).every(Number.isFinite));
  });
  assert.equal(labels,1,'Zero must not receive a second generic numeral plaque');
  const zeroSize=new Box3().setFromObject(zero.root).getSize(new Vector3()),oneSize=new Box3().setFromObject(one.root).getSize(new Vector3());
  assert.ok(zeroSize.x<oneSize.x&&zeroSize.y<oneSize.y,'Zero is visibly smaller than One');
  const metrics=getCharacterMetrics(0);
  for(const key of['width','height','depth','radius'])assert.ok(Number.isFinite(metrics[key])&&metrics[key]>0);
  assert.deepEqual(getCharacterMetrics(definition),metrics);
  assert.equal(zero.radius,metrics.radius);assert.ok(metrics.radius<getCharacterMetrics(1).radius);
  assert.deepEqual(getCharacterFaceLayout(0),{x:0,eyeY:.44,mouthY:.44,gap:0,size:0,mouth:.76});
  zero.dispose();one.dispose();
});

test('Zero preserves its model interface, floats without moving the root, and disposes its owned geometry once',()=>{
  const zero=createCharacter(0,{definition:{...getCharacterDefinition(0),formId:'original'}});
  zero.root.position.set(3,2,-4);zero.root.rotation.y=.75;
  zero.update(.016,{time:1.2,moving:true,emotion:'curious'});
  assert.deepEqual(zero.root.position.toArray(),[3,2,-4]);assert.equal(zero.root.rotation.y,.75);
  assert.equal(zero.root.userData.emotion,'curious');assert.notEqual(zero.root.getObjectByName('floating zero').position.y,0);
  const geometries=new Map();
  zero.root.traverse(object=>{if(object.geometry&&object.geometry.type!=='SphereGeometry')geometries.set(object.geometry,0);});
  for(const geometry of geometries.keys())geometry.addEventListener('dispose',()=>geometries.set(geometry,geometries.get(geometry)+1));
  zero.dispose();zero.dispose();
  assert.ok(geometries.size>10);assert.ok([...geometries.values()].every(count=>count===1));
});

test('Zero keeps a clearly visible ivory smile inside the lip from the normal elevated camera',()=>{
  const model=createCharacter(0),happy=model.face.getObjectByName('expression happy');
  const teeth=happy.getObjectByName('zero smiling teeth'),lip=happy.getObjectByName('coral floating lip');
  model.root.updateMatrixWorld(true);
  assert.ok(new Box3().setFromObject(teeth).max.z<new Box3().setFromObject(lip).max.z,'teeth must stay inside the lip front');
  const direction=new Vector3(0,Math.sin(.32),Math.cos(.32)),visible={teeth:0,cavity:0};
  for(let x=-.4;x<=.4;x+=.025)for(let y=.12;y<=.72;y+=.025){
    const ray=new Raycaster(new Vector3(x,y,0).addScaledVector(direction,3),direction.clone().negate());
    const hit=ray.intersectObject(happy,true)[0];
    if(hit?.object.name==='zero smiling teeth')visible.teeth++;
    if(hit?.object.name==='zero mouth cavity')visible.cavity++;
  }
  assert.ok(visible.teeth>0&&visible.teeth/(visible.teeth+visible.cavity)>.6,'the lip must not hide most of the ivory smile');
  assert.equal(teeth.receiveShadow,false,'tiny lip shadows must not blacken the teeth');
  model.dispose();
});

test('Twenty-One to Twenty-Five match their reference cube layouts and twenty-plus color groups',()=>{
  const accents={21:'#ed292d',22:'#ff9f19',23:'#f6db2c',24:'#77c627',25:'#37c5dc'};
  const expected={21:['1,3'],22:['1,5','2,5'],23:['2,0','2,1','2,2'],24:['1,2','1,3','1,4','1,5'],25:['0,0','1,0','2,0','3,0','4,0']};
  for(const number of[21,22,23,24,25]){
    const data=getCharacterDefinition(number);
    assert.equal(data.cells.filter(c=>c.color==='#ffd58b').length,20);
    assert.deepEqual(data.cells.filter(c=>c.color===accents[number]).map(key).sort(),expected[number]);
    assert.ok(data.cells.every(c=>c.outline==='#d49a37'));
  }
  assert.deepEqual(getCharacterDefinition(23).cells.filter(c=>c.x===2).map(c=>c.y),[0,1,2]);
});

test('Twenty-Six to Thirty match the reference shapes, colors, cube depth, and accessories',()=>{
  const data=getCharacterDefinition(26);
  assert.deepEqual(data.cells.filter(c=>c.color==='#7c26c4').map(key).sort(),['0,0','0,1','1,0','2,0','3,0','3,1']);
  assert.deepEqual(data.cells.filter(c=>c.y===6).map(key),['1,6','2,6']);
  const cube=getCharacterDefinition(27);
  assert.equal(cube.depth,3);assert.equal(new Set(cube.cells.map(key3)).size,27);
  assert.equal(cube.cells.filter(c=>c.color==='#ffd58b').length,20);
  for(let x=0;x<3;x++)for(let y=0;y<3;y++)for(let z=0;z<3;z++)assert.ok(cube.cells.some(c=>c.x===x&&c.y===y&&c.z===z));
  const frame=getCharacterDefinition(28);
  assert.equal(frame.cells.filter(c=>c.color==='#ef2ad7').length,8);
  assert.equal(frame.cells.filter(c=>c.color==='#ffd58b').length,20);
  assert.deepEqual(Array.from({length:11},(_,y)=>y).filter(y=>!frame.cells.some(c=>c.x===1&&c.y===y)),[1,3,5,7,9]);
  const twentyNine=getCharacterDefinition(29);
  assert.equal(twentyNine.cells.filter(c=>c.x<2).length,20);assert.equal(twentyNine.cells.filter(c=>c.x===2).length,9);
  assert.ok(getCharacterDefinition(30).cells.every(c=>c.color==='#f7e548'));
  const names={26:['black secret agent hat','black sunglass lens','secret agent tie'],27:['golden cube badge'],28:['rainbow window mask','rainbow wrist band'],29:['little number tile','number tile digit'],30:['thirty golden crown','red crown jewel']};
  for(const number of[26,27,28,29,30]){
    const model=createCharacter(number);
    for(const name of names[number])assert.ok(model.root.getObjectByName(name),`${number} is missing ${name}`);
    assert.ok(model.root.userData.faceCenter.z>getCharacterDefinition(number).depth/2);
    assert.equal(model.root.userData.armAttachments.length,2);
  }
});

test('Twenty-Eight has five visibly clear through-holes, including around its facial details',()=>{
  const model=createCharacter(28);model.root.updateMatrixWorld(true);
  for(const y of[1,3,5,7,9])for(const dx of[-.32,0,.32])for(const dy of[-.32,0,.32]){
    const ray=new Raycaster(new Vector3(dx,y+.85+dy,3),new Vector3(0,0,-1));
    assert.equal(ray.intersectObject(model.root,true).filter(hit=>hit.object.isMesh).length,0,`hole ${y} is filled by art at ${dx},${dy}`);
  }
});

test('definition overrides keep all cubes unscaled while faces, limbs, and props fit one-high bodies',()=>{
  for(const number of[6,10,20,21,24,26,27,28,29,30]){
    const original=getCharacterDefinition(number),definition={...original,formId:`${number}x1`,transformed:true,width:number,height:1,depth:1,cells:original.cells.map((c,i)=>({...c,x:i,y:0,z:0}))};
    const model=createCharacter(number,{definition}),metrics=getCharacterMetrics(definition);
    assert.equal(model.width,number);assert.equal(model.height,1);assert.equal(model.radius,metrics.radius);
    for(const cube of unitBlocks(model.root)){assert.deepEqual(cube.scale.toArray(),[1,1,1]);assert.equal(cube.position.y,.85);}
    const face=getCharacterFaceLayout(number,definition);
    assert.ok(face.eyeY>.35&&face.eyeY<1.35);assert.ok(face.mouthY>.35&&face.mouthY<1.35);
    for(const point of model.root.userData.armAttachments){assert.ok(point.y>.35&&point.y<1.35);assert.equal(Math.abs(point.x),number/2);}
    model.root.updateMatrixWorld(true);
    for(const child of model.root.children){
      child.traverse(object=>{
        if(object.name==='adapted handheld props'&&object.children.length){
          const bounds=new Box3().setFromObject(object);assert.ok(bounds.min.y>=.13,`${number} handheld props sink into the ground`);
        }
      });
    }
    for(const mood of moods){model.setEmotion(mood);model.update(.016,{time:.7,moving:true});}
    model.dispose();
  }
});

test('dispose releases each model-owned geometry once while preserving shared cubes, spheres, and materials',()=>{
  const model=createCharacter(21),second=createCharacter(27);
  const sharedCube=unitBlocks(model.root)[0].geometry;
  const sharedSphere=model.root.getObjectByName('walking shoe').geometry;
  let sharedDisposed=0;
  sharedCube.addEventListener('dispose',()=>sharedDisposed++);sharedSphere.addEventListener('dispose',()=>sharedDisposed++);
  const geometries=new Map(),materials=new Set();
  model.root.traverse(object=>{
    if(object.geometry&&object.geometry!==sharedCube&&object.geometry!==sharedSphere)geometries.set(object.geometry,0);
    if(object.material)materials.add(object.material);
  });
  for(const geometry of geometries.keys())geometry.addEventListener('dispose',()=>geometries.set(geometry,geometries.get(geometry)+1));
  for(const material of materials)material.addEventListener('dispose',()=>sharedDisposed++);
  model.dispose();model.dispose();
  assert.ok(geometries.size>20);assert.ok([...geometries.values()].every(n=>n===1));assert.equal(sharedDisposed,0);
  assert.equal(unitBlocks(second.root)[0].geometry,sharedCube);
  second.setEmotion('happy');second.update(.016,{moving:true});second.dispose();
  assert.equal(sharedDisposed,0);
});

test('Twenty-One has a substantial mesh backpack, rolled bedding, and a bounded navigable footprint',()=>{
  const model=createCharacter(21),pack=model.root.getObjectByName('explorer backpack'),metrics=getCharacterMetrics(21);
  assert.ok(pack?.isGroup);
  const names=['olive backpack body','backpack flap','backpack side pocket','backpack lower pocket','backpack shoulder strap','backpack securing strap','brass backpack buckle','green top roll','red roll end cap','cream sleeping mat','sleeping mat spiral','sleeping mat strap','green explorer hat','rainbow hat feather','hiking staff','hiking boot lace'];
  for(const name of names)assert.ok(model.root.getObjectByName(name),`Twenty-One is missing ${name}`);
  const main=model.root.getObjectByName('olive backpack body');
  model.root.updateMatrixWorld(true);
  const bounds=new Box3().setFromObject(main),size=bounds.getSize(new Vector3());
  assert.ok(size.x>2.3&&size.y>4.5&&size.z>1,'the pack must be a substantial volume');
  assert.ok(bounds.max.z<-.5&&bounds.min.z<-1.6,'the pack sits behind the unit-deep body');
  let spirals=0,caps=0;
  pack.traverse(object=>{
    if(object.name==='sleeping mat spiral')spirals++;
    if(object.name==='red roll end cap')caps++;
    if(!object.isMesh)return;
    const positions=object.geometry.getAttribute('position'),point=new Vector3();
    for(let i=0;i<positions.count;i++){
      point.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);
      assert.ok(Math.hypot(point.x,point.z)<=metrics.radius+1e-5,`${object.name} exceeds the collision radius`);
    }
  });
  assert.equal(spirals,2);assert.equal(caps,2);
  assert.ok(metrics.depth>=2.5&&metrics.radius<=2.7,'the full backpack remains safe on the mountain route');
  for(const name of['green top roll','cream sleeping mat']){
    const roll=pack.getObjectByName(name);
    assert.equal(roll.geometry.type,'CylinderGeometry');
    assert.ok(Math.abs(roll.rotation.z-Math.PI/2)<1e-9,'bedrolls lie across the shoulders');
  }
});

test('Twenty-One to Twenty-Five keep their distinctive faces, spectacles, and celestial accessories',()=>{
  const layouts={21:[0,5.87,5.18],22:[-.17,1.53,.88],23:[.62,2.04,1.5],24:[0,4.84,4.12],25:[0,1.95,1.13]};
  const features={21:['pointed purple explorer mask'],22:['striped trainer'],23:['eye rim'],24:['sun staff','golden sun','moon staff','starry crescent moon','square glasses'],25:['square glasses','blue crown eyebrow','gentle blue smile']};
  for(const number of[21,22,23,24,25]){
    const model=createCharacter(number),face=getCharacterFaceLayout(number);
    for(const [index,value]of[face.x,face.eyeY,face.mouthY].entries())assert.ok(Math.abs(value-layouts[number][index])<1e-9);
    assert.equal(model.root.userData.faceCenter.x,face.x);
    assert.equal(model.root.userData.faceCenter.y,(face.eyeY+face.mouthY)/2);
    for(const name of features[number])assert.ok(model.root.getObjectByName(name),`${number} is missing ${name}`);
    model.root.traverse(object=>{
      if(object.geometry)assert.ok(Array.from(object.geometry.getAttribute('position').array).every(Number.isFinite),`${number}/${object.name} has invalid vertices`);
    });
  }
  const happy=createCharacter(22).root.getObjectByName('expression happy');
  const eyes=happy.children.filter(o=>o.name==='eye white');
  assert.equal(eyes.length,2);
  assert.ok(eyes[0].scale.x>eyes[1].scale.x*1.3,'Twenty-Two has unequal eyes');
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
      const { x, y, z=0 } = block.userData.cell;
      assert.ok(Math.abs(block.position.x - (x + .5 - data.width / 2)) < 1e-10);
      assert.ok(Math.abs(block.position.y - (y + .85)) < 1e-10);
      assert.equal(block.position.z, z-(data.depth-1)/2);
      return key3({ x, y, z });
    });
    assert.deepEqual(actual.sort(), data.cells.map(key3).sort());
    if(data.number===0)continue;
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
    assert.equal(metrics.depth, data.number===21?2.6:data.depth);
    assert.ok(metrics.radius >= data.width / 2);
    assert.ok(Math.abs(metrics.radius - Math.hypot(data.width / 2, data.number===21?2.1:data.depth/2)) < 1e-10);
    const character = createCharacter(data.number);
    assert.equal(character.height, metrics.height);
    assert.equal(character.width, metrics.width);
    assert.equal(character.radius, metrics.radius);
  }
});

test('golden cube grids stand clear of the body surface and retain depth occlusion',()=>{
  for(const number of[20,21,22,23,24,25]){
    const model=createCharacter(number),data=getCharacterDefinition(number);
    const grid=model.body.getObjectByName('raised golden unit grid');
    assert.ok(grid?.isMesh,'the visible grid must use real geometry');
    assert.equal(grid.material.depthTest,true,'rear seams must stay hidden behind the body');
    model.root.updateMatrixWorld(true);
    for(const cell of data.cells){
      for(const side of[-1,1]){
        const origin=new Vector3(cell.x+.5-data.width/2,cell.y+1.35,side*2);
        const ray=new Raycaster(origin,new Vector3(0,0,-side));
        const hits=ray.intersectObject(grid);
        assert.ok(hits.length>0,`${number}: cube ${key(cell)} has no solid horizontal seam`);
        assert.ok(hits[0].point.z*side>.502,'the visible seam must be in front of its cube surface');
      }
    }
    model.body.children.filter(o=>o.name==='unit cube seams').forEach(outline=>{
      assert.equal(outline.material.depthWrite,false);
      assert.equal(outline.material.depthTest,true);
      const p=outline.geometry.getAttribute('position');
      for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getZ(i))>.5,'line edges must not share the cube depth');
    });
  }
});

test('every character has six different prebuilt mesh expressions, with no canvas or document', () => {
  assert.equal(typeof document, 'undefined');
  for (const data of CHARACTERS) {
    const character = createCharacter(data.number);
    const expressions = character.face.children.filter(object => object.name.startsWith('expression '));
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
    if(data.number===0){assert.equal(movingLimbs,0);assert.notEqual(character.root.getObjectByName('floating zero').position.y,0);}
    else assert.ok(movingLimbs >= 4, `${data.name} must animate both feet and arms`);
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
