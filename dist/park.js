import * as THREE from './vendor/three.module.js';
import { PARK_OFFSET } from './geography.js';

// Construction coordinates stay local; all exported positions are world-space.
const LOCAL_PARK = Object.freeze({
  x: 249, z: 46, radius: 14, hubHeight: 19, cabinCount: 18,
  speed: .085, entrance: Object.freeze({ x: 220, z: 80 }),
  bounds: Object.freeze({ minX: 208, maxX: 288, minZ: 8, maxZ: 96 }),
});
export const PARK = Object.freeze({
  ...LOCAL_PARK, x: LOCAL_PARK.x + PARK_OFFSET.x, z: LOCAL_PARK.z + PARK_OFFSET.z,
  entrance: Object.freeze({ x: LOCAL_PARK.entrance.x + PARK_OFFSET.x, z: LOCAL_PARK.entrance.z + PARK_OFFSET.z }),
  bounds: Object.freeze({
    minX: LOCAL_PARK.bounds.minX + PARK_OFFSET.x, maxX: LOCAL_PARK.bounds.maxX + PARK_OFFSET.x,
    minZ: LOCAL_PARK.bounds.minZ + PARK_OFFSET.z, maxZ: LOCAL_PARK.bounds.maxZ + PARK_OFFSET.z,
  }),
});
export const PARK_LANDMARK = Object.freeze({
  id: 'park', name: 'Wheel park', description: 'Count eighteen colorful cabins on the gently turning wheel.',
  x: 246 + PARK_OFFSET.x, z: 65 + PARK_OFFSET.z, radius: 35,
  arrival: Object.freeze({ x: 238 + PARK_OFFSET.x, z: 80 + PARK_OFFSET.z }),
});
const TREES = [[214, 17, 7], [226, 12, 6], [244, 11, 7.5], [266, 13, 6.5], [281, 20, 7], [283, 38, 6.5], [281, 58, 6.5], [284, 91, 6], [213, 57, 6], [214, 92, 6]];
const BENCHES = [{ x: 232, z: 70, rotation: -.25 }, { x: 266, z: 70, rotation: .25 }, { x: 259, z: 88, rotation: Math.PI }];
export const PARK_OBSTACLES = Object.freeze([
  { id: 'wheel-foundation', kind: 'ride', x: 238, z: 39, w: 22, d: 15 },
  { id: 'wheel-platform', kind: 'ride', x: 240, z: 54, w: 18, d: 6 },
  { id: 'park-arch-north', kind: 'pole', x: 220, z: 73.7, radius: .75 },
  { id: 'park-arch-south', kind: 'pole', x: 220, z: 86.3, radius: .75 },
  { id: 'park-flowerbed-west', kind: 'planter', x: 226.5, z: 62, w: 7, d: 2 },
  { id: 'park-flowerbed-east', kind: 'planter', x: 265.5, z: 62, w: 7, d: 2 },
  ...BENCHES.map(({ x, z }, i) => ({ id: `park-bench-${i}`, kind: 'bench', x: x - 2.3, z: z - 1.05, w: 4.6, d: 2.1 })),
  { id: 'park-picnic', kind: 'table', x: 275.5, z: 80.1, radius: 3.45 },
  ...TREES.map(([x, z], i) => ({ id: `park-tree-${i}`, kind: 'tree', x, z, radius: .7 })),
].map(obstacle => Object.freeze({ ...obstacle, x: obstacle.x + PARK_OFFSET.x, z: obstacle.z + PARK_OFFSET.z })));

const PALETTE = ['#e77b83', '#f2a35f', '#e5c55e', '#9dc375', '#65b99f', '#70bed0', '#809fce', '#a094cf', '#c58cbd', '#e999b6', '#ee997b', '#d5bd70', '#94b895', '#78b4ac', '#72acc7', '#94a6d1', '#b391c9', '#d892aa'];
const CREAM = '#fff5df', STEEL = '#6f9eaa', DARK = '#4f7987';
const BOX = new THREE.BoxGeometry(1, 1, 1);
const BALL = new THREE.SphereGeometry(1, 12, 8);
const CYLINDER = new THREE.CylinderGeometry(1, 1, 1, 12);
const materialCache = new Map();

