import * as THREE from './vendor/three.module.js';
import { CHARACTERS, getCharacterDefinition, getCharacterMetrics } from './character-data.js';
export { CHARACTERS, getCharacterMetrics } from './character-data.js';

const FEET = .35;
const MOODS = ['happy', 'excited', 'curious', 'surprised', 'sleepy', 'sad'];
const materials = new Map();
const lines = new Map();
const CUBE = new THREE.BoxGeometry(1, 1, 1);
const SPHERE = new THREE.SphereGeometry(1, 16, 12);
const EDGES = new THREE.EdgesGeometry(CUBE).getAttribute('position').array;
const RAINBOW = ['#ee3d49', '#ff9f31', '#ffe03d', '#55bd38', '#32cce1', '#8053d4', '#b44ecc'];
const Z = .56;

function material(color) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .54, metalness: 0 }));
  return materials.get(color);
}
function mesh(geometry, color, name) {
  const object = new THREE.Mesh(geometry, material(color));
  object.castShadow = true;
  object.receiveShadow = true;
  if (name) object.name = name;
  return object;
}
function ball(parent, x, y, z, rx, ry, rz, color, name) {
  const object = mesh(SPHERE, color, name);
  object.position.set(x, y, z); object.scale.set(rx, ry, rz); parent.add(object);
  return object;
}
function box(parent, x, y, z, w, h, d, color, name) {
  const object = mesh(CUBE, color, name);
  object.position.set(x, y, z); object.scale.set(w, h, d); parent.add(object);
  return object;
}
function tube(parent, points, radius, color, closed = false, name) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), closed, 'centripetal');
  const object = mesh(new THREE.TubeGeometry(curve, Math.max(12, points.length * 5), radius, 7, closed), color, name);
  parent.add(object);
  return object;
}
function polygon(parent, points, depth, color, x = 0, y = 0, z = Z, name) {
  const shape = new THREE.Shape();
  points.forEach(([px, py], i) => i ? shape.lineTo(px, py) : shape.moveTo(px, py));
  shape.closePath();
  const object = mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), color, name);
  object.position.set(x, y, z); parent.add(object);
  return object;
}
function star(parent, x, y, z, outer, inner, color, points = 5, angle = Math.PI / 2) {
  const path = Array.from({ length: points * 2 }, (_, i) => {
    const a = angle + i * Math.PI / points, r = i % 2 ? inner : outer;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  return polygon(parent, path, .035, color, x, y, z, 'star decoration');
}
function ring(parent, x, y, z, rx, ry, radius, color) {
  return tube(parent, Array.from({ length: 24 }, (_, i) => {
    const a = i / 24 * Math.PI * 2; return [x + rx * Math.cos(a), y + ry * Math.sin(a), z];
  }), radius, color, true, 'eye rim');
}
function rectangleRing(parent, x, y, z, w, h, radius, color) {
  const r = Math.min(w, h) * .17;
  const points = [];
  for (const [cx, cy, start] of [[x + w / 2 - r, y + h / 2 - r, 0], [x - w / 2 + r, y + h / 2 - r, 90], [x - w / 2 + r, y - h / 2 + r, 180], [x + w / 2 - r, y - h / 2 + r, 270]]) {
    for (let i = 0; i <= 4; i++) {
      const a = (start + i * 22.5) * Math.PI / 180;
      points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]);
    }
  }
  return tube(parent, points, radius, color, true, 'square glasses');
}
function goldenGrid(body, data) {
  // Thin solid ridges keep the twenty-part count readable at normal game
  // distances. Merge every unique edge into one mesh rather than issuing a
  // draw call for each cube seam. The unit cubes themselves remain untouched.
  const edges = new Map();
  for (const cell of data.cells) {
    for (let i = 0; i < EDGES.length; i += 6) {
      const a = [EDGES[i] + cell.x + .5, EDGES[i + 1] + cell.y + .5, EDGES[i + 2] * 1.032];
      const b = [EDGES[i + 3] + cell.x + .5, EDGES[i + 4] + cell.y + .5, EDGES[i + 5] * 1.032];
      const key = [a.join(','), b.join(',')].sort().join('|');
      if (!edges.has(key)) edges.set(key, [a, b]);
    }
  }
  const cylinder = new THREE.CylinderGeometry(.014, .014, 1, 6);
  const source = cylinder.getAttribute('position'), normals = cylinder.getAttribute('normal');
  const positions = [], normalData = [], indices = [];
  const up = new THREE.Vector3(0, 1, 0), rotation = new THREE.Quaternion(), point = new THREE.Vector3();
  for (const [a, b] of edges.values()) {
    const start = new THREE.Vector3(a[0] - data.width / 2, a[1] + FEET, a[2]);
    const end = new THREE.Vector3(b[0] - data.width / 2, b[1] + FEET, b[2]);
    const direction = end.clone().sub(start), length = direction.length(), center = start.add(end).multiplyScalar(.5);
    rotation.setFromUnitVectors(up, direction.normalize());
    const offset = positions.length / 3;
    for (let i = 0; i < source.count; i++) {
      point.fromBufferAttribute(source, i); point.y *= length; point.applyQuaternion(rotation).add(center);
      positions.push(point.x, point.y, point.z);
      point.fromBufferAttribute(normals, i).applyQuaternion(rotation); normalData.push(point.x, point.y, point.z);
    }
    for (const index of cylinder.index.array) indices.push(index + offset);
  }
  cylinder.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normalData, 3));
  geometry.setIndex(indices);
  const grid = mesh(geometry, '#b47a2e', 'raised golden unit grid');
  grid.castShadow = false; body.add(grid);
}
function outlineBody(body, data) {
  const grouped = new Map();
  for (const cell of data.cells) {
    const color = cell.outline || '#36515a';
    if (!grouped.has(color)) grouped.set(color, []);
    const vertices = grouped.get(color);
    for (let index = 0; index < EDGES.length; index += 3) {
      vertices.push(EDGES[index] * 1.012 + cell.x + .5 - data.width / 2, EDGES[index + 1] * 1.012 + cell.y + .5 + FEET, EDGES[index + 2] * 1.012);
    }
  }
  for (const [color, vertices] of grouped) {
    if (!lines.has(color)) lines.set(color, new THREE.LineBasicMaterial({ color, transparent: true, depthWrite: false, opacity: color === '#36515a' ? .35 : .62 }));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const outline = new THREE.LineSegments(geometry, lines.get(color)); outline.name = 'unit cube seams'; body.add(outline);
  }
  if (data.number >= 20) goldenGrid(body, data);
  const framed=data.cells.filter(cell=>cell.outline==='#d9384a');
  if (framed.length) {
    // Follow the actual ten-part outline, including offset rectangles and
    // notches. Twenty's golden outline deliberately has no red ten-frame.
    const occupied=new Set(framed.map(cell=>`${cell.x},${cell.y}`)),edges=[];
    for(const {x,y} of framed){
      if(!occupied.has(`${x},${y-1}`))edges.push([[x,y],[x+1,y]]);
      if(!occupied.has(`${x+1},${y}`))edges.push([[x+1,y],[x+1,y+1]]);
      if(!occupied.has(`${x},${y+1}`))edges.push([[x+1,y+1],[x,y+1]]);
      if(!occupied.has(`${x-1},${y}`))edges.push([[x,y+1],[x,y]]);
    }
    const remaining=new Map(edges.map(edge=>[edge[0].join(','),edge]));
    const contours=[];
    while(remaining.size){
      const first=remaining.values().next().value,contour=[];let edge=first;
      while(edge){contour.push(edge[0]);remaining.delete(edge[0].join(','));edge=remaining.get(edge[1].join(','));}
      contours.push(contour);
    }
    for(const perimeter of contours){
    for (const z of [-.508, .508]) {
      const curve = new THREE.CurvePath();
      perimeter.forEach(([x, y], i) => {
        const next = perimeter[(i + 1) % perimeter.length];
        curve.add(new THREE.LineCurve3(new THREE.Vector3(x-data.width/2, FEET+y, z),new THREE.Vector3(next[0]-data.width/2,FEET+next[1],z)));
      });
      const frame=mesh(new THREE.TubeGeometry(curve,perimeter.length*6,.022,6,true),'#da3247','red ten frame');
      frame.userData.outlineCells=framed.length;frame.userData.perimeter=perimeter.map(([x,y])=>({x,y}));body.add(frame);
    }
    }
  }
}

