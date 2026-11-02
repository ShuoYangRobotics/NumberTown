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
const isTransformed = data => data.transformed === true || Boolean(data.formId && data.formId !== 'original');
const bodyDepth = data => data.depth ?? Math.max(...data.cells.map(cell => cell.z ?? 0)) + 1;

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
      const cz=(cell.z??0)-(bodyDepth(data)-1)/2;
      const a = [EDGES[i] + cell.x + .5, EDGES[i + 1] + cell.y + .5, EDGES[i + 2] * 1.032+cz];
      const b = [EDGES[i + 3] + cell.x + .5, EDGES[i + 4] + cell.y + .5, EDGES[i + 5] * 1.032+cz];
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
  const grid = mesh(geometry, data.number===50?'#478d98':data.number>=40?'#5da556':data.number>=31?'#b7a63f':'#b47a2e', 'raised golden unit grid');
  grid.castShadow = false; body.add(grid);
}
function outlineBody(body, data) {
  const grouped = new Map();
  for (const cell of data.cells) {
    const color = cell.outline || '#36515a';
    if (!grouped.has(color)) grouped.set(color, []);
    const vertices = grouped.get(color);
    for (let index = 0; index < EDGES.length; index += 3) {
      vertices.push(EDGES[index] * 1.012 + cell.x + .5 - data.width / 2, EDGES[index + 1] * 1.012 + cell.y + .5 + FEET, EDGES[index + 2] * 1.012+(cell.z??0)-(bodyDepth(data)-1)/2);
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
  // The raised ten-frame traces a planar silhouette. Layered arrangements
  // already retain their per-cube red edges; a flattened silhouette would
  // cut through those layers or bridge empty space.
  if (framed.length && bodyDepth(data) === 1) {
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
  if (n === 26) Object.assign(result, { eyeY: FEET+3.34, mouthY: FEET+2.69, gap:.48, size:.30, mouth:.72 });
  if (n === 27) Object.assign(result, { eyeY: FEET+1.65, mouthY: FEET+1.04, gap:.36, size:.25, mouth:.72 });
  if (n === 28) Object.assign(result, { eyeY: FEET+2.59, mouthY: FEET+2.24, gap:.36, size:.19, mouth:.48 });
  if (n === 29) Object.assign(result, { eyeY: FEET+1.69, mouthY: FEET+.72, gap:.34, size:.24, mouth:.55 });
  if (n === 30) Object.assign(result, { eyeY: FEET+8.96, mouthY: FEET+8.26, gap:.48, size:.29, mouth:.91 });
  if (n === 31) Object.assign(result, { x:.5, eyeY:FEET+2.62, mouthY:FEET+2.02, gap:.39, size:.28, mouth:.76 });
  if (n === 32) Object.assign(result, { eyeY:FEET+3.55, mouthY:FEET+2.88, gap:.43, size:.30, mouth:.65 });
  if (n === 33) Object.assign(result, { x:-.18, eyeY:FEET+1.82, mouthY:FEET+1.13, gap:.43, size:.27, mouth:.82 });
  if (n === 34) Object.assign(result, { eyeY:FEET+1.75, mouthY:FEET+1.03, gap:.4, size:.31, mouth:.8 });
  if (n === 35) Object.assign(result, { eyeY:FEET+1.73, mouthY:FEET+1.12, gap:.35, size:.25, mouth:.7 });
  if (n === 36) Object.assign(result, { eyeY:FEET+2.55, mouthY:FEET+1.94, gap:.4, size:.27, mouth:.7 });
  if (n === 37) Object.assign(result, { eyeY:FEET+8.82, mouthY:FEET+8.17, gap:.43, size:.29, mouth:.86 });
  if (n === 38) Object.assign(result, { eyeY:FEET+1.48, mouthY:FEET+.77, gap:.42, size:.3, mouth:.86 });
  if (n === 39) Object.assign(result, { eyeY:FEET+8.45, mouthY:FEET+7.4, gap:.44, size:.30, mouth:.94 });
  if (n === 40) Object.assign(result, { eyeY:FEET+8.55, mouthY:FEET+7.77, gap:.52, size:.37, mouth:.97 });
  if (n === 41) Object.assign(result, { eyeY:FEET+7.55, mouthY:FEET+6.86, gap:.47, size:.34, mouth:.92 });
  if (n === 42) Object.assign(result, { eyeY:FEET+8.55, mouthY:FEET+7.67, gap:.47, size:.30, mouth:.82 });
  if (n === 43) Object.assign(result, { x:-.5, eyeY:FEET+1.55, mouthY:FEET+.91, gap:.4, size:.235, mouth:.76 });
  if (n === 44) Object.assign(result, { eyeY:FEET+1.85, mouthY:FEET+1.22, gap:.45, size:.30, mouth:.76 });
  if (n === 45) Object.assign(result, { x:1.7, eyeY:FEET+2.42, mouthY:FEET+1.76, gap:.40, size:.26, mouth:.7 });
  if (n === 46) Object.assign(result, { eyeY:FEET+7.67, mouthY:FEET+6.78, gap:.54, size:.41, mouth:1.02 });
  if (n === 47) Object.assign(result, { eyeY:FEET+7.12, mouthY:FEET+6.42, gap:.45, size:.31, mouth:.9 });
  if (n === 48) Object.assign(result, { eyeY:FEET+3.87, mouthY:FEET+2.97, gap:.55, size:.36, mouth:1.10 });
  if (n === 49) Object.assign(result, { eyeY:FEET+3.75, mouthY:FEET+2.94, gap:.55, size:.31, mouth:.87 });
  if (n === 50) Object.assign(result, { eyeY:FEET+7.48, mouthY:FEET+6.43, gap:.95, size:.35, mouth:1.14 });
  return result;
}
const faceTransforms = new WeakMap();
function frontCells(data) {
  const front = new Map();
  for (const cell of data.cells) {
    const key = `${cell.x},${cell.y}`, previous = front.get(key);
    if (!previous || (cell.z ?? 0) > (previous.z ?? 0)) front.set(key, cell);
  }
  return [...front.values()];
}
function topAttachment(data) {
  const top = Math.max(...data.cells.map(cell => cell.y));
  const cells = frontCells(data).filter(cell => cell.y === top);
  const chosen = cells.reduce((best, cell) => Math.abs(cell.x + .5 - data.width / 2) < Math.abs(best.x + .5 - data.width / 2) ? cell : best);
  const row = new Set(cells.filter(cell => (cell.z ?? 0) === (chosen.z ?? 0)).map(cell => cell.x));
  let left = chosen.x, right = chosen.x;
  while (row.has(left - 1)) left--; while (row.has(right + 1)) right++;
  return { x:(left + right + 1)/2-data.width/2, y:FEET+top+1, z:(chosen.z??0)-(bodyDepth(data)-1)/2, width:right-left+1, cell:chosen };
}
function faceTransform(data) {
  const original=getCharacterDefinition(data.number),source=faceLayout(original);
  if(!isTransformed(data))return{source,scale:1,x:0,y:0,z:(bodyDepth(data)-1)/2};
  if(faceTransforms.has(data))return faceTransforms.get(data);
  const halfWidth=Math.max(source.gap+Math.max(source.size*1.6,original.number===50?.73:.5),source.mouth*.6);
  const above=original.number===25?1.2:original.number===50?1.2:[40,42,48].includes(original.number)?1.1:[21,36,45].includes(original.number)?.98:source.size*1.9+.15;
  const lower=source.mouthY-source.mouth*.5-.07,upper=source.eyeY+above;
  const visible=frontCells(data),front=new Map(visible.map(cell=>[`${cell.x},${cell.y}`,cell.z??0]));
  let best=null;
  for(const cell of visible)for(let height=1;height<=3;height++)for(let width=1;width<=Math.min(4,data.width);width++){
    let filled=true;
    for(let y=cell.y;y<cell.y+height&&filled;y++)for(let x=cell.x;x<cell.x+width;x++)if(front.get(`${x},${y}`)!==(cell.z??0)){filled=false;break;}
    if(!filled)continue;
    const scale=Math.min(1,(width-.16)/(halfWidth*2),Math.min(2.5,height*.86)/(upper-lower));
    const halfX=halfWidth*scale,halfY=(upper-lower)*scale/2;
    const cx=Math.max(cell.x+halfX+.06,Math.min(cell.x+width-halfX-.06,data.width/2));
    const cy=Math.max(cell.y+halfY+.06,Math.min(cell.y+height-halfY-.06,data.height/3));
    const score=scale*4-Math.abs(cy-data.height/3)*.6-Math.abs(cx-data.width/2)*.22+(cell.z??0)*.025;
    if(!best||score>best.score)best={score,scale,cx,cy,patch:{x:cell.x,y:cell.y,z:cell.z??0,width,height}};
  }
  const {scale,cx,cy,patch}=best;
  const result={source,scale,x:cx-data.width/2-source.x*scale,y:FEET+cy-(upper+lower)/2*scale,
    z:patch.z-(bodyDepth(data)-1)/2+.5-.5*scale+.015,patch};
  const faceX=source.x*scale+result.x+data.width/2,faceY=(source.eyeY+source.mouthY)/2*scale+result.y-FEET;
  result.cell={x:Math.min(patch.x+patch.width-1,Math.max(patch.x,Math.floor(faceX))),y:Math.min(patch.y+patch.height-1,Math.max(patch.y,Math.floor(faceY))),z:patch.z};
  faceTransforms.set(data,result);return result;
}
function armAttachment(data, side, desiredY, face) {
  const occupied=new Set(data.cells.map(cell=>`${cell.x},${cell.y},${cell.z??0}`));
  const candidates=frontCells(data).filter(cell=>!occupied.has(`${cell.x+side},${cell.y},${cell.z??0}`));
  const desiredX=face.x+data.width/2+side*.6;
  const rank=cell=>Math.abs(cell.y+.5+FEET-desiredY)*3+Math.abs(cell.x+.5-desiredX)*.12+Math.abs((cell.z??0)-(face.cell?.z??0))*.15;
  const cell=candidates.reduce((best,cell)=>rank(cell)<rank(best)?cell:best);
  return {cell:{x:cell.x,y:cell.y,z:cell.z??0},x:cell.x+(side>0?1:0)-data.width/2,
    y:Math.max(FEET+cell.y+.15,Math.min(FEET+cell.y+.85,desiredY)),z:(cell.z??0)-(bodyDepth(data)-1)/2};
}
export function getCharacterFaceLayout(number,definition){
  if((definition??getCharacterDefinition(number)).number===0)return{x:0,eyeY:.44,mouthY:.44,gap:0,size:0,mouth:.76};
  const data=definition??getCharacterDefinition(number),t=faceTransform(data),f=t.source;
  return{...f,x:f.x*t.scale+t.x,eyeY:f.eyeY*t.scale+t.y,mouthY:f.mouthY*t.scale+t.y,gap:f.gap*t.scale,size:f.size*t.scale,mouth:f.mouth*t.scale};
}
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
    if(n===26){
      ball(parent,x,f.eyeY,.61,.41,.31,.08,'#1c2223','black sunglass lens');
      tube(parent,[[x-.35,f.eyeY+.13,.66],[x-.1,f.eyeY+.16,.69],[x+.17,f.eyeY+.15,.69]],.023,'#657273',false,'sunglass reflection');
      tube(parent,[[x-.43,f.eyeY+.22,.64],[x,f.eyeY+.25,.65],[x+.43,f.eyeY+.22,.64]],.035,'#161c1b',false,'sunglasses upper rim');
    }
    if(n===27){
      star(parent,x,f.eyeY,.515,.47,.28,'#66347b',6,Math.PI/2);
      ring(parent,x,f.eyeY,.595,.29,.3,.049,'#7f478c');
    }
    if(n===28){
      for(let band=0;band<7;band++)box(parent,x-.245+band*.07,f.eyeY,.537,.071,.64,.045,RAINBOW[band],'rainbow window mask');
      rectangleRing(parent,x,f.eyeY,.59,.43,.5,.027,'#356da6');
    }
    if(n===29||n===30)ring(parent,x,f.eyeY,.59,f.size*1.2,f.size*1.21,.04,n===29?'#5e6260':'#c19d26');
    if([31,33,34,35,37,38,39].includes(n)){
      const color={31:'#9c4033',33:'#df8c31',34:'#358e42',35:'#247f91',37:'#d6b342',38:'#b38743',39:'#576777'}[n];
      const size=f.size*(n===33&&index===1?.74:1);
      ring(parent,x,f.eyeY,.591,size*1.18,size*1.2,n===34||n===39?.055:.04,color);
    }
    if(n===32||n===40)rectangleRing(parent,x,f.eyeY,.592,n===40?1.0:.76,n===40?1.43:1.1,.05,n===40?'#2c8b4a':'#d8922e');
    if(n===36){
      const side=index?1:-1;
      polygon(parent,side<0?[[-.4,-.36],[.4,-.36],[.4,.28],[-.42,.98],[-.4,.18]]:[[-.4,-.36],[.4,-.36],[.4,.18],[.42,.98],[-.4,.28]],.045,'#ec2696',x,f.eyeY,.516,'magenta superhero mask');
      rectangleRing(parent,x,f.eyeY,.59,.63,.65,.038,'#a11a74');
    }
    if([41,43,44,46,47,50].includes(n)){
      const size=f.size*(n===44&&index===1?.72:1);
      const color=n===41?'#d73a3d':n===43?'#c6a72f':n===44?(index?'#c84657':'#369ab4'):n===46?'#7750b5':n===47?'#79563c':'#377b91';
      ring(parent,x,f.eyeY,.596,size*1.16,size*1.2,n===46?.065:.043,color);
    }
    if([42,48,49].includes(n))rectangleRing(parent,x,f.eyeY,.59,n===49?.72:n===48?.88:.73,n===49?.79:n===48?1.25:1.05,.052,n===49?'#326b46':n===48?'#713095':'#367f9d');
    if(n===45){
      const side=index?1:-1;
      polygon(parent,side<0?[[-.4,-.36],[.4,-.36],[.4,.25],[-.43,.98],[-.4,.12]]:[[-.4,-.36],[.4,-.36],[.4,.12],[.43,.98],[-.4,.25]],.055,'#7c8b82',x,f.eyeY,.515,'gray staircase superhero mask');
      rectangleRing(parent,x,f.eyeY,.591,.63,.67,.038,'#c6cec5');
    }
    if(n===50&&index===0){
      const decoration=star(parent,x,f.eyeY,.565,.72,.39,'#e9bf59',5,Math.PI/2);decoration.name='fifty golden eye star';
    }
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
  if(n===26)tube(parent,[[f.x-.13,f.eyeY+.14,.66],[f.x,f.eyeY+.19,.66],[f.x+.13,f.eyeY+.14,.66]],.04,'#1c2223',false,'sunglasses bridge');
  if(n===27){
    polygon(parent,[[0,.18],[.19,0],[0,-.18],[-.19,0]],.05,'#fff6c4',0,f.eyeY+.6,.52,'golden cube badge');
    polygon(parent,[[0,.1],[.1,0],[0,-.1],[-.1,0]],.04,'#c4a13a',0,f.eyeY+.6,.575,'cube badge inset');
  }
  if(n===35)tube(parent,[[f.x-.1,f.eyeY+.02,.61],[f.x,f.eyeY+.08,.63],[f.x+.1,f.eyeY+.02,.61]],.034,'#247f91',false,'blue flower glasses bridge');
  if(n===39)ball(parent,f.x,f.eyeY-.52,.76,.3,.31,.3,'#a6ada7','round gray nose');
  if(n===50)polygon(parent,[[-1.31,.40],[-.75,.83],[-.1,1.05],[.5,1.04],[1.02,.79],[1.33,.43],[.77,.60],[.12,.60],[-.63,.07]],.055,'#387d9a',f.x,f.eyeY,.525,'fifty sweeping blue swoosh');
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
  const lip = ({31:'#9c4033',32:'#cc9433',33:'#cd3e57',34:'#378b43',35:'#247f91',36:'#a72e7a',37:'#a64341',38:'#dc9a30',39:'#677987',40:'#378e4b',41:'#467e2d',42:'#327f9c',43:'#c74a39',44:'#c74f6d',45:'#369aa4',46:'#c44f98',47:'#c54c6d',48:'#bd3d9e',49:'#285c3c',50:'#ca5799'})[number] ?? (number === 6 || number === 10 || number === 15 ? '#d7318b' : number === 7 ? '#f2d529' : number === 13 ? '#793c7d' : number === 14 ? '#36802b' : number===16?'#46215f':number===17?'#7431a3':number===18?'#8b256f':number===19?'#4b5251':number===20?'#9b4b88':number===23?'#8c4688':number===24?'#226d42':number===25?'#246e8c':'#713549');
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
    const eyelidColor=data.number===8?'#955d41':data.number===16?'#7541c2':data.number===19&&i===1?'#b4bcba':data.number===20?'#e8b76b':data.number===21?'#3f256e':data.number===23?'#edcd40':data.number===24?'#77c627':data.number===36?'#ec2696':data.number===40?'#a9e888':data.number===43?'#ffe33c':data.number===45?'#7c8b82':data.number===49?'#a0a6a2':data.number===50?'#84d3dc':data.number>40?'#b0ed91':data.number>=31?'#fff387':data.number>=22?'#ffd58b':data.number>=10?'#fffaf1':data.color;
    if(data.number!==26){
      const size=f.size*(i===1?([22,44].includes(data.number)?.72:data.number===33?.74:1):1);
      if([32,40,42,48].includes(data.number)){
        const tallEye=new THREE.Group();tallEye.position.y=f.eyeY;tallEye.scale.y=1.45;group.add(tallEye);eye(tallEye,x,0,size,emotion,eyelidColor);
      }else eye(group,x,f.eyeY,size,emotion,eyelidColor);
    }
    if (emotion === 'happy' && data.number<31 && ![4, 9, 12, 13, 14,18,19,20,23,24,25,26,29].includes(data.number)) continue;
    if([36,45,50].includes(data.number)&&emotion==='happy')continue;
    const y = f.eyeY + f.size * ([32,40,42,48].includes(data.number)?2.1:emotion === 'surprised' ? 1.65 : 1.4);
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
    } else if(data.number===40){
      const brow=new THREE.Group();brow.name='green checkered eyebrow';brow.position.set(x,y+lift,.56);brow.rotation.z=emotion==='sad'?side*.2:emotion==='curious'?(i?.14:-.1):side*-.06;group.add(brow);
      for(let row=0;row<2;row++)for(let col=0;col<4;col++)box(brow,(col-1.5)*.205,(row-.5)*.16-Math.abs(col-1.5)*.025,0,.204,.158,.075,(col+row)%2?'#55a54e':'#308d44','eyebrow checker');
    } else if(data.number===38){
      tube(group,[[x-f.size*.88,y+tilt,.64],[x-f.size*.35,y+.13+lift,.65],[x+f.size*.3,y-.02+lift,.65],[x+f.size*.85,y+.11-tilt,.64]],.044,'#af4c94',false,'magenta zigzag eyebrow');
    } else if(data.number===39){
      const brow=box(group,x,y+lift,.62,f.size*1.9,.115,.09,'#607181','gray thoughtful eyebrow');brow.rotation.z=emotion==='sad'?side*.2:emotion==='curious'?(i?.14:-.08):0;
    } else if([42,48].includes(data.number)){
      const brow=polygon(group,[[-.47,-.045],[-.5,.20],[-.17,.27],[.42,.18],[.44,-.07],[.05,.01]],.07,data.number===42?'#367f9f':i?'#9e388c':'#7335a0',x,y+lift,.54,data.number===42?'blue multiplication eyebrow':'purple rectangular eyebrow');
      brow.rotation.z=emotion==='sad'?side*.18:emotion==='curious'?(i?.15:-.1):side*.07;
    } else if(data.number===46){
      tube(group,[[x-f.size*.73,y-.02+tilt,.64],[x,y+.18+lift,.65],[x+f.size*.72,y-.01-tilt,.64]],.058,'#9162c6',false,'curved purple eyebrow');
    } else if(data.number===19){
      tube(group,[[x-f.size*.95,y+tilt,.64],[x-f.size*.48,y+.12+lift,.65],[x+f.size*.15,y+.015+lift,.65],[x+f.size*.8,y+.17-tilt,.64]],.049,'#485052',false,'zigzag eyebrow');
    } else tube(group, points, [4,9,18,20,23,24,26,29,31,32,34,35].includes(data.number) ? .055 : .034, data.number===23?'#633287':data.number >= 11 ? data.dark : '#344d56');
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
  const extra = data.number === 7 ? .6 : data.number === 21 ? .72 : data.number===26?.57:data.number===30?1.03:data.number===49?.62:[31,34].includes(data.number)?.48:data.number===37?.95:data.number === 3 || data.number === 14 ? .46 : 0;
  const anchor=isTransformed(data)||[41,42,46,47].includes(data.number)?topAttachment(data):null;
  label.position.set(anchor?.x??(data.number===20?.55:0), data.height + FEET + (data.number===20?.54:.47) + extra, (anchor?.z??0)+.03);
  const digits = String(data.number), width = digits.length === 2 ? .65 : .43;
  ball(label, 0, 0, 0, width, .43, .055, '#fffcf1', 'number plaque');
  for (let i = 0; i < digits.length; i++) {
    const offset = (i - (digits.length - 1) / 2) * .43 - .145;
    for (const stroke of DIGITS[digits[i]]) tube(label, stroke.map(([x, y]) => [x + offset, y - .29, .07]), .027, '#263c46');
  }
  root.add(label);
}
function agentOutfit(root, top) {
  const hat=new THREE.Group();hat.name='black secret agent hat';hat.position.y=top+.04;root.add(hat);
  const brim=cylinder(hat,0,0,0,.65,.1,'#202425','black hat brim');brim.scale.z=.7;
  const crown=mesh(new THREE.CylinderGeometry(.32,.49,.48,5),'#303536','black hat crown');crown.position.y=.27;hat.add(crown);
  cylinder(hat,0,.11,0,.46,.08,'#101819','black hat band');
  const tie=new THREE.Group();tie.name='secret agent tie';tie.position.set(0,1.91,.53);root.add(tie);
  for(const side of[-1,1])polygon(tie,[[side*.02,.38],[side*.51,.45],[side*.25,.03]],.04,'#fffcf1',0,0,0,'white shirt collar');
  polygon(tie,[[0,.32],[.18,.14],[0,-.04],[-.18,.14]],.07,'#232b29',0,0,.05,'black tie knot');
  polygon(tie,[[0,.04],[.23,-.25],[0,-.48],[-.23,-.25]],.07,'#232b29',0,0,.05,'black necktie');
}
function numberTiles(root) {
  for(const [x,y,digit,color]of[[-1,1.72,'2','#b6934c'],[-1,.73,'1','#bd9341'],[1,1.72,'9','#737c76'],[1,.73,'9','#a6483d']]){
    box(root,x,y,.54,.44,.45,.08,'#fff2c9','little number tile');
    rectangleRing(root,x,y,.59,.36,.37,.018,color);
    for(const stroke of DIGITS[digit])tube(root,stroke.map(([px,py])=>[x+(px-.15)*.45,y+(py-.3)*.45,.608]),.016,color,false,'number tile digit');
  }
}
function thirtyCrown(root, top) {
  const points=[[-1.04,0],[-1.12,.68],[-.55,.4],[0,1.12],[.55,.4],[1.12,.68],[1.04,0]];
  polygon(root,points,.65,'#e6c52d',0,top,-.32,'thirty golden crown');
  for(const[x,y]of[[-1.12,.68],[0,1.12],[1.12,.68]])ball(root,x,top+y,.02,.095,.095,.095,'#cf3433','red crown jewel');
  box(root,0,top+.1,.34,1.99,.12,.07,'#f9e05b','crown band');
}
function paintRoller(parent) {
  const roller=new THREE.Group();roller.name='green paint roller';parent.add(roller);
  cylinder(roller,0,.23,0,.055,.65,'#bd9451','wooden roller handle');
  tube(roller,[[0,.53,0],[0,.85,0],[-.25,.85,0],[-.25,1.12,0]],.035,'#91a29a',false,'roller metal arm');
  cylinder(roller,-.3,1.12,0,.16,.72,'#5ecd4a','green roller cover','x');
  for(const side of[-1,1])cylinder(roller,-.3+side*.37,1.12,0,.115,.035,'#b9e78b','roller end cap','x');
}
function frontDecoration(root,data,cell,name){
  const group=new THREE.Group();group.name=name;group.position.set(cell.x+.5-data.width/2,FEET+cell.y+.5,(cell.z??0)-(bodyDepth(data)-1)/2+.515);
  group.userData.attachedCell={x:cell.x,y:cell.y,z:cell.z??0};root.add(group);return group;
}
function laterDecorations(root,data) {
  const n=data.number,transformed=isTransformed(data),anchor=transformed?topAttachment(data):{x:0,y:FEET+data.height,z:0,width:data.width};
  const visible=frontCells(data),face=faceTransform(data);
  if(n>=41){fortiesDecorations(root,data);return;}
  if(n===31){
    const binding=new THREE.Group();binding.name='red calendar binding';binding.position.set(anchor.x,anchor.y+.05,anchor.z);root.add(binding);
    const width=Math.max(.7,Math.min(6.75,anchor.width-.22)),ringScale=Math.min(1,width/6.75);
    box(binding,0,.035,0,width,.14,.69,'#ec403f','calendar red header');
    for(let index=0;index<7;index++){
      const loop=mesh(new THREE.TorusGeometry(.22,.038,8,22),'#bdc5c3','silver calendar ring');
      loop.rotation.y=Math.PI/2;loop.scale.set(.72*ringScale,ringScale,ringScale);loop.position.set((index-3)*width/6.3,.18*ringScale,.01);binding.add(loop);
    }
  }
  if(n===33){
    const cell=visible.filter(cell=>cell.y===0).sort((a,b)=>b.x-a.x)[0]??visible[0];
    const badge=frontDecoration(root,data,cell,'sports badge');
    polygon(badge,[[-.24,.29],[.24,.29],[.22,-.1],[0,-.29],[-.22,-.1]],.06,'#4c8d39',0,0,0,'green team shield');
    const emblem=new THREE.Group();emblem.name='badge football';emblem.scale.setScalar(.39);emblem.position.set(0,.01,.11);badge.add(emblem);soccerBall(emblem);
  }
  if(n===34){
    const cap=new THREE.Group();cap.name='green painter cap';cap.position.set(anchor.x,anchor.y+.02,anchor.z);cap.scale.setScalar(Math.min(1,anchor.width/1.9));root.add(cap);
    const crown=mesh(new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2),'#8bb951','painter cap crown');crown.scale.set(.85,.27,.49);cap.add(crown);
    ball(cap,0,.04,.45,.88,.075,.34,'#d8c66a','painter cap brim');
    const cellPoints=transformed?visible.filter(cell=>Math.abs(cell.x-(face.cell?.x??0))+Math.abs(cell.y-(face.cell?.y??0))>1).slice(0,5):[[1,1],[1,2],[4,1],[4,2],[3,3]].map(([x,y])=>data.cells.find(cell=>cell.x===x&&cell.y===y));
    for(const [index,cell]of cellPoints.entries())if(cell){
      const splash=frontDecoration(root,data,cell,'green paint splash');splash.rotation.z=index*.9;
      for(const[x,y,r]of[[0,0,.13],[-.12,.13,.08],[.14,.02,.075],[-.04,-.16,.08],[.12,.2,.045]])ball(splash,x,y,.01,r,r*.9,.022,'#76bc4e','paint droplet');
    }
  }
  if(n===35){
    let cells;
    if(transformed){
      cells=[];
      for(const cell of [...visible].sort((a,b)=>b.y-a.y||a.x-b.x)){
        if(cells.every(other=>Math.hypot(cell.x-other.x,cell.y-other.y)>1.05))cells.push(cell);
        if(cells.length===5)break;
      }
    }else cells=[[0,5],[2,5],[4,5],[1,4],[3,4]].map(([x,y])=>data.cells.find(cell=>cell.x===x&&cell.y===y));
    cells.forEach((cell,index)=>{
      const flower=frontDecoration(root,data,cell,'rainbow flower');
      for(let petal=0;petal<7;petal++){
        const angle=petal*Math.PI*2/7+index*.18;
        const piece=ball(flower,Math.sin(angle)*.23,Math.cos(angle)*.23,.045,.095,.185,.045,RAINBOW[petal],'flower petal');piece.rotation.z=-angle;
      }
      ball(flower,0,0,.1,.105,.105,.055,'#fff5ce','flower center');
    });
  }
  if(n===37){
    const hat=new THREE.Group();hat.name='rainbow explorer hat';hat.position.set(anchor.x,anchor.y+.03,anchor.z);hat.scale.setScalar(Math.min(1,anchor.width/1.8));root.add(hat);
    const brim=cylinder(hat,0,0,0,.91,.11,'#e2d181','explorer cream brim');brim.scale.z=.65;
    const dome=mesh(new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2),'#fff0ae','explorer cream crown');dome.scale.set(.62,.42,.44);dome.position.y=.05;hat.add(dome);
    box(hat,0,.13,.42,1.07,.11,.04,'#cdb958','explorer yellow hat band');
    cylinder(hat,0,.6,0,.022,.33,'#8e9b93','direction arrow post');
    polygon(hat,[[-.4,-.045],[.15,-.045],[.15,-.16],[.47,0],[.15,.16],[.15,.045],[-.4,.045]],.05,'#4a72ab',0,.83,-.025,'blue direction arrow');
  }
}
function fortiesDecorations(root,data) {
  const n=data.number,transformed=isTransformed(data),visible=frontCells(data),face=faceTransform(data),top=topAttachment(data);
  if(n===42){
    const belt=new THREE.Group();belt.name='rainbow multiplication belt';root.add(belt);
    let width=3.99,height=.66;
    if(transformed){
      const cell=visible.reduce((best,cell)=>Math.abs(cell.x-(face.cell?.x??0))+Math.abs(cell.y-(face.cell?.y??0))>Math.abs(best.x-(face.cell?.x??0))+Math.abs(best.y-(face.cell?.y??0))?cell:best);
      belt.position.set(cell.x+.5-data.width/2,FEET+cell.y+.5,(cell.z??0)-(bodyDepth(data)-1)/2);
      belt.userData.attachedCell={x:cell.x,y:cell.y,z:cell.z??0};width=.92;height=.24;
    }else belt.position.y=FEET+4;
    for(let band=0;band<7;band++){
      const y=(3-band)*height/7;
      for(const z of[-.522,.522])box(belt,0,y,z,width,height/7+.005,.035,RAINBOW[band],'rainbow belt stripe');
      for(const side of[-1,1])box(belt,side*width/2,y,0,.035,height/7+.005,1.04,RAINBOW[band],'rainbow belt side');
    }
    const buckle=new THREE.Group();buckle.name='purple hexagon belt buckle';buckle.position.z=.555;buckle.scale.setScalar(transformed?.38:1);belt.add(buckle);
    const points=Array.from({length:6},(_,i)=>[Math.cos(i*Math.PI/3)*.71,Math.sin(i*Math.PI/3)*.71]);
    polygon(buckle,points,.12,'#713caa',0,0,0,'hexagonal buckle body');
    for(const[x,y]of[[0,.32],[-.24,.16],[.24,.16],[-.24,-.16],[.24,-.16],[0,-.32]])ball(buckle,x,y,.14,.048,.048,.024,'#a879d7','hexagon buckle dot');
  }
  if(n===43){
    const cells=transformed?visible.filter(cell=>cell.color==='#b0ed91').sort((a,b)=>b.y-a.y).slice(0,10):visible.filter(cell=>cell.y>=6);
    for(const cell of cells){
      const mark=frontDecoration(root,data,cell,'green frame chevron');
      const points=cell.y%2?[[-.48,-.48],[-.48,.48],[.48,-.48]]:[[-.48,-.48],[.48,.48],[-.48,.48]];
      polygon(mark,points,.018,(cell.x%4<2)?'#4a9137':'#80c25b',0,0,.003,'chevron triangle');
    }
  }
  if(n===44){
    const cell=visible.filter(cell=>cell.y===0).sort((a,b)=>b.x-a.x)[0];
    const badge=frontDecoration(root,data,cell,'forty-four football badge');
    polygon(badge,[[-.28,.31],[.28,.31],[.25,-.12],[0,-.32],[-.25,-.12]],.055,'#368134',0,0,0,'green football shield');
    const emblem=new THREE.Group();emblem.name='football badge ball';emblem.scale.setScalar(.40);emblem.position.set(0,.01,.12);badge.add(emblem);soccerBall(emblem);
  }
  if(n===46){
    const cell=transformed?[...visible].sort((a,b)=>b.y-a.y||a.x-b.x)[0]:visible.find(cell=>cell.x===0&&cell.y===9);
    const flower=frontDecoration(root,data,cell,'yellow hat flower');flower.position.y+=transformed?0:.30;
    for(let petal=0;petal<7;petal++){
      const angle=petal*Math.PI*2/7;
      const piece=ball(flower,Math.sin(angle)*.27,Math.cos(angle)*.27,.055,.13,.22,.065,'#ffe556','yellow flower petal');piece.rotation.z=-angle;
    }
    ball(flower,0,0,.13,.15,.15,.07,'#f5a134','orange flower center');
  }
  if(n===47){
    const brow=new THREE.Group();brow.name='brown explorer headband';root.add(brow);
    const patch=face.patch,width=transformed?patch.width-.08:3.99;
    brow.position.set(transformed?patch.x+patch.width/2-data.width/2:0,getCharacterFaceLayout(n,data).eyeY+.03,transformed?patch.z-(bodyDepth(data)-1)/2:0);
    box(brow,0,0,.518,width,transformed?.12:.19,.035,'#713c2b','brown forehead band');
    for(const side of[-1,1])box(brow,side*width/2,0,0,.035,transformed?.12:.19,1.04,'#713c2b','brown headband side');
    const hat=new THREE.Group();hat.name='padded explorer brow band';root.add(hat);
    hat.position.set(transformed?top.x:0,transformed?top.y:FEET+10,transformed?top.z:0);
    roundedPackBox(hat,0,0,0,transformed?Math.max(.7,top.width-.03):4.10,.42,1.12,'#78452f','padded brown headband');
  }
  if(n===49){
    const hair=new THREE.Group();hair.name='seven rainbow combs';hair.position.set(top.x,top.y+.07,top.z);hair.scale.setScalar(Math.min(1,top.width/7));root.add(hair);
    for(let index=0;index<7;index++){
      const comb=new THREE.Group();comb.name='rainbow hair comb';comb.position.x=index-3;hair.add(comb);
      box(comb,0,0,0,.70,.14,.22,RAINBOW[index],'comb base');
      for(const side of[-1,0,1]){
        const prong=cylinder(comb,side*.23,.21-Math.abs(side)*.025,0,.067,.38-Math.abs(side)*.05,RAINBOW[index],'rounded comb tooth');
        prong.rotation.z=side*-.17;
        ball(comb,side*.26,.40-Math.abs(side)*.05,0,.067,.067,.067,RAINBOW[index],'comb rounded tip');
      }
    }
  }
}
function decorations(root, data) {
  const n = data.number, top = data.height + FEET;
  if (n === 3) {
    polygon(root, [[-.46, 0], [-.49, .33], [-.24, .15], [0, .45], [.24, .15], [.49, .33], [.46, 0]], .75, '#e64c43', 0, top, -.36, 'three-point crown');
    for (const [x, y] of [[-.49, .33], [0, .45], [.49, .33]]) ball(root, x, top + y, .025, .06, .06, .06, '#ffdf51');
    for (let i = 0; i < 3; i++) ball(root, 0, top - 1.18 - i * .36, .535, .09, .12, .06, '#d8463b', 'red button');
  }
  if (n === 6) {
    for (const cell of data.cells) ball(root, cell.x + .5 - data.width / 2, cell.y + .5 + FEET, .516+(cell.z??0)-(bodyDepth(data)-1)/2, .18, .18, .024, '#c1edf1', 'six spot');
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
  if(n===26)agentOutfit(root,top);
  if(n===29)numberTiles(root);
  if(n===30)thirtyCrown(root,top);
  if(n>=31)laterDecorations(root,data);
}
function transformedDecorations(root,data) {
  const original=getCharacterDefinition(data.number),scale=Math.min(1,data.width/original.width,data.height/original.height);
  const anchor=topAttachment(data);
  if(data.number>=31){laterDecorations(root,data);return;}
  if(data.number===6||data.number===18){decorations(root,data);return;}
  if(data.number===21){
    adaptedBackpack(root,data,scale);
    const hat=new THREE.Group();root.add(hat);explorerHat(hat,0);hat.scale.setScalar(Math.min(1,anchor.width/2));hat.position.set(anchor.x,anchor.y,anchor.z);
    return;
  }
  const props=new THREE.Group();props.name='adapted character accessories';root.add(props);decorations(props,original);
  props.scale.setScalar(scale);props.position.set(anchor.x,anchor.y-(FEET+original.height)*scale,anchor.z+(1-scale)/2);
  for(const child of props.children){
    if(child.name==='white bow tie'||child.name==='secret agent tie')child.position.y=(FEET+Math.min(.4,data.height*.2)-props.position.y)/scale;
    if(data.number===14&&child.isGroup)child.position.set((data.width/2+.35)/scale,(FEET+data.height/3-props.position.y)/scale,0);
  }
  if(data.number===29){
    const face=getCharacterFaceLayout(data.number,data),source=faceLayout(original);
    props.position.y=(face.eyeY+face.mouthY)/2-(source.eyeY+source.mouthY)/2*scale;
  }
}

function adaptedBackpack(root,data,maxScale) {
  const holder=new THREE.Group();holder.name='adapted explorer backpack';root.add(holder);backpack(holder);
  const pack=holder.getObjectByName('explorer backpack');
  const bounds=new THREE.Box3().setFromObject(pack),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const mainBounds=new THREE.Box3().setFromObject(pack.getObjectByName('olive backpack body'));
  const rear=new Map();
  for(const cell of data.cells){
    const key=`${cell.x},${cell.y}`,previous=rear.get(key);
    if(!previous||(cell.z??0)<(previous.z??0))rear.set(key,cell);
  }
  // Fit the complete pack and its shoulder straps to a filled rear patch.
  // This keeps sparse corners and layered forms from wearing a pack in air.
  let best=null;
  for(const cell of rear.values())for(let height=1;height<=Math.min(8,data.height);height++)for(let width=1;width<=Math.min(4,data.width);width++){
    let filled=true;
    for(let y=cell.y;y<cell.y+height&&filled;y++)for(let x=cell.x;x<cell.x+width;x++){
      const rearCell=rear.get(`${x},${y}`);
      if(!rearCell||(rearCell.z??0)!==(cell.z??0)){filled=false;break;}
    }
    if(!filled)continue;
    const scale=Math.min(maxScale,(width-.12)/size.x,(height-.12)/size.y);
    const halfX=size.x*scale/2,halfY=size.y*scale/2;
    const cx=Math.max(cell.x+halfX+.06,Math.min(cell.x+width-halfX-.06,data.width/2));
    const cy=Math.max(cell.y+halfY+.06,Math.min(cell.y+height-halfY-.06,data.height*.6));
    const score=scale*10-Math.abs(cx-data.width/2)*.025-Math.abs(cy-data.height*.6)*.025;
    if(!best||score>best.score)best={score,scale,cx,cy,patch:{x:cell.x,y:cell.y,z:cell.z??0,width,height}};
  }
  const {scale,cx,cy,patch}=best,rearZ=patch.z-bodyDepth(data)/2;
  holder.scale.setScalar(scale);
  holder.position.set(cx-data.width/2-center.x*scale,FEET+cy-center.y*scale,rearZ-(mainBounds.max.z+.01)*scale);
  const attachment={patch,scale,rearZ};
  holder.userData.attachment=attachment;root.userData.backpackAttachment=attachment;
}

function zeroExpression(emotion) {
  const group=new THREE.Group();group.name=`expression ${emotion}`;
  const coral='#f27880',crease='#a83e51';
  if(emotion==='curious'||emotion==='sad'){
    const points=emotion==='curious'?[[-.3,.015,0],[-.14,-.035,.01],[.08,-.012,.01],[.28,.085,0]]:[[-.31,-.13,0],[-.15,.055,.01],[.11,.065,.01],[.31,-.11,0]];
    tube(group,points,.067,coral,false,'coral floating lip');
    tube(group,points.map(([x,y,z])=>[x,y,z+.063]),.014,crease,false,'mouth crease');
    return group;
  }
  const shape=new THREE.Shape(),hole=new THREE.Path();
  if(emotion==='surprised'||emotion==='sleepy'){
    const rx=emotion==='surprised'?.235:.15,ry=emotion==='surprised'?.29:.19;
    shape.absellipse(0,-.025,rx,ry,0,Math.PI*2,false,0);
    hole.absellipse(0,-.025,rx-.065,ry-.065,0,Math.PI*2,true,0);
  }else{
    const extra=emotion==='excited'?.105:0;
    shape.moveTo(-.34,.055);shape.bezierCurveTo(-.12,.06,.1,.11,.27,.19);
    shape.bezierCurveTo(.39,.25,.43,.1,.36,-.04);
    shape.bezierCurveTo(.23,-.25-extra,-.14,-.31-extra,-.33,-.18);
    shape.bezierCurveTo(-.43,-.1,-.43,.05,-.34,.055);shape.closePath();
    hole.moveTo(-.29,-.018);hole.bezierCurveTo(-.12,-.025,.13,.055,.29,.13);
    hole.bezierCurveTo(.28,-.0-extra,.12,-.13-extra,-.07,-.135-extra);
    hole.bezierCurveTo(-.2,-.14-extra,-.27,-.1,-.29,-.018);hole.closePath();
  }
  shape.holes.push(hole);
  const rim=mesh(new THREE.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:true,bevelSize:.018,bevelThickness:.023,bevelSegments:3,curveSegments:20}),coral,'coral floating lip');group.add(rim);
  const cavityShape=new THREE.Shape(hole.getPoints(40));
  const cavity=mesh(new THREE.ExtrudeGeometry(cavityShape,{depth:.018,bevelEnabled:false}),'#3c242c','zero mouth cavity');cavity.position.z=-.024;group.add(cavity);
  if(emotion==='happy'||emotion==='excited'){
    const teeth=new THREE.Shape();
    teeth.moveTo(-.267,-.028);teeth.bezierCurveTo(-.075,-.03,.13,.06,.27,.12);
    teeth.bezierCurveTo(.19,.002,-.015,-.086,-.215,-.092);
    teeth.quadraticCurveTo(-.26,-.065,-.267,-.028);teeth.closePath();
    const ivory=mesh(new THREE.ExtrudeGeometry(teeth,{depth:.025,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:1}),'#fff6d9','zero smiling teeth');
    // Keep the ivory just behind the lip's front edge so an elevated camera
    // sees the smile, and the small recessed surface does not turn dark.
    ivory.position.z=.056;ivory.receiveShadow=false;group.add(ivory);
    if(emotion==='excited')ball(group,.025,-.19,.005,.115,.045,.025,'#f5a1a6','zero tongue');
  }
  return group;
}
function zeroNumeral() {
  const shape=new THREE.Shape(),hole=new THREE.Path();
  const capsule=(path,r,straight)=>{
    path.moveTo(-r,-straight);path.lineTo(-r,straight);path.absarc(0,straight,r,Math.PI,0,true);
    path.lineTo(r,-straight);path.absarc(0,-straight,r,0,-Math.PI,true);path.closePath();
  };
  capsule(shape,.17,.145);capsule(hole,.079,.139);shape.holes.push(hole);
  const numeral=mesh(new THREE.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:2,curveSegments:20}),'#080c0c','black zero numeral');
  const label=new THREE.Group();label.name='number 0';label.position.set(0,1.01,0);label.add(numeral);return label;
}
function modelDisposer(root) {
  let disposed=false;
  return()=>{
    if(disposed)return;disposed=true;
    const geometries=new Set();root.traverse(object=>{if(object.geometry&&object.geometry!==CUBE&&object.geometry!==SPHERE)geometries.add(object.geometry);});
    for(const geometry of geometries)geometry.dispose();
    root.removeFromParent();
  };
}
function createZero() {
  const metrics=getCharacterMetrics(0),root=new THREE.Group();root.name='Zero character';
  Object.assign(root.userData,{number:0,formId:'original',visualHeight:1.36,faceCenter:{x:0,y:.44,z:.06},armAttachments:[]});
  const body=new THREE.Group();body.name='unit block body';root.add(body);
  const floating=new THREE.Group();floating.name='floating zero';root.add(floating);
  const face=new THREE.Group();face.name='character face';face.position.y=.44;floating.add(face);
  const expressions=Object.fromEntries(MOODS.map(emotion=>{const group=zeroExpression(emotion);group.visible=false;face.add(group);return[emotion,group];}));
  floating.add(zeroNumeral());
  let elapsed=0,currentEmotion;
  function setEmotion(emotion='happy'){
    const next=MOODS.includes(emotion)?emotion:'happy';
    if(currentEmotion)expressions[currentEmotion].visible=false;
    expressions[next].visible=true;currentEmotion=next;root.userData.emotion=next;return next;
  }
  function update(dt=0,state={}){
    elapsed=Number.isFinite(state.time)?state.time:elapsed+(Number.isFinite(dt)?dt:0);
    if(state.emotion!==undefined)setEmotion(state.emotion);
    floating.position.y=state.moving?Math.abs(Math.sin(elapsed*7))*.035:Math.sin(elapsed*2.3)*.018;
    floating.rotation.z=Math.sin(elapsed*(state.moving?3:1.4))*.025;
  }
  setEmotion('happy');
  return{root,body,face,setEmotion,update,dispose:modelDisposer(root),...metrics};
}