function material(color, options = {}) {
  const key = color + JSON.stringify(options);
  if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: .68, ...options }));
  return materialCache.get(key);
}
function mesh(geometry, color, options) {
  const object = new THREE.Mesh(geometry, typeof color === 'string' ? material(color, options) : color);
  object.castShadow = true; object.receiveShadow = true; return object;
}
function box(parent, x, y, z, w, h, d, color) {
  const object = mesh(BOX, color); object.position.set(x, y, z); object.scale.set(w, h, d); parent.add(object); return object;
}
function ball(parent, x, y, z, rx, ry, rz, color) {
  const object = mesh(BALL, color); object.position.set(x, y, z); object.scale.set(rx, ry, rz); parent.add(object); return object;
}
function beam(parent, from, to, radius, color) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), delta = b.clone().sub(a);
  const object = mesh(CYLINDER, color);
  object.position.copy(a).add(b).multiplyScalar(.5);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  object.scale.set(radius, delta.length(), radius); parent.add(object); return object;
}
function tube(parent, points, radius, color, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), closed);
  const object = mesh(new THREE.TubeGeometry(curve, Math.max(16, points.length * 4), radius, 7, closed), color); parent.add(object); return object;
}
function batch(parent, geometry, color, transforms) {
  if (!transforms.length) return;
  const object = new THREE.InstancedMesh(geometry, material(color), transforms.length);
  const dummy = new THREE.Object3D();
  transforms.forEach((t, i) => {
    dummy.position.set(...t.position); dummy.rotation.set(...(t.rotation || [0, 0, 0])); dummy.scale.set(...(t.scale || [1, 1, 1])); dummy.updateMatrix(); object.setMatrixAt(i, dummy.matrix);
  });
  object.castShadow = true; object.receiveShadow = true; object.instanceMatrix.needsUpdate = true;
  parent.add(object); return object;
}
function roundedShape(width, depth, radius) {
  const shape = new THREE.Shape(), x = -width / 2, y = -depth / 2;
  shape.moveTo(x + radius, y); shape.lineTo(x + width - radius, y); shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + depth - radius); shape.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth);
  shape.lineTo(x + radius, y + depth); shape.quadraticCurveTo(x, y + depth, x, y + depth - radius);
  shape.lineTo(x, y + radius); shape.quadraticCurveTo(x, y, x + radius, y); return shape;
}
function ground(parent, x, z, width, depth, color, y = .035, radius = 2) {
  const object = mesh(new THREE.ShapeGeometry(roundedShape(width, depth, Math.min(radius, width / 2, depth / 2))), color);
  object.rotation.x = -Math.PI / 2; object.position.set(x, y, z); object.castShadow = false; parent.add(object); return object;
}