function glove(parent, color, starGlove = false) {
  ball(parent, 0, 0, .02, .15, .19, .115, color, 'palm');
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * .082;
    tube(parent, [[x, .06, .02], [x * 1.35, .2 + (i === 1 || i === 2 ? .04 : 0), .035], [x * 1.5, .29 + (i === 1 || i === 2 ? .04 : 0), .025]], .043, color);
  }
  tube(parent, [[-.1, -.02, .03], [-.23, .03, .04], [-.26, .13, .025]], .047, color);
  if (starGlove) {
    star(parent, 0, .005, .132, .115, .048, '#df334a');
    box(parent, 0, -.16, 0, .22, .065, .19, '#df334a');
  }
}
function soccerBall(parent) {
  ball(parent, 0, 0, 0, .34, .34, .34, '#fffdf5', 'football');
  for (const direction of [[0, 0, 1], [.8, .4, .45], [-.8, .4, .45], [.3, -.83, .45], [-.45, -.76, .45], [0, 1, -.1], [0, 0, -1]]) {
    const normal = new THREE.Vector3(...direction).normalize();
    const patch = mesh(new THREE.CircleGeometry(.105, 5), '#283238');
    patch.position.copy(normal).multiplyScalar(.339);
    patch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    parent.add(patch);
  }
}
function skateboard(parent) {
  const board = new THREE.Group();
  board.rotation.z = -.09; parent.add(board);
  const shape = new THREE.Shape();
  shape.moveTo(-.23, -.67); shape.lineTo(-.23, .67); shape.absarc(0, .67, .23, Math.PI, 0, true);
  shape.lineTo(.23, -.67); shape.absarc(0, -.67, .23, 0, -Math.PI, true); shape.closePath();
  const deck = mesh(new THREE.ExtrudeGeometry(shape, { depth: .09, bevelEnabled: true, bevelSize: .025, bevelThickness: .02, bevelSegments: 2 }), '#8945b9', 'rainbow skateboard');
  board.add(deck);
  for (let i = 0; i < 7; i++) box(board, 0, -.66 + i * .22, .105, .43, .219, .018, RAINBOW[i]);
  box(board, 0, 0, .121, .045, 1.72, .018, '#fffdf5');
  for (const side of [-1, 1]) {
    for (const y of [-.56, .56]) {
      const wheel = mesh(new THREE.CylinderGeometry(.11, .11, .13, 12), '#e89629');
      wheel.rotation.z = Math.PI / 2; wheel.position.set(side * .27, y, -.03); board.add(wheel);
    }
  }
  return board;
}
function megaphone(parent){
  const prop=new THREE.Group();prop.name='purple megaphone';prop.position.set(-.18,.07,.15);prop.rotation.z=-.18;parent.add(prop);
  const cone=mesh(new THREE.CylinderGeometry(.29,.105,.5,24,1,true),'#fff9ef','megaphone horn');cone.rotation.z=Math.PI/2;prop.add(cone);
  const rim=mesh(new THREE.TorusGeometry(.29,.045,8,24),'#7135b2','megaphone rim');rim.rotation.y=Math.PI/2;rim.position.x=-.25;prop.add(rim);
  ball(prop,-.255,0,0,.025,.22,.22,'#c7b1df','megaphone inside');
  box(prop,.17,-.16,0,.12,.3,.12,'#e24354','megaphone handle');
}
function paintTools(parent,side){
  if(side<0){
    const brush=new THREE.Group();brush.name='paintbrush';brush.rotation.z=.15;parent.add(brush);
    tube(brush,[[0,-.12,.12],[0,.3,.12],[0,.6,.12]],.028,'#b17a3b');
    box(brush,0,.52,.12,.09,.13,.08,'#d9d9c5');
    ball(brush,0,.68,.12,.095,.16,.06,'#b75ab9','paintbrush bristles');
  }else{
    const palette=new THREE.Group();palette.name='paint palette';palette.position.set(.11,.08,.13);palette.rotation.z=-.28;parent.add(palette);
    ball(palette,0,0,0,.36,.23,.055,'#f2cd8f','wooden palette');
    for(const [i,color]of RAINBOW.entries()){
      const angle=i/7*Math.PI*1.6-.5;ball(palette,Math.cos(angle)*.25,Math.sin(angle)*.15,.052,.052,.045,.021,color,'paint dab');
    }
    ball(palette,-.06,-.04,.056,.052,.06,.009,'#ab773c','palette thumb hole');
  }
}
function splatter(parent,x,y,color,rotation=0){
  const mark=new THREE.Group();mark.name='colorful paint splash';mark.position.set(x,y,.514);mark.rotation.z=rotation;parent.add(mark);
  ball(mark,0,0,0,.085,.1,.013,color);
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5+.3,r=.075+(i%2)*.025;
    ball(mark,Math.cos(a)*r,Math.sin(a)*r,.004,.025+i%2*.009,.04,.012,color);
  }
  ball(mark,.14,.1,.001,.018,.02,.01,color);
}
function topHat(parent,top){
  const hat=new THREE.Group();hat.name='purple top hat';hat.position.set(-.66,top+.09,0);hat.rotation.z=.26;parent.add(hat);
  const brim=mesh(new THREE.CylinderGeometry(.52,.52,.09,28),'#734568','hat brim');hat.add(brim);
  const crown=mesh(new THREE.CylinderGeometry(.35,.38,.8,28),'#845678','hat crown');crown.position.y=.43;hat.add(crown);
  const ribbon=mesh(new THREE.CylinderGeometry(.382,.387,.14,28),'#efb437','gold hat band');ribbon.position.y=.14;hat.add(ribbon);
}
function bowTie(parent){
  const bow=new THREE.Group();bow.name='white bow tie';bow.position.set(0,FEET+.37,.64);parent.add(bow);
  for(const side of[-1,1]){
    const outline=[[side*.04,.02],[side*.24,.19],[side*.37,.16],[side*.39,-.08],[side*.24,-.18],[side*.04,-.03]];
    polygon(bow,outline,.07,'#fffbed',0,0,0);
    tube(bow,outline.map(([x,y])=>[x,y,.08]),.018,'#514b55',true);
  }
  ball(bow,0,0,.09,.115,.14,.06,'#fffbed','bow knot');
}
function cane(parent){
  const prop=new THREE.Group();prop.name='golden cane';prop.position.set(-.03,0,.08);parent.add(prop);
  tube(prop,[[0,.19,0],[-.09,.3,0],[-.22,.25,0],[-.25,.09,0],[-.25,-.42,0]],.034,'#bb812d');
  ball(prop,-.25,-.43,0,.045,.06,.045,'#343b39','cane tip');
}