/** Build true unit-cube geometry. Front is +Z; root y=0 is the shoe sole.
 * Calling update never changes root position/rotation: the game owns movement.
 * Expressions and labels use prebuilt meshes, with no DOM or canvas dependency.
 */
export function createCharacter(number, {definition} = {}) {
  const data = definition ?? getCharacterDefinition(number), original=getCharacterDefinition(data.number), transformed=isTransformed(data);
  if(data.number===0)return createZero();
  const metrics = getCharacterMetrics(data), depth=bodyDepth(data);
  const root = new THREE.Group(); root.name = `${data.name} character`;
  root.userData.number = data.number;
  root.userData.formId=data.formId??'original';root.userData.armAttachments=[];root.userData.footAttachments=[];
  root.userData.visualHeight = data.height + 1.25 + (data.number === 7 ? .6 : data.number===21?.72:data.number===24?.45:data.number===26?.57:data.number===30?1.03:data.number===49?.62:[31,34].includes(data.number)?.48:data.number===37?.95:data.number === 3 || data.number === 14 ? .46 : data.number===20?.2:0);
  const facePlacement=faceTransform(data),adaptedFace={...getCharacterFaceLayout(data.number,data),cell:facePlacement.cell};
  const body = new THREE.Group(); body.name = 'unit block body'; root.add(body);
  for (const cell of data.cells) {
    const cube = mesh(CUBE, cell.color, `${data.name} block ${cell.x},${cell.y}`);
    cube.position.set(cell.x + .5 - data.width / 2, cell.y + .5 + FEET, (cell.z??0)-(depth-1)/2);
    cube.userData.unitBlock = true;
    cube.userData.cell = { x: cell.x, y: cell.y, z:cell.z??0 };
    body.add(cube);
  }
  outlineBody(body, data);
  const feet = [];
  const bottomCells=frontCells(data).filter(cell=>cell.y===0);
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    let fx = !transformed&&data.number === 15 ? 1.5 + side * .3 : !transformed&&data.number===23?-.5+side*.32:!transformed&&data.number===31?-1+side*.19:!transformed&&data.number===45?1.7+side*.3:side * Math.min(.65, data.width * .26),fz=0,footCell;
    if(transformed){
      footCell=bottomCells.reduce((best,cell)=>Math.abs(cell.x+.5-data.width/2-fx)<Math.abs(best.x+.5-data.width/2-fx)?cell:best);
      fx=Math.max(footCell.x+.16-data.width/2,Math.min(footCell.x+.84-data.width/2,fx));fz=(footCell.z??0)-(depth-1)/2;
      root.userData.footAttachments.push({side,x:fx,y:FEET,z:fz,cell:{x:footCell.x,y:footCell.y,z:footCell.z??0}});
    }
    pivot.position.set(fx, .38, fz); root.add(pivot); feet.push(pivot);
    const newFootColor=({31:'#a33730',32:'#cd8b35',33:'#498349',34:'#4f9d40',35:'#287b92',36:side<0?'#e4cf51':'#6e35ad',37:side<0?'#a99854':'#88449d',38:'#9d8641',39:'#657176',40:'#398d45',41:'#4f7d34',42:'#2b7191',43:side<0?'#b79d31':'#b84739',44:side<0?'#c44d55':'#318c74',45:'#4da6a3',46:'#63528e',47:side<0?'#b8b642':'#5da88c',48:'#913582',49:'#2b7238',50:'#326d7c'})[data.number];
    const footColor = newFootColor ?? (data.number === 15 ? side < 0 ? '#f8efe8' : '#40c9de' : data.number===19?side<0?'#343d3e':'#727c7a':data.number===20?'#242b2d':data.number===21?side<0?'#d6b46a':'#c82d28':data.number===22?side<0?'#285f91':'#af342e':data.dark);
    const legColor=newFootColor??(data.number===20?'#d58a2f':data.number===21?side<0?'#d6b46a':'#c82d28':data.number===22?side<0?'#285f91':'#af342e':data.number===24?'#64ac25':data.dark);
    tube(pivot, [[0, .03, 0], [0, -.13, 0], [0, -.22, .04]], .075, legColor);
    ball(pivot, side * .015, -.24, .1, data.number === 8 ? .32 : .205, .14, .3, footColor, 'walking shoe');
    if (data.number === 11 || data.number === 15) box(pivot, 0, -.2, .345, .26, .065, .025, data.number === 11 ? '#fffdf5' : side < 0 ? '#cc3548' : '#188ab0', 'shoe stripe');
    if(data.number===20)box(pivot,0,-.12,.18,.27,.12,.27,'#fffbed','white spats');
    if(data.number===21&&side<0)for(const y of[-.14,-.21,-.28])box(pivot,0,y,.365,.25,.026,.035,'#fff0c5','hiking boot lace');
    if(data.number===22)for(const y of[-.14,-.25])box(pivot,0,y,.363,.27,.035,.025,'#fff0d2','striped trainer');
    if(data.number===33)for(const y of[-.09,-.18])box(pivot,0,y,.22,.22,.045,.15,'#fff4ce','football sock stripe');
    if(data.number===44)box(pivot,0,-.12,.18,.27,.13,.27,'#fffbed','white football boot cuff');
  }
  const arms = [];
  const lowFace = data.number >= 11;
  const armY = transformed?FEET+Math.max(.45,data.height/3):({21:4.5,22:1.3,23:1.12,24:3.9,25:1.55,26:2.0,27:1.9,28:1.5,29:1.1,30:8.3,31:1.82,32:1.7,33:1.18,34:1.65,35:1.6,36:1.18,37:6.5,38:1.45,39:7.55,40:5.8,41:2.9,42:5.15,43:1.0,44:.92,45:1.7,46:1.4,47:2.9,48:2.3,49:3.55,50:5.2})[data.number] ?? (lowFace ? (data.number === 12 ? 1.02 : 1.0) : data.height + FEET - (data.number === 6 ? 1.12 : data.number === 9 ? 1.5 : data.number === 10 ? 1.6 : .8));
  for (const side of [-1, 1]) {
    const count = data.number === 8 ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const pivot = new THREE.Group();
      const desiredY=data.number === 8 ? transformed?armY+(1-i)*Math.min(.3,data.height*.17):data.height + FEET - 1.28 - i : armY;
      const attachment=transformed||data.number>=31?armAttachment(data,side,desiredY,adaptedFace):null;
      pivot.position.set(attachment?.x??side * (!transformed&&data.number===17?1:data.width/2), attachment?.y??desiredY, attachment?.z??0);
      root.userData.armAttachments.push({side,x:pivot.position.x,y:pivot.position.y,z:pivot.position.z,...(attachment?{cell:attachment.cell}:{})});
      pivot.userData.armAttachment=true;
      root.add(pivot);
      const lifted = data.number === 6 && side < 0 || [7,10,37,39,40].includes(data.number) && side > 0 || [16,22,25,27,30].includes(data.number);
      const limbColor=({41:side<0?'#4c9c36':'#b73542',43:side<0?'#d68b35':'#c1483b',44:side<0?'#29a9b6':'#bd3657',45:'#38a6a6',48:side<0?'#68349a':'#b33b94',50:'#326b80'})[data.number]??([37,38].includes(data.number)?'#c4b65b':data.number===19?(side<0?'#414a4c':'#9ba3a1'):data.number===20?'#dd8c2c':data.number===22?(side<0?'#285f91':'#af342e'):data.dark);
      const handY = data.number===24?-.05:transformed&&data.height===1?(lifted?.22:-.25):lifted ? .48 : data.number === 8 ? .33 : data.number === 1 ? -.32 : -.49;
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
        const props=transformed?new THREE.Group():hand;
        if(transformed){props.name='adapted handheld props';hand.add(props);}
        if (data.number === 11 && side < 0) { const prop = new THREE.Group(); prop.position.set(-.04, .25, .2); soccerBall(prop); props.add(prop); }
        if (data.number === 12 && side > 0) box(props, -.07, -.035, .01, .065, .22, .2, '#fff6d9', 'wrist band');
        if(data.number===16&&side<0)megaphone(props);
        if(data.number===17)paintTools(props,side);
        if(data.number===18&&side>0)box(props,-.05,.06,0,.16,.12,.23,'#f8f3e6','white wrist band');
        if(data.number===20&&side<0)cane(props);
        if(data.number===21&&side>0)hikingStaff(props);
        if(data.number===24)celestialStaff(props,side<0);
        if(data.number===28){for(let band=0;band<7;band++)box(props,0,-.12+band*.045,.02,.23,.047,.24,RAINBOW[band],'rainbow wrist band');}
        if(data.number===34&&side<0)paintRoller(props);
        if(data.number===40&&side>0)box(props,0,-.1,.01,.23,.12,.24,'#75bc6a','green wrist cuff');
        if(data.number===47)for(let band=0;band<7;band++)box(props,0,-.12+band*.045,.02,.23,.047,.24,RAINBOW[band],'explorer rainbow wrist band');
        if(data.number===48&&side>0)box(props,0,-.1,.01,.23,.095,.24,'#c2c970','yellow wrist bangle');
        if(data.number===50&&side>0){box(props,0,-.1,.01,.23,.12,.24,'#6aafc0','blue wrist cuff');ball(props,0,-.1,.155,.065,.065,.025,'#d4f0e6','blue cuff button');}
        if(transformed){
          hand.scale.setScalar(Math.min(1,.55+data.height*.15,data.width*.65));
          props.scale.setScalar(Math.min(1,data.height/4));
          if(props.children.length){
            root.updateMatrixWorld(true);
            const handHeight=hand.getWorldPosition(new THREE.Vector3()).y;
            const bounds=new THREE.Box3().setFromObject(props),below=handHeight-bounds.min.y;
            if(below>handHeight-.14)props.scale.multiplyScalar(Math.max(.02,(handHeight-.14)/below));
          }
        }
      }
      arms.push({ pivot, side, phase: i * .9, tentacle: data.number === 8 });
    }
  }
  if(transformed)transformedDecorations(root,data);else decorations(root, data);
  const t=facePlacement,face=t.source,layout=adaptedFace;
  const faceRoot=new THREE.Group();faceRoot.name='character face';root.add(faceRoot);
  faceRoot.position.set(t.x,t.y,t.z);faceRoot.scale.setScalar(t.scale);
  root.userData.faceCenter={x:layout.x,y:(layout.eyeY+layout.mouthY)/2,z:.65*t.scale+t.z};
  if(t.cell){root.userData.faceCell={...t.cell};root.userData.facePatch={...t.patch};}
  eyeDecorations(faceRoot, original, face);
  const expressions = Object.fromEntries(MOODS.map(emotion => {
    const group = expression(original, face, emotion); group.visible = false; faceRoot.add(group); return [emotion, group];
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
  return { root, body, face:faceRoot, setEmotion, update, dispose:modelDisposer(root), height: metrics.height, width: metrics.width, depth:metrics.depth, radius: metrics.radius };
}