const DIGIT_SEGMENTS = { 0: 'abcedf', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgecd', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd' };
const SEGMENTS = {
  a: [0, .27, .26, .055], b: [.145, .14, .055, .23], c: [.145, -.14, .055, .23],
  d: [0, -.27, .26, .055], e: [-.145, -.14, .055, .23], f: [-.145, .14, .055, .23], g: [0, 0, .26, .055],
};
function numeral(parent, number, x, y, z, scale = 1) {
  const text = String(number), transforms = [];
  for (let i = 0; i < text.length; i++) {
    const offset = (i - (text.length - 1) / 2) * .44;
    for (const segment of DIGIT_SEGMENTS[text[i]]) {
      const [sx, sy, w, h] = SEGMENTS[segment];
      transforms.push({ position: [x + (sx + offset) * scale, y + sy * scale, z], scale: [w * scale, h * scale, .025] });
    }
  }
  const label = batch(parent, BOX, '#354e5b', transforms); label.name = `number ${number}`; label.userData.label = String(number); return label;
}
function cabin(number, color) {
  const group = new THREE.Group(); group.name = `Ferris wheel cabin ${number}`;
  group.userData.cabinNumber = number;
  group.userData.baseAngle = -Math.PI / 2 + (number - 1) * Math.PI * 2 / PARK.cabinCount;
  // The pin follows the wheel circle; the cabin hangs in front of the spokes.
  const body = new THREE.Group(); body.position.z = 2.6; group.add(body);
  beam(group, [0, 0, 0], [0, 0, 2.6], .095, DARK);
  ball(body, 0, 0, 0, .2, .2, .2, CREAM);
  beam(body, [-.42, -.12, 0], [-.42, -.88, 0], .065, DARK);
  beam(body, [.42, -.12, 0], [.42, -.88, 0], .065, DARK);
  box(body, 0, -2.24, 0, 2.18, .56, 1.9, color);
  box(body, 0, -2.57, 0, 2.12, .16, 1.85, CREAM);
  box(body, 0, -.84, 0, 2.34, .19, 2.04, color);
  box(body, 0, -.72, 0, 2.12, .1, 1.82, CREAM);
  const glass = mesh(BOX, material('#bde7e6', { transparent: true, opacity: .55, depthWrite: false, roughness: .25 }));
  glass.position.set(0, -1.51, 0); glass.scale.set(1.96, 1.18, 1.73); glass.castShadow = false; body.add(glass);
  const frames = [];
  for (const x of [-1.015, 1.015]) for (const z of [-.9, .9]) frames.push({ position: [x, -1.5, z], scale: [.09, 1.3, .09] });
  frames.push({ position: [0, -1.5, .93], scale: [.07, 1.28, .07] });
  batch(body, BOX, CREAM, frames);
  // A visible bench inside makes every gondola read as a little cabin.
  box(body, 0, -1.98, -.38, 1.65, .13, .55, '#fff1d2');
  box(body, 0, -1.73, -.65, 1.65, .44, .1, '#fff1d2');
  box(body, 0, -2.23, .973, 1.05, .7, .065, CREAM);
  numeral(body, number, 0, -2.22, 1.021, .92);
  return group;
}
function ferrisWheel(root) {
  const center = new THREE.Group(); center.name = 'Ferris wheel structure'; center.position.set(LOCAL_PARK.x, 0, LOCAL_PARK.z); root.add(center);
  box(center, 0, .35, 0, 22, .7, 14, '#d1d8c7');
  box(center, 0, .79, 0, 20.8, .18, 13, '#f2e5c9');
  box(center, 0, 1.05, 11, 18, 2.1, 6, '#d3ddd6');
  box(center, 0, 2.17, 11, 18.2, .14, 6.1, CREAM);
  // Broad grounded A-frames, front and rear, flank the axle.
  for (const z of [-4, 4]) {
    for (const side of [-1, 1]) {
      beam(center, [side * 8.7, .85, z], [0, PARK.hubHeight, z], .4, STEEL);
      box(center, side * 8.7, .96, z, 2.2, .4, 2.1, '#e6cfa5');
      beam(center, [side * 8.1, 2.1, z], [side * 2.2, 14.7, z], .085, CREAM);
    }
    beam(center, [-5.5, 7.6, z], [5.5, 7.6, z], .18, STEEL);
  }
  beam(center, [0, PARK.hubHeight, -4.7], [0, PARK.hubHeight, 4.7], .42, DARK);
  const rotor = new THREE.Group(); rotor.name = 'Ferris wheel rotating frame'; rotor.position.y = PARK.hubHeight; center.add(rotor);
  for (const z of [-1.65, 1.65]) {
    const rim = mesh(new THREE.TorusGeometry(PARK.radius, .2, 8, 144), CREAM); rim.position.z = z; rim.name = 'wheel rim'; rotor.add(rim);
    const inner = mesh(new THREE.TorusGeometry(PARK.radius - .48, .085, 6, 144), '#e3ba75'); inner.position.z = z; rotor.add(inner);
    for (let i = 0; i < PARK.cabinCount; i++) {
      const angle = -Math.PI / 2 + i * Math.PI * 2 / PARK.cabinCount;
      beam(rotor, [0, 0, z], [Math.cos(angle) * PARK.radius, Math.sin(angle) * PARK.radius, z], .075, i % 2 ? STEEL : '#dfc288');
    }
  }
  const cabins = [];
  for (let i = 0; i < PARK.cabinCount; i++) {
    const angle = -Math.PI / 2 + i * Math.PI * 2 / PARK.cabinCount;
    const x = Math.cos(angle) * PARK.radius, y = Math.sin(angle) * PARK.radius;
    beam(rotor, [x, y, -1.65], [x, y, 1.65], .1, DARK);
    const gondola = cabin(i + 1, PALETTE[i]); gondola.position.set(x, y, 0); rotor.add(gondola); cabins.push(gondola);
    ball(rotor, x, y, 1.87, .16, .16, .12, PALETTE[i]);
  }
  // The stationary sunshine hub stays smiling while the wheel turns behind it.
  ball(center, 0, PARK.hubHeight, 4.7, 1.68, 1.68, .35, '#ecc66a');
  ball(center, -.48, PARK.hubHeight + .3, 5.025, .11, .16, .055, DARK);
  ball(center, .48, PARK.hubHeight + .3, 5.025, .11, .16, .055, DARK);
  tube(center, [[-.65, PARK.hubHeight - .3, 5.02], [0, PARK.hubHeight - .65, 5.08], [.65, PARK.hubHeight - .3, 5.02]], .07, DARK);
  // Rails make the raised boarding platform visibly separate from walking paths.
  for (const x of [-8.7, 8.7]) {
    for (const z of [8.2, 10.8, 13.8]) beam(center, [x, 2.2, z], [x, 3.1, z], .055, STEEL);
    beam(center, [x, 3.05, 8.2], [x, 3.05, 13.8], .065, STEEL);
  }
  beam(center, [-8.7, 3.05, 13.8], [8.7, 3.05, 13.8], .065, STEEL);
  for (const x of [-8.7, -4.4, 0, 4.4, 8.7]) beam(center, [x, 2.2, 13.8], [x, 3.1, 13.8], .055, STEEL);
  return { rotor, cabins };
}