function cylinder(parent, x, y, z, radius, length, color, name, axis = 'y') {
  const object = mesh(new THREE.CylinderGeometry(radius, radius, length, 24), color, name);
  object.position.set(x, y, z);
  if (axis === 'x') object.rotation.z = Math.PI / 2;
  if (axis === 'z') object.rotation.x = Math.PI / 2;
  parent.add(object);
  return object;
}
function roundedPackBox(parent, x, y, z, width, height, depth, color, name) {
  const bevel = Math.min(.13, depth / 4), w = width / 2 - bevel, h = height / 2 - bevel;
  const shape = new THREE.Shape();
  shape.moveTo(-w, -h); shape.lineTo(w, -h); shape.lineTo(w, h); shape.lineTo(-w, h); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {depth: depth - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3});
  geometry.translate(0, 0, -depth / 2 + bevel);
  const object = mesh(geometry, color, name); object.position.set(x, y, z); parent.add(object);
  return object;
}
function backpack(parent) {
  const pack = new THREE.Group(); pack.name = 'explorer backpack'; parent.add(pack);
  pack.userData.collisionAccessory = true;
  roundedPackBox(pack, 0, 3.8, -1.08, 2.48, 4.66, 1.12, '#7c8951', 'olive backpack body');
  roundedPackBox(pack, 0, 5.2, -1.66, 2.3, 1.28, .16, '#9aa569', 'backpack flap');
  tube(pack, [[-1.08,4.84,-1.76],[0,4.65,-1.76],[1.08,4.84,-1.76]], .028, '#576440', false, 'flap stitched edge');
  for (const side of [-1, 1]) {
    roundedPackBox(pack, side * 1.31, 3.6, -1.03, .32, 1.7, .92, '#899658', 'backpack side pocket');
    roundedPackBox(pack, side * 1.31, 4.35, -1.04, .37, .31, .96, '#a5ad70', 'side pocket flap');
    roundedPackBox(pack, side * .59, 2.25, -1.7, .98, 1.18, .3, '#a0aa6c', 'backpack lower pocket');
    roundedPackBox(pack, side * .59, 2.71, -1.86, 1.01, .28, .1, '#b0b77b', 'lower pocket flap');
    ball(pack, side * .59, 2.58, -1.94, .065, .065, .025, '#667141', 'pocket button');
    // Broad shoulder loops wrap over the cube body and remain visible from
    // the front, side and back, rather than being painted on the pack.
    tube(pack, [[side*1.06,2.2,-.64],[side*1.39,2.5,-.17],[side*1.42,4.7,.49],[side*1.4,6.85,.53],[side*1.12,7.27,.12],[side*.94,6.7,-.93]], .09, '#7b3f29', false, 'backpack shoulder strap');
    tube(pack, [[side*.76,6.93,-1.06],[side*.76,6.56,-1.68],[side*.76,5.8,-1.78],[side*.76,3.48,-1.95],[side*.76,2.87,-1.84]], .065, '#514e31', false, 'backpack securing strap');
    const buckle = rectangleRing(pack, side*.76, 5.13, -1.86, .22, .31, .035, '#d2bc71');
    buckle.name = 'brass backpack buckle';
    box(pack, side*.76,5.13,-1.87,.2,.035,.055,'#d2bc71','buckle tongue');
  }
  // Both rolls are genuine cylinders oriented across the shoulders. Their
  // end faces and spiral stitching are visible when the friend turns.
  cylinder(pack,0,6.35,-1.08,.56,2.8,'#9ca76e','green top roll','x');
  for(const side of[-1,1]){
    cylinder(pack,side*1.43,6.35,-1.08,.54,.09,'#b73e3e','red roll end cap','x');
    const seam=mesh(new THREE.TorusGeometry(.49,.035,8,24),'#8d3031','red roll cap rim');
    seam.rotation.y=Math.PI/2;seam.position.set(side*1.48,6.35,-1.08);pack.add(seam);
  }
  cylinder(pack,0,3.42,-1.63,.4,2.74,'#ead79d','cream sleeping mat','x');
  for(const side of[-1,1]){
    cylinder(pack,side*1.38,3.42,-1.63,.385,.045,'#f5e6b5','sleeping mat end','x');
    const spiral=Array.from({length:65},(_,i)=>{const t=i/64,a=t*Math.PI*5,r=.034+.31*t;return[side*1.41,3.42+Math.cos(a)*r,-1.63+Math.sin(a)*r];});
    tube(pack,spiral,.016,'#b19b61',false,'sleeping mat spiral');
    const belt=mesh(new THREE.TorusGeometry(.414,.045,8,24),'#565333','sleeping mat strap');
    belt.rotation.y=Math.PI/2;belt.position.set(side*.79,3.42,-1.63);pack.add(belt);
    const buckle=rectangleRing(pack,side*.79,3.43,-2.07,.18,.2,.028,'#c8b271');buckle.name='bedroll buckle';
  }
  tube(pack,[[-.35,6.12,-.66],[-.31,6.48,-.65],[.31,6.48,-.65],[.35,6.12,-.66]],.055,'#4e5635',false,'backpack carry handle');
}
function explorerHat(parent, top) {
  const hat=new THREE.Group();hat.name='green explorer hat';hat.position.set(0,top+.05,0);hat.rotation.z=-.06;parent.add(hat);
  const brim=cylinder(hat,0,0,0,.94,.1,'#285c30','explorer hat brim');brim.scale.z=.72;
  const crown=mesh(new THREE.CylinderGeometry(.51,.61,.49,24),'#38723d','explorer hat crown');crown.position.y=.27;hat.add(crown);
  const band=mesh(new THREE.CylinderGeometry(.59,.61,.12,24),'#183e24','dark green hat band');band.position.y=.12;hat.add(band);
  box(hat,-.32,.13,.51,.16,.13,.045,'#d6c367','hat buckle');
  for(const [index,color]of['#df347d','#35afd6','#a7cd38'].entries()){
    const feather=ball(hat,.49+index*.055,.54+index*.055,.015,.07,.31,.024,color,'rainbow hat feather');feather.rotation.z=-.24-index*.12;
    tube(hat,[[.45,.2,.04],[.5+index*.055,.58+index*.055,.04],[.57+index*.07,.82+index*.055,.04]],.012,'#f6e4ab',false,'feather quill');
  }
}
function hikingStaff(parent) {
  const staff=new THREE.Group();staff.name='hiking staff';staff.position.set(.04,0,.07);parent.add(staff);
  tube(staff,[[0,.38,0],[.075,.43,0],[.11,.3,0],[.08,-3.87,0]],.044,'#bb3d34',false,'red hiking pole');
  cylinder(staff,.08,-3.84,0,.063,.19,'#26383a','hiking staff rubber tip');
  tube(staff,[[-.06,.23,.02],[-.18,.16,.03],[-.17,-.07,.03],[.01,-.14,.02]],.025,'#4a4732',false,'hiking wrist loop');
}
function celestialStaff(parent, sun) {
  const staff=new THREE.Group();staff.name=sun?'sun staff':'moon staff';parent.add(staff);
  const height=4.21, color=sun?'#b4a43b':'#364b83';
  cylinder(staff,0,height/2-.52,0,.037,height+1.04,color,'celestial staff shaft');
  ball(staff,0,height-.03,0,.11,.14,.1,color,'staff finial');
  const emblem=new THREE.Group();emblem.position.y=height+.54;emblem.name=sun?'golden sun':'starry crescent moon';staff.add(emblem);
  if(sun){
    star(emblem,0,0,-.07,.79,.5,'#b89a34',16);
    cylinder(emblem,0,0,0,.49,.16,'#f4dc56','sun face','z');
    ring(emblem,0,0,.09,.48,.48,.03,'#ae9633');
  }else{
    const crescent=new THREE.Shape();
    crescent.moveTo(.22,.58);crescent.bezierCurveTo(-.69,.75,-.94,-.67,.12,-.64);
    crescent.bezierCurveTo(-.34,-.38,-.41,.26,.22,.58);
    const object=mesh(new THREE.ExtrudeGeometry(crescent,{depth:.12,bevelEnabled:false}),'#fcf6d4','cream crescent rim');object.position.z=-.06;emblem.add(object);
    cylinder(emblem,-.08,-.025,-.025,.6,.11,'#263d76','night sky disc','z');
    object.position.z=.06;
    for(const[x,y,s]of[[-.31,.32,.055],[-.42,.1,.037],[-.24,-.08,.045],[-.32,-.32,.032],[.02,.38,.028],[.02,-.36,.036]])star(emblem,x,y,.135,s,s*.35,'#fffae3');
  }
}

function faceLayout(data) {
  const n = data.number, top = data.height + FEET;
  const result = { x: 0, eyeY: top - .37, mouthY: top - .76, gap: .235, size: .17, mouth: .52 };
  if (n === 1) Object.assign(result, { gap: 0, size: .25, mouth: .44, mouthY: top - .75 });
  if (n === 6) Object.assign(result, { eyeY: top - 1.02, mouthY: top - 1.88, gap: .9, size: .21, mouth: .8 });
  if (n === 7) Object.assign(result, { eyeY: top - .31, mouthY: top - .73 });
  if (n === 8) Object.assign(result, { eyeY: top - .59, mouthY: top - 1.25, gap: .46, size: .26, mouth: .87 });
  if (n === 9) Object.assign(result, { eyeY: top - 1.08, mouthY: top - 2.14, gap: .62, size: .31, mouth: 1.1 });
  if (n === 10) Object.assign(result, { eyeY: top - .6, mouthY: top - 1.29, gap: .49, size: .255, mouth: .89 });
  if (n === 11) Object.assign(result, { eyeY: FEET + .71, mouthY: FEET + .24, gap: .43, size: .24, mouth: .58 });
  if (n === 12) Object.assign(result, { eyeY: FEET + 1.48, mouthY: FEET + .78, gap: .42, size: .29, mouth: .75 });
  if (n === 13) Object.assign(result, { x: -.5, eyeY: FEET + .72, mouthY: FEET + .2, gap: .35, size: .23, mouth: .62 });
  if (n === 14) Object.assign(result, { eyeY: FEET + 1.02, mouthY: FEET + .43, gap: .42, size: .265, mouth: .79 });
  if (n === 15) Object.assign(result, { x: 1.5, eyeY: FEET + .73, mouthY: FEET + .22, gap: .3, size: .225, mouth: .58 });
  if (n === 16) Object.assign(result, { eyeY: FEET + 1.52, mouthY: FEET + .52, gap: .53, size: .31, mouth: .95 });
  if (n === 17) Object.assign(result, { eyeY: FEET + 1.32, mouthY: FEET + .72, gap: .43, size: .27, mouth: .68 });
  if (n === 18) Object.assign(result, { x: -.5, eyeY: FEET + 1.52, mouthY: FEET + .59, gap: .45, size: .29, mouth: .78 });
  if (n === 19) Object.assign(result, { eyeY: FEET + 1.32, mouthY: FEET + .64, gap: .48, size: .3, mouth: .61 });
  if (n === 20) Object.assign(result, { eyeY: FEET + 1.83, mouthY: FEET + 1.18, gap: .46, size: .29, mouth: .65 });
  if (n === 21) Object.assign(result, { eyeY: FEET + 5.52, mouthY: FEET + 4.83, gap: .43, size: .31, mouth: .78 });
  if (n === 22) Object.assign(result, { x: -.17, eyeY: FEET + 1.18, mouthY: FEET + .53, gap: .45, size: .3, mouth: .62 });
  if (n === 23) Object.assign(result, { x: .62, eyeY: FEET + 1.69, mouthY: FEET + 1.15, gap: .3, size: .215, mouth: .55 });
  if (n === 24) Object.assign(result, { eyeY: FEET + 4.49, mouthY: FEET + 3.77, gap: .34, size: .26, mouth: .7 });
  if (n === 25) Object.assign(result, { eyeY: FEET + 1.6, mouthY: FEET + .78, gap: .65, size: .34, mouth: 1.02 });
  return result;
}
export function getCharacterFaceLayout(number){return {...faceLayout(getCharacterDefinition(number))};}
function eyeDecorations(parent, data, f) {
  const n = data.number;
  const positions = n === 1 ? [f.x] : [f.x - f.gap, f.x + f.gap];
  for (let index = 0; index < positions.length; index++) {
    const x = positions[index];
    if ([1, 2, 6, 11, 13, 14, 15].includes(n)) {
      const color = { 1: '#b52e36', 2: '#8c3a96', 6: '#e73480', 11: '#bb3b4d', 13: '#793c7d', 14: '#397927', 15: '#213f79' }[n];
      ring(parent, x, f.eyeY, Z + .015, f.size * 1.12, f.size * 1.2, n === 15 ? .052 : .038, color);
    }
    if (n === 5 && index === 0) star(parent, x, f.eyeY, .515, .36, .21, '#176eaa');
    if (n === 7) rectangleRing(parent, x, f.eyeY, Z + .03, .44, .4, .035, '#f4dd31');
    if (n === 8) {
      star(parent, x, f.eyeY, .513, .47, .29, '#653827', 8, .1);
      ball(parent, x, f.eyeY, .55, .33, .33, .055, '#955d41');
    }
    if (n === 9 || n === 12) rectangleRing(parent, x, f.eyeY, Z + .02, f.size * 2.45, f.size * (n === 12 ? 2.9 : 2.5), n === 9 ? .075 : .055, n === 9 ? '#3d5461' : '#be394e');
    if (n === 10) star(parent, x, f.eyeY, .515, .48, .28, '#e7334b');
    if (n === 16 || n === 18) rectangleRing(parent,x,f.eyeY,Z+.035,n===16?.88:.84,n===16?.83:.99,n===16?.075:.06,n===16?'#512483':'#713066');
    if (n === 17 || n === 19 || n === 20) ring(parent,x,f.eyeY,Z+.03,f.size*1.2,f.size*(n===20?1.42:1.21),n===19?.064:.052,n===19?'#41494c':n===20?'#8f478e':'#6b3195');
    if(n===21){
      const side=index?1:-1;
      polygon(parent,[[side*-.07,-.2],[side*.37,-.14],[side*.53,.16],[side*.48,.35],[side*.58,.79],[side*.22,.46],[0,.48],[side*-.24,.16]],.055,'#3f256e',x,f.eyeY,.509,'pointed purple explorer mask');
      ring(parent,x,f.eyeY,Z+.03,f.size*1.16,f.size*1.18,.05,'#3f256e');
    }
    if(n===22){
      const size=f.size*(index?.72:1);
      ring(parent,x,f.eyeY,Z+.03,size*1.16,size*1.2,.035,index?'#8a3141':'#255b85');
    }
    if(n===23)ring(parent,x,f.eyeY,Z+.025,f.size*1.18,f.size*1.18,.042,'#6d3289');
    if(n===24||n===25)rectangleRing(parent,x,f.eyeY,Z+.04,n===24?.61:.94,n===24?.94:.89,.055,n===24?'#315b94':'#28608a');
    if (n === 16) {
      const side=index?1:-1;
      box(parent,x+side*.34,f.eyeY+.12,.6,.10,.49,.09,'#242231','bold square eyelash');
      box(parent,x+side*.27,f.eyeY+.35,.6,.24,.09,.09,'#242231','bold square eyelash');
    }
    if ([6, 11, 12, 15, 24, 25].includes(n)) {
      const side = index ? 1 : -1;
      const color = n === 6 ? '#ee377d' : '#263342';
      for (let lash = 0; lash < (n === 6 ? 3 : 2); lash++) {
        const ex = x + side * (f.size * .8 + lash * .05);
        tube(parent, [[ex, f.eyeY + f.size * .45, .585], [ex + side * .09, f.eyeY + f.size * .65 + lash * .04, .59], [ex + side * .105, f.eyeY + f.size * 1.06 + lash * .035, .58]], .028, color);
      }
    }
  }
  if (n === 2 || n === 7 || n === 15) tube(parent, [[f.x - .07, f.eyeY, .59], [f.x, f.eyeY + .06, .6], [f.x + .07, f.eyeY, .59]], .027, n === 2 ? '#8c3a96' : n === 7 ? '#f4dd31' : '#213f79');
  if([16,17,18,19,20].includes(n))tube(parent,[[f.x-.10,f.eyeY+.02,.61],[f.x,f.eyeY+.07,.64],[f.x+.10,f.eyeY+.02,.61]],.035,n===19?'#41494c':data.dark);
  if([21,23,24,25].includes(n))tube(parent,[[f.x-.13,f.eyeY+.03,.61],[f.x,f.eyeY+.08,.64],[f.x+.13,f.eyeY+.03,.61]],.034,[21,23].includes(n)?'#5c2b83':'#315b94');
  if(n===20)for(const side of[-1,1])box(parent,side*.95,f.eyeY,.04,.09,.18,1.18,'#8f478e','purple spectacle temple');
  if (n === 15) {
    for (const side of [-1, 1]) polygon(parent, [[0, 0], [side * .65, .05], [side * .65, .85], [side * .51, .85], [side * .51, .69], [side * .38, .69], [side * .38, .54], [side * .25, .54], [side * .25, .39], [side * .12, .39], [side * .12, .23]], .055, '#244583', f.x, f.eyeY + .04, .505, 'stepped superhero mask');
  }
}
function eye(parent, x, y, size, emotion, color) {
  if (emotion === 'excited') {
    tube(parent, [[x - size * .78, y, .68], [x, y + size * .5, .7], [x + size * .78, y, .68]], .032, '#253844');
    return;
  }
  const wide = emotion === 'surprised' ? 1.09 : 1;
  ball(parent, x, y, .595, size * wide, size * 1.08 * wide, .08, '#fffef8', 'eye white');
  const pupilScale = emotion === 'surprised' ? .68 : 1;
  const glance = emotion === 'curious' ? size * .25 : size * .08;
  ball(parent, x + glance, y - .015, .669, size * .53 * pupilScale, size * .68 * pupilScale, .035, '#24333f', 'pupil');
  ball(parent, x - size * .12 + glance, y + size * .22, .7, size * .18, size * .2, .018, '#ffffff', 'eye glint');
  if (emotion === 'sleepy') {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, size * 1.04, 0, Math.PI, false); shape.closePath();
    const lid = mesh(new THREE.ExtrudeGeometry(shape, { depth: .025, bevelEnabled: false }), color, 'sleepy eyelid');
    lid.position.set(x, y + .005, .71); parent.add(lid);
    tube(parent, [[x - size, y, .74], [x, y - .025, .75], [x + size, y, .74]], .022, '#344956');
  }
}
function mouth(parent, x, y, width, emotion, number) {
  const lip = number === 6 || number === 10 || number === 15 ? '#d7318b' : number === 7 ? '#f2d529' : number === 13 ? '#793c7d' : number === 14 ? '#36802b' : number===16?'#46215f':number===17?'#7431a3':number===18?'#8b256f':number===19?'#4b5251':number===20?'#9b4b88':number===23?'#8c4688':number===24?'#226d42':number===25?'#246e8c':'#713549';
  if(number===25&&emotion==='happy'){
    tube(parent,[[x-width*.34,y+.05,.62],[x,y-width*.16,.64],[x+width*.34,y+.05,.62]],.026,lip,false,'gentle blue smile');
    return;
  }
  if (emotion === 'surprised' || emotion === 'sleepy') {
    const scale = emotion === 'sleepy' ? .65 : 1;
    ball(parent, x, y, .585, width * .17 * scale, width * .22 * scale, .04, lip, 'round mouth rim');
    ball(parent, x, y, .624, width * .115 * scale, width * .165 * scale, .018, '#4d2d3b', 'round mouth');
    return;
  }
  if (emotion === 'sad' || emotion === 'curious') {
    const sad = emotion === 'sad';
    tube(parent, [[x - width * .28, y - .035, .6], [x, y + (sad ? width * .13 : -width * .08), .63], [x + width * .28, y + (sad ? -.035 : width * .08), .6]], .027, lip);
    return;
  }
  const h = width * (emotion === 'excited' ? .43 : .28);
  const shape = new THREE.Shape();
  shape.moveTo(-width * .34, .05);
  shape.quadraticCurveTo(0, -.04, width * .34, .065);
  shape.quadraticCurveTo(width * .23, -h, 0, -h);
  shape.quadraticCurveTo(-width * .26, -h * .9, -width * .34, .05);
  const inner = mesh(new THREE.ExtrudeGeometry(shape, { depth: .03, bevelEnabled: false }), '#51303e', 'smiling mouth');
  inner.position.set(x, y, .58); parent.add(inner);
  tube(parent, [[x - width * .34, y + .05, .62], [x, y - h, .62], [x + width * .34, y + .065, .62]], .028, lip);
  tube(parent, [[x - width * .26, y + .026, .628], [x, y - .011, .636], [x + width * .26, y + .039, .628]], .027, '#fffaf0');
  ball(parent, x + width * .045, y - h * .83, .619, width * .15, h * .15, .012, '#f37d9c', 'tongue');
}
function expression(data, f, emotion) {
  const group = new THREE.Group(); group.name = `expression ${emotion}`;
  const positions = data.number === 1 ? [f.x] : [f.x - f.gap, f.x + f.gap];
  for (let i = 0; i < positions.length; i++) {
    const x = positions[i], side = positions.length === 1 ? 0 : i ? 1 : -1;
    const eyelidColor=data.number===8?'#955d41':data.number===16?'#7541c2':data.number===19&&i===1?'#b4bcba':data.number===20?'#e8b76b':data.number===21?'#3f256e':data.number===23?'#edcd40':data.number===24?'#77c627':data.number>=22?'#ffd58b':data.number>=10?'#fffaf1':data.color;
    eye(group, x, f.eyeY, f.size*(data.number===22&&i===1?.72:1), emotion, eyelidColor);
    if (emotion === 'happy' && ![4, 9, 12, 13, 14,18,19,20,23,24,25].includes(data.number)) continue;
    const y = f.eyeY + f.size * (emotion === 'surprised' ? 1.65 : 1.4);
    const tilt = emotion === 'sad' ? side * f.size * .45 : emotion === 'curious' ? f.size * .3 : 0;
    const lift = emotion === 'curious' && i === 1 ? f.size * .4 : 0;
    const points = [[x - f.size * .83, y + tilt + lift, .635], [x, y + f.size * .12 + lift, .65], [x + f.size * .83, y - tilt + lift, .635]];
    if (data.number === 14) {
      const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
      for (let j = 0; j < 7; j++) {
        const interval = [j / 7, (j + .5) / 7, (j + 1) / 7].map(t => curve.getPoint(t).toArray());
        tube(group, interval, .065, RAINBOW[i ? 6 - j : j]);
      }
    } else if(data.number===25){
      const crown=polygon(group,[[-.45,0],[-.51,.35],[-.29,.2],[-.24,.55],[-.08,.26],[.07,.62],[.16,.24],[.36,.48],[.31,.13],[.51,.23],[.43,-.02]],.045,'#285e85',x,y+lift,.53,'blue crown eyebrow');
      crown.rotation.z=emotion==='sad'?side*.22:emotion==='curious'?(i?.17:-.08):0;
    } else if(data.number===19){
      tube(group,[[x-f.size*.95,y+tilt,.64],[x-f.size*.48,y+.12+lift,.65],[x+f.size*.15,y+.015+lift,.65],[x+f.size*.8,y+.17-tilt,.64]],.049,'#485052',false,'zigzag eyebrow');
    } else tube(group, points, [4,9,18,20,23,24].includes(data.number) ? .055 : .034, data.number===23?'#633287':data.number >= 11 ? data.dark : '#344d56');
  }
  mouth(group, f.x + (data.number === 11 ? .24 : 0), f.mouthY, f.mouth, emotion, data.number);
  return group;
}