function signTexture(text) {
  // Optional lettering only: all essential counts/geometry work without a DOM.
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 160;
  const context = canvas.getContext('2d'); if (!context) return null;
  context.fillStyle = '#fff7e4'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.font = 'bold 85px "Trebuchet MS", sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = '#476d75'; context.fillText(text, 512, 86);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function entrance(root) {
  const arch = new THREE.Group(); arch.name = 'Wheel park entrance'; arch.position.set(LOCAL_PARK.entrance.x, 0, LOCAL_PARK.entrance.z); arch.rotation.y = -Math.PI / 2; root.add(arch);
  for (const side of [-1, 1]) {
    beam(arch, [side * 6.3, .1, 0], [side * 6.3, 10.4, 0], .34, STEEL);
    ball(arch, side * 6.3, 10.45, 0, .5, .5, .5, '#e5bf74');
    box(arch, side * 6.3, .34, 0, 1.05, .68, 1.05, '#e4cfac');
  }
  tube(arch, [[-6.3, 10.05, 0], [-3.6, 11.9, 0], [0, 12.55, 0], [3.6, 11.9, 0], [6.3, 10.05, 0]], .24, STEEL);
  const plate = box(arch, 0, 11.25, .02, 9.8, 1.65, .32, CREAM); plate.name = 'WHEEL PARK sign'; plate.userData.text = 'WHEEL PARK';
  const texture = signTexture('WHEEL PARK');
  if (texture) {
    const label = new THREE.Mesh(new THREE.PlaneGeometry(9.3, 1.42), new THREE.MeshBasicMaterial({ map: texture })); label.position.set(0, 11.25, .19); arch.add(label);
    const back = label.clone(); back.position.z = -.19; back.rotation.y = Math.PI; arch.add(back);
  }
  // Small colorful pennants add an unmistakable park entrance silhouette.
  for (let i = 0; i < 9; i++) {
    const shape = new THREE.Shape(); shape.moveTo(-.38, 0); shape.lineTo(.38, 0); shape.lineTo(0, -.75); shape.closePath();
    const flag = mesh(new THREE.ExtrudeGeometry(shape, { depth: .04, bevelEnabled: false }), PALETTE[i]);
    flag.position.set(-4.4 + i * 1.1, 9.98, .03); arch.add(flag);
  }
}
function bench(root, x, z, rotation) {
  const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = rotation; root.add(group);
  for (const sx of [-1.65, 1.65]) {
    box(group, sx, .55, 0, .15, 1.1, 1.08, DARK);
    box(group, sx, 1.45, -.42, .12, 1.15, .13, DARK);
  }
  for (const sz of [-.36, 0, .36]) box(group, 0, 1.05, sz, 4.25, .13, .3, '#cbaa78');
  for (const y of [1.37, 1.72, 2.07]) box(group, 0, y, -.44, 4.25, .23, .13, '#d7b888');
}
function landscaping(root) {
  // Broad pale paths meet the town at the western gate and leave an open view.
  ground(root, 232, 80, 48, 8.5, '#f1e5ce', .038, 3);
  ground(root, 249, 73, 10, 26, '#f1e5ce', .039, 3);
  ground(root, 249, 68, 34, 16, '#f5ead4', .04, 6);
  ground(root, 275, 81, 17, 14, '#ebdfc7', .038, 4);
  ground(root, 260, 86, 14, 7, '#efe2ca', .04, 3);
  const centerPath = mesh(new THREE.TorusGeometry(10.2, .14, 5, 64), '#dbcba9'); centerPath.rotation.x = Math.PI / 2; centerPath.scale.set(1.25, .54, 1); centerPath.position.set(249, .052, 68); centerPath.castShadow = false; root.add(centerPath);
  const trunks = [], leaves = [[], [], []];
  TREES.forEach(([x, z, h], i) => {
    trunks.push({ position: [x, h * .33, z], scale: [.34, h * .66, .34] });
    leaves[i % 3].push({ position: [x, h * .75, z], scale: [h * .35, h * .4, h * .35] });
    leaves[(i + 1) % 3].push({ position: [x - h * .17, h * .7, z + h * .08], scale: [h * .27, h * .31, h * .28] });
  });
  batch(root, CYLINDER, '#b29870', trunks);
  for (let i = 0; i < 3; i++) batch(root, BALL, ['#89ac7f', '#a5bf8a', '#76a18b'][i], leaves[i]);
  const hedge = [];
  for (let x = 212; x <= 284; x += 4) hedge.push({ position: [x, .75, 9.5], scale: [2.1, .9, 1.1] });
  for (let z = 14; z <= 66; z += 4) hedge.push({ position: [210, .75, z], scale: [1.1, .9, 2.1] });
  for (let z = 14; z <= 92; z += 4) hedge.push({ position: [286.5, .75, z], scale: [1.1, .9, 2.1] });
  batch(root, BALL, '#95b58b', hedge);
  const flowerStems = [], flowerCenters = [], petals = PALETTE.slice(0, 6).map(() => []);
  for (const cx of [230, 269]) {
    box(root, cx, .22, 63, 7, .44, 2, '#c4a780');
    box(root, cx, .46, 63, 6.7, .13, 1.7, '#9caa77');
    for (let i = 0; i < 12; i++) {
      const x = cx - 2.8 + (i % 6) * 1.12, z = 62.56 + Math.floor(i / 6) * .9, y = .87 + (i % 3) * .11;
      flowerStems.push({ position: [x, y / 2 + .24, z], scale: [.035, y - .4, .035] });
      flowerCenters.push({ position: [x, y, z], scale: [.13, .07, .13] });
      for (let j = 0; j < 5; j++) {
        const angle = j * Math.PI * 2 / 5;
        petals[i % 6].push({ position: [x + Math.cos(angle) * .19, y, z + Math.sin(angle) * .19], scale: [.16, .065, .14] });
      }
    }
  }
  batch(root, CYLINDER, '#6e9d6d', flowerStems); batch(root, BALL, '#edcb6e', flowerCenters);
  petals.forEach((instances, i) => batch(root, BALL, PALETTE[i], instances));
  for (const b of BENCHES) bench(root, b.x, b.z, b.rotation);
  // A striped picnic table and a tiny parasol form a quiet corner of the park.
  const picnic = new THREE.Group(); picnic.position.set(275.5, 0, 80.1); root.add(picnic);
  for (const x of [-1.7, 1.7]) beam(picnic, [x, 0, -.75], [x, 1.55, .75], .15, '#9e866a');
  box(picnic, 0, 1.6, 0, 5.7, .2, 2.5, '#d2b58c');
  for (const z of [-1.8, 1.8]) {
    box(picnic, 0, .88, z, 5.7, .16, .7, '#bd9f78');
    for (const x of [-1.8, 1.8]) box(picnic, x, .4, z, .16, .8, .5, '#9e866a');
  }
  beam(picnic, [0, 0, 0], [0, 5.2, 0], .075, CREAM);
  const parasol = mesh(new THREE.ConeGeometry(3.25, 1.15, 12, 1, true), '#da98a8'); parasol.position.y = 4.85; picnic.add(parasol);
  ball(picnic, 0, 5.48, 0, .14, .16, .14, CREAM);
  // Little floor inlays invite counting without adding obstacles to the path.
  for (let i = 0; i < 6; i++) {
    const tile = ground(root, 228 + i * 3.3, 80, 1.4, 1.4, PALETTE[i], .052, .23); tile.userData.walkable = true;
  }
}

/** A self-contained park. Time is absolute elapsed seconds, in either direction. */
export function createPark() {
  const root = new THREE.Group(); root.name = 'Wheel park';
  root.position.set(PARK_OFFSET.x, 0, PARK_OFFSET.z);
  landscaping(root); entrance(root);
  const { rotor, cabins } = ferrisWheel(root);
  function update(time = 0) {
    const phase = Number.isFinite(time) ? time * PARK.speed : 0;
    rotor.rotation.z = phase;
    for (const gondola of cabins) gondola.rotation.z = -phase;
  }
  update(0);
  return { root, update, cabinCount: PARK.cabinCount };
}