const DIGITS = {
  0: [[[.12, 0], [0, .12], [-.02, .44], [.1, .6], [.27, .52], [.3, .18], [.2, 0], [.12, 0]]],
  1: [[[.05, .45], [.16, .6], [.16, 0]]],
  2: [[[0, .46], [.1, .6], [.28, .51], [.26, .35], [.02, .04], [.3, .04]]],
  3: [[[0, .54], [.18, .59], [.29, .47], [.18, .32], [.29, .18], [.2, .02], [0, .05]]],
  4: [[[.22, 0], [.22, .6]], [[.2, .59], [-.01, .22], [.33, .22]]],
  5: [[[.3, .58], [.03, .58], [.02, .33], [.2, .33], [.3, .19], [.22, .03], [0, .04]]],
  6: [[[.27, .58], [.11, .55], [.01, .32], [.02, .1], [.15, 0], [.29, .12], [.24, .3], [.02, .29]]],
  7: [[[0, .58], [.32, .58], [.12, 0]]],
  8: [[[.14, .3], [.02, .43], [.08, .58], [.23, .58], [.3, .43], [.14, .3], [0, .15], [.09, 0], [.24, .02], [.31, .17], [.14, .3]]],
  9: [[[.28, .31], [.08, .31], [0, .44], [.08, .59], [.24, .56], [.3, .38], [.2, .04], [.05, 0]]],
};
function numberPlaque(root, data) {
  const label = new THREE.Group(); label.name = `number ${data.number}`;
  const extra = data.number === 7 ? .6 : data.number === 21 ? .72 : data.number === 3 || data.number === 14 ? .46 : 0;
  label.position.set(data.number===20?.55:0, data.height + FEET + (data.number===20?.54:.47) + extra, .03);
  const digits = String(data.number), width = digits.length === 2 ? .65 : .43;
  ball(label, 0, 0, 0, width, .43, .055, '#fffcf1', 'number plaque');
  for (let i = 0; i < digits.length; i++) {
    const offset = (i - (digits.length - 1) / 2) * .43 - .145;
    for (const stroke of DIGITS[digits[i]]) tube(label, stroke.map(([x, y]) => [x + offset, y - .29, .07]), .027, '#263c46');
  }
  root.add(label);
}
function decorations(root, data) {
  const n = data.number, top = data.height + FEET;
  if (n === 3) {
    polygon(root, [[-.46, 0], [-.49, .33], [-.24, .15], [0, .45], [.24, .15], [.49, .33], [.46, 0]], .75, '#e64c43', 0, top, -.36, 'three-point crown');
    for (const [x, y] of [[-.49, .33], [0, .45], [.49, .33]]) ball(root, x, top + y, .025, .06, .06, .06, '#ffdf51');
    for (let i = 0; i < 3; i++) ball(root, 0, top - 1.18 - i * .36, .535, .09, .12, .06, '#d8463b', 'red button');
  }
  if (n === 6) {
    for (const cell of data.cells) ball(root, cell.x + .5 - data.width / 2, cell.y + .5 + FEET, .516, .18, .18, .024, '#c1edf1', 'six spot');
  }
  if (n === 7) {
    for (let i = 0; i < 7; i++) {
      const spike = box(root, (i - 3) * .12, top + .22, 0, .115, .53 - Math.abs(i - 3) * .03, .22, RAINBOW[i], 'rainbow hair');
      spike.rotation.z = -(i - 3) * .13;
    }
  }
  if (n === 14) {
    const helmet = mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), '#397e0a', 'green helmet');
    helmet.position.set(0, top - .02, 0); helmet.scale.set(1.08, .45, .64); root.add(helmet);
    box(root, 0, top + .015, .57, 2.08, .12, .1, '#245d0d', 'helmet brim');
    for (const side of [-1, 1]) {
      ball(root, side * 1.015, top - .08, 0, .1, .29, .51, '#306c0d');
      ball(root, side * .39, top + .22, .56, .065, .035, .016, '#1a490b', 'helmet vent');
    }
    const prop = new THREE.Group(); prop.position.set(1.6, 1.15, .15); skateboard(prop); root.add(prop);
  }
  if(n===17){
    for(const [x,y,color,rotation]of[
      [-.57,4.77,'#39c8d6',.3],[.52,4.44,'#f5d533',-.4],[.39,3.78,'#a24fe0',.5],
      [.54,2.8,'#e94758',-.2],[.61,2.42,'#62c43b',.5],[-.58,2.45,'#b96ade',-.3],[-.55,.71,'#ef9b30',.4],
    ])splatter(root,x,y,color,rotation);
  }
  if(n===18)for(const side of[-1,1])box(root,side*.55,.30,0,.29,.14,.29,'#c43883','magenta boot cuff');
  if(n===20){topHat(root,top);bowTie(root);}
  if(n===21){backpack(root);explorerHat(root,top);}
}

/** Build true unit-cube geometry. Front is +Z; root y=0 is the shoe sole.
 * Calling update never changes root position/rotation: the game owns movement.
 * Expressions and labels use prebuilt meshes, with no DOM or canvas dependency.
 */
export function createCharacter(number) {
  const data = getCharacterDefinition(number);
  const metrics = getCharacterMetrics(data.number);
  const root = new THREE.Group(); root.name = `${data.name} character`;
  root.userData.number = data.number;
  root.userData.visualHeight = data.height + 1.25 + (data.number === 7 ? .6 : data.number===21?.72:data.number===24?.45:data.number === 3 || data.number === 14 ? .46 : data.number===20?.2:0);
  const body = new THREE.Group(); body.name = 'unit block body'; root.add(body);
  for (const cell of data.cells) {
    const cube = mesh(CUBE, cell.color, `${data.name} block ${cell.x},${cell.y}`);
    cube.position.set(cell.x + .5 - data.width / 2, cell.y + .5 + FEET, 0);
    cube.userData.unitBlock = true;
    cube.userData.cell = { x: cell.x, y: cell.y };
    body.add(cube);
  }
  outlineBody(body, data);
  const feet = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    const fx = data.number === 15 ? 1.5 + side * .3 : data.number===23?-.5+side*.32:side * Math.min(.65, data.width * .26);
    pivot.position.set(fx, .38, 0); root.add(pivot); feet.push(pivot);
    const footColor = data.number === 15 ? side < 0 ? '#f8efe8' : '#40c9de' : data.number===19?side<0?'#343d3e':'#727c7a':data.number===20?'#242b2d':data.number===21?side<0?'#d6b46a':'#c82d28':data.number===22?side<0?'#285f91':'#af342e':data.dark;
    const legColor=data.number===20?'#d58a2f':data.number===21?side<0?'#d6b46a':'#c82d28':data.number===22?side<0?'#285f91':'#af342e':data.number===24?'#64ac25':data.dark;
    tube(pivot, [[0, .03, 0], [0, -.13, 0], [0, -.22, .04]], .075, legColor);
    ball(pivot, side * .015, -.24, .1, data.number === 8 ? .32 : .205, .14, .3, footColor, 'walking shoe');
    if (data.number === 11 || data.number === 15) box(pivot, 0, -.2, .345, .26, .065, .025, data.number === 11 ? '#fffdf5' : side < 0 ? '#cc3548' : '#188ab0', 'shoe stripe');
    if(data.number===20)box(pivot,0,-.12,.18,.27,.12,.27,'#fffbed','white spats');
    if(data.number===21&&side<0)for(const y of[-.14,-.21,-.28])box(pivot,0,y,.365,.25,.026,.035,'#fff0c5','hiking boot lace');
    if(data.number===22)for(const y of[-.14,-.25])box(pivot,0,y,.363,.27,.035,.025,'#fff0d2','striped trainer');
  }
  const arms = [];
  const lowFace = data.number >= 11;
  const armY = ({21:4.5,22:1.3,23:1.12,24:3.9,25:1.55})[data.number] ?? (lowFace ? (data.number === 12 ? 1.02 : 1.0) : data.height + FEET - (data.number === 6 ? 1.12 : data.number === 9 ? 1.5 : data.number === 10 ? 1.6 : .8));
  for (const side of [-1, 1]) {
    const count = data.number === 8 ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const pivot = new THREE.Group();
      pivot.position.set(side * (data.number===17?1:data.width/2), data.number === 8 ? data.height + FEET - 1.28 - i : armY, 0);
      root.add(pivot);
      const lifted = data.number === 6 && side < 0 || [7, 10].includes(data.number) && side > 0 || [16,22,25].includes(data.number);
      const limbColor=data.number===19?(side<0?'#414a4c':'#9ba3a1'):data.number===20?'#dd8c2c':data.number===22?(side<0?'#285f91':'#af342e'):data.dark;
      const handY = data.number===24?-.05:lifted ? .48 : data.number === 8 ? .33 : data.number === 1 ? -.32 : -.49;
      const handX = side * (data.number === 8 ? .88 : data.number===24?.68:data.number===25?.55:.39);
      const points = data.number === 8
        ? [[0, 0, 0], [side * .44, -.25, .05], [side * .84, -.14, .07], [handX, handY, .06]]
        : [[0, 0, 0], [side * .3, data.number===24?-.07:lifted ? -.05 : -.18, .03], [handX, handY, .055]];
      const arm = tube(pivot, points, data.number === 8 ? .09 : .085, limbColor, false, data.number === 8 ? 'tentacle' : 'arm');
      if (data.number === 8) {
        const curve = arm.geometry.parameters.path;
        for (const t of [.26, .44, .62, .8, .97]) {
          const p = curve.getPoint(t); ball(pivot, p.x, p.y, p.z + .072, .053, .06, .025, '#ffa6be', 'tentacle spot');
        }
      } else {
        const hand = new THREE.Group(); hand.position.set(handX, handY, .055); pivot.add(hand);
        if (data.number === 5 && side > 0 || data.number === 10 || data.number===20) {
          hand.rotation.z = side * -.25; glove(hand, data.number === 10 || data.number===20 ? '#fffaf1' : data.dark, data.number === 10);
        } else ball(hand, 0, 0, 0, .105, .14, .1, limbColor, 'hand');
        if (data.number === 11 && side < 0) { const prop = new THREE.Group(); prop.position.set(-.04, .25, .2); soccerBall(prop); hand.add(prop); }
        if (data.number === 12 && side > 0) box(hand, -.07, -.035, .01, .065, .22, .2, '#fff6d9', 'wrist band');
        if(data.number===16&&side<0)megaphone(hand);
        if(data.number===17)paintTools(hand,side);
        if(data.number===18&&side>0)box(hand,-.05,.06,0,.16,.12,.23,'#f8f3e6','white wrist band');
        if(data.number===20&&side<0)cane(hand);
        if(data.number===21&&side>0)hikingStaff(hand);
        if(data.number===24)celestialStaff(hand,side<0);
      }
      arms.push({ pivot, side, phase: i * .9, tentacle: data.number === 8 });
    }
  }
  decorations(root, data);
  const face = faceLayout(data);
  root.userData.faceCenter={x:face.x,y:(face.eyeY+face.mouthY)/2,z:.65};
  eyeDecorations(root, data, face);
  const expressions = Object.fromEntries(MOODS.map(emotion => {
    const group = expression(data, face, emotion); group.visible = false; root.add(group); return [emotion, group];
  }));
  numberPlaque(root, data);
  let currentEmotion;
  let elapsed = 0;
  function setEmotion(emotion = 'happy') {
    const next = MOODS.includes(emotion) ? emotion : 'happy';
    if (next !== currentEmotion) {
      if (currentEmotion) expressions[currentEmotion].visible = false;
      expressions[next].visible = true;
      currentEmotion = next; root.userData.emotion = next;
    }
    return next;
  }
  function update(dt = 0, state = {}) {
    elapsed = Number.isFinite(state.time) ? state.time : elapsed + (Number.isFinite(dt) ? dt : 0);
    if (state.emotion !== undefined) setEmotion(state.emotion);
    const moving = Boolean(state.moving), stride = Math.sin(elapsed * 10);
    feet.forEach((foot, index) => {
      const side = index ? 1 : -1;
      foot.rotation.x = moving ? stride * side * .38 : 0;
      foot.position.y = .38 + (moving ? Math.max(0, stride * side) * .08 : 0);
    });
    for (const { pivot, side, phase, tentacle } of arms) {
      pivot.rotation.x = moving ? -stride * side * .3 : Math.sin(elapsed * 1.6 + phase) * .045;
      pivot.rotation.z = tentacle ? Math.sin(elapsed * 2.6 + phase + side) * .09 : Math.sin(elapsed * 1.7 + side) * (moving ? .09 : .035);
    }
  }
  setEmotion('happy');
  return { root, body, setEmotion, update, height: metrics.height, width: metrics.width, radius: metrics.radius };
}
