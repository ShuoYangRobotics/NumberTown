import * as THREE from './vendor/three.module.js';
import { WORLD, MOUNTAINS } from './geography.js';

const TAU = Math.PI * 2;
const freeze = value => Object.freeze(value);
// The scenery was authored as one park. A shared translation keeps its many
// animal parts, buildings, collisions and public map coordinates together.
export const TRAIN_PARK_OFFSET = freeze({ x: 200, z: 0 });
export const TRAIN_PARK = freeze({
  x: 635 + TRAIN_PARK_OFFSET.x, z: 215, rx: 150, rz: 108, gauge: 2.6, speed: 12,
  carriageSpacing: 7.2, boardingDistance: 11,
  bounds: freeze({ minX: 450 + TRAIN_PARK_OFFSET.x, maxX: 820 + TRAIN_PARK_OFFSET.x, minZ: 78, maxZ: 355 }),
  entrance: freeze({ x: 465 + TRAIN_PARK_OFFSET.x, z: 215 }),
  station: freeze({ x: 485 + TRAIN_PARK_OFFSET.x, z: 215 }),
});
export const TRAIN_LANDMARK = freeze({
  id: 'train-park', name: 'Train park',
  description: 'Ride through the desert, rainforest, snowy mountains and friendly farms.',
  x: TRAIN_PARK.station.x, z: TRAIN_PARK.station.z, radius: 33, arrival: freeze({ x: 478 + TRAIN_PARK_OFFSET.x, z: 215 }),
});
export const TRAIN_ZONES = freeze([
  freeze({ id: 'desert', name: 'Sunshine Desert', x: 566, z: 163, rx: 48, rz: 35, color: '#efd296' }),
  freeze({ id: 'rainforest', name: 'Rainbow Rainforest', x: 700, z: 163, rx: 48, rz: 35, color: '#8fbd83' }),
  freeze({ id: 'snow', name: 'Snowy Peaks', x: 700, z: 268, rx: 48, rz: 35, color: '#dfeced' }),
  freeze({ id: 'farm', name: 'Little Meadow Farm', x: 566, z: 268, rx: 48, rz: 35, color: '#b9d48b' }),
].map(zone=>freeze({...zone,x:zone.x+TRAIN_PARK_OFFSET.x})));

// The progress coordinate measures distance, not ellipse angle. This keeps the
// locomotive's speed uniform on both the broad bends and the long sides.
const ARC_STEPS = 4096;
const ARC = new Float64Array(ARC_STEPS + 1);
let lastX = -TRAIN_PARK.rx, lastZ = 0;
for (let i = 1; i <= ARC_STEPS; i++) {
  const angle = Math.PI + TAU * i / ARC_STEPS;
  const x = TRAIN_PARK.rx * Math.cos(angle), z = TRAIN_PARK.rz * Math.sin(angle);
  ARC[i] = ARC[i - 1] + Math.hypot(x - lastX, z - lastZ);
  lastX = x; lastZ = z;
}
export const TRAIN_TRACK_LENGTH = ARC[ARC_STEPS];
const wrap = value => ((value % 1) + 1) % 1;
function trackAngle(progress) {
  const distance = wrap(Number.isFinite(progress) ? progress : 0) * TRAIN_TRACK_LENGTH;
  let lo = 0, hi = ARC_STEPS;
  while (hi - lo > 1) { const mid = (lo + hi) >>> 1; if (ARC[mid] > distance) hi = mid; else lo = mid; }
  return Math.PI + TAU * (lo + (distance - ARC[lo]) / (ARC[hi] - ARC[lo])) / ARC_STEPS;
}
export function trainPose(progressOrState = 0) {
  const raw = typeof progressOrState === 'number' ? progressOrState : progressOrState?.progress;
  const progress = wrap(Number.isFinite(raw) ? raw : 0);
  const angle = trackAngle(progress), c = Math.cos(angle), s = Math.sin(angle);
  const dx = -TRAIN_PARK.rx * s, dz = TRAIN_PARK.rz * c, length = Math.hypot(dx, dz);
  return { x: TRAIN_PARK.x + TRAIN_PARK.rx * c, y: 0, z: TRAIN_PARK.z + TRAIN_PARK.rz * s,
    yaw: Math.atan2(dx, dz), progress, outward: { x: dz / length, z: -dx / length } };
}
function sceneryPose(progress) {
  const pose=trainPose(progress);
  return {...pose,x:pose.x-TRAIN_PARK_OFFSET.x,z:pose.z-TRAIN_PARK_OFFSET.z};
}

const TREES = [
  [679, 145, 12, 'jungle'], [694, 139, 15, 'jungle'], [718, 150, 13, 'jungle'], [730, 170, 12, 'jungle'],
  [680, 182, 11, 'jungle'], [707, 188, 14, 'jungle'], [726, 187, 10, 'jungle'],
  [678, 286, 9, 'pine'], [691, 293, 8, 'pine'], [724, 284, 11, 'pine'], [734, 268, 9, 'pine'],
  [533, 277, 8, 'orchard'], [539, 290, 8, 'orchard'], [553, 297, 7, 'orchard'],
];
const ROCKS = [[542, 149, 3.5], [579, 140, 2.3], [593, 181, 3], [673, 154, 2], [731, 163, 2.3], [711, 287, 2.1]];
const PEAKS = [[693, 246, 10, 20], [710, 251, 12, 27], [725, 250, 8, 18]];
export const TRAIN_OBSTACLES = freeze([
  ...[187, 243].map(z => freeze({ id: `railway-entrance-${z}`, kind: 'pole', x: 465, z, radius: .3 })),
  freeze({ id: 'railway-ticket-house', kind: 'building', x: 453, z: 168, w: 13, d: 14 }),
  freeze({ id: 'railway-farm-barn', kind: 'building', x: 561, z: 244, w: 19, d: 14 }),
  ...TREES.map(([x, z], i) => freeze({ id: `railway-tree-${i}`, kind: 'tree', x, z, radius: .7 })),
  ...ROCKS.map(([x, z, radius], i) => freeze({ id: `railway-rock-${i}`, kind: 'rock', x, z, radius })),
  ...PEAKS.map(([x, z, radius], i) => freeze({ id: `railway-peak-${i}`, kind: 'rock', x, z, radius })),
].map(obstacle=>freeze({...obstacle,x:obstacle.x+TRAIN_PARK_OFFSET.x})));
function blocked(x, z, radius) {
  if(x-radius<(WORLD.minX??0)+WORLD.margin||x+radius>WORLD.width-WORLD.margin||z-radius<MOUNTAINS.maxZ+.05||z+radius>WORLD.depth-WORLD.margin)return true;
  return TRAIN_OBSTACLES.some(obstacle => {
    if (obstacle.radius != null) return Math.hypot(x - obstacle.x, z - obstacle.z) < radius + obstacle.radius;
    const dx = Math.max(obstacle.x - x, 0, x - obstacle.x - obstacle.w);
    const dz = Math.max(obstacle.z - z, 0, z - obstacle.z - obstacle.d);
    return Math.hypot(dx, dz) < radius;
  });
}
export function createTrainState() {
  return { rider: null, riderRadius: 1.2, progress: 0, distance: 0, motionTime: 0, speed: 0 };
}
export function boardingPoint(state) {
  const pose = trainPose(state), radius = Math.max(.4, Number.isFinite(state?.riderRadius) ? state.riderRadius : 1.2);
  const offset = Math.max(7, radius + 3.8);
  // Scenery stays inside the loop, with a small ticket house well outside it.
  // Search locally for unusually wide rearrangements near that house.
  for (const extra of [0, 2, 4, 6, 8]) {
    for (const along of [0, 3, -3, 6, -6, 9, -9, 12, -12, 15, -15, 18, -18, 21, -21, 24, -24]) {
      const x = pose.x + pose.outward.x * (offset + extra) - pose.outward.z * along;
      const z = pose.z + pose.outward.z * (offset + extra) + pose.outward.x * along;
      if (!blocked(x, z, radius)) return { x, z };
    }
  }
  // A fifty-wide body cannot fit between the northern rail and the mountains.
  // Step off beside a nearby bend where the outside verge becomes wider.
  for(let distance=12;distance<=96;distance+=6)for(const direction of [-1,1]){
    const nearby=trainPose(pose.progress+direction*distance/TRAIN_TRACK_LENGTH);
    for(const extra of [0,2,4]){
      const point={x:nearby.x+nearby.outward.x*(offset+extra),z:nearby.z+nearby.outward.z*(offset+extra)};
      if(Math.hypot(point.x-pose.x,point.z-pose.z)<=radius+64&&!blocked(point.x,point.z,radius))return point;
    }
  }
  return { x: pose.x + pose.outward.x * (offset + 10), z: pose.z + pose.outward.z * (offset + 10) };
}
export function boardTrain(state, player) {
  if (!state || state.rider !== null || !player || !Number.isInteger(player.number) || player.number < 0 || !Number.isFinite(player.x) || !Number.isFinite(player.z)) return false;
  const radius = Math.max(.4, Number.isFinite(player.radius) ? player.radius : 1.2);
  const point = boardingPoint({ ...state, riderRadius: radius });
  const previousPoint = boardingPoint(state);
  if (Math.min(Math.hypot(player.x - point.x, player.z - point.z), Math.hypot(player.x - previousPoint.x, player.z - previousPoint.z)) > TRAIN_PARK.boardingDistance) return false;
  state.rider = player.number; state.riderRadius = radius; state.speed = 0;
  return true;
}
export function leaveTrain(state) {
  if (!state || state.rider === null) return null;
  const point = boardingPoint(state); state.rider = null; state.speed = 0; return point;
}
export function stepTrain(state, dt, boost = false) {
  if (!state || state.rider === null) { if (state) state.speed = 0; return; }
  if (!Number.isFinite(dt) || dt <= 0) return;
  const speed = TRAIN_PARK.speed * (boost ? 2 : 1), distance = dt * speed;
  if (!Number.isFinite(distance)) return;
  state.progress = wrap(state.progress + distance / TRAIN_TRACK_LENGTH);
  state.distance += distance; state.motionTime += dt * (boost ? 2 : 1); state.speed = speed;
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const BALL = new THREE.SphereGeometry(1, 12, 8);
const CYLINDER = new THREE.CylinderGeometry(1, 1, 1, 12);
const CONE = new THREE.ConeGeometry(1, 1, 7);
const Y = new THREE.Vector3(0, 1, 0);
const MATERIALS = new Map();
function material(color, options = {}) {
  const key = color + JSON.stringify(options);
  if (!MATERIALS.has(key)) MATERIALS.set(key, new THREE.MeshStandardMaterial({ color, roughness: .75, ...options }));
  return MATERIALS.get(key);
}
function mesh(parent, geometry, color, name = '') {
  const object = new THREE.Mesh(geometry, typeof color === 'string' ? material(color) : color);
  object.name = name; object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
}
function box(parent, x, y, z, w, h, d, color, name = '') {
  const object = mesh(parent, BOX, color, name); object.position.set(x, y, z); object.scale.set(w, h, d); return object;
}
function sphere(parent, x, y, z, rx, ry, rz, color, name = '') {
  const object = mesh(parent, BALL, color, name); object.position.set(x, y, z); object.scale.set(rx, ry, rz); return object;
}
function cylinder(parent, x, y, z, radius, height, color, name = '') {
  const object = mesh(parent, CYLINDER, color, name); object.position.set(x, y, z); object.scale.set(radius, height, radius); return object;
}
// Shared batches retain an instance's semantic feature and animal ID for picking
// and audits, without making hundreds of tiny eyes, leaves and ties draw calls.
function staticBuilder(root) {
  const groups = new Map(), dummy = new THREE.Object3D();
  function part(geometry, color, position, scale, rotation = [0, 0, 0], metadata = {}) {
    const key = `${geometry.uuid}:${color}`;
    if (!groups.has(key)) groups.set(key, { geometry, color, instances: [] });
    dummy.position.set(...position); dummy.rotation.set(rotation[0] || 0, rotation[1] || 0, rotation[2] || 0); dummy.scale.set(...scale); dummy.updateMatrix();
    groups.get(key).instances.push({ matrix: dummy.matrix.clone(), ...metadata });
  }
  function beam(color, a, b, radius, metadata = {}) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), delta = to.clone().sub(from);
    dummy.position.copy(from).add(to).multiplyScalar(.5); dummy.quaternion.setFromUnitVectors(Y, delta.clone().normalize()); dummy.scale.set(radius, delta.length(), radius); dummy.updateMatrix();
    const key = `${CYLINDER.uuid}:${color}`;
    if (!groups.has(key)) groups.set(key, { geometry: CYLINDER, color, instances: [] });
    groups.get(key).instances.push({ matrix: dummy.matrix.clone(), ...metadata });
  }
  return { part, beam, flush() {
    for (const { geometry, color, instances } of groups.values()) {
      const object = new THREE.InstancedMesh(geometry, material(color), instances.length);
      object.name = `Railway scenery ${geometry.type} ${color}`;
      object.userData.parts = instances.map(({ matrix, ...metadata }) => metadata);
      instances.forEach(({ matrix }, i) => object.setMatrixAt(i, matrix));
      object.castShadow = true; object.receiveShadow = true; object.instanceMatrix.needsUpdate = true; root.add(object);
    }
  } };
}
function ellipsePatch(root, x, z, rx, rz, color, name, y = .027) {
  const object = mesh(root, new THREE.CircleGeometry(1, 64), color, name);
  object.rotation.x = -Math.PI / 2; object.scale.set(rx, rz, 1); object.position.set(x, y, z); object.castShadow = false; return object;
}
function textSign(root, text, x, y, z, width, rotation = 0) {
  const sign = new THREE.Group(); sign.name = text; sign.position.set(x, y, z); sign.rotation.y = rotation; root.add(sign);
  box(sign, 0, 0, 0, width, 2.05, .28, '#fff1ce');
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 192;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#fff1ce'; ctx.fillRect(0, 0, 1024, 192); ctx.fillStyle = '#365f63';
      ctx.font = 'bold 90px Trebuchet MS, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 101, 970);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const face = mesh(sign, new THREE.PlaneGeometry(width - .35, 1.75), new THREE.MeshBasicMaterial({ map: texture }), 'sign lettering'); face.position.z = .151;
    }
  }
  return sign;
}
function ribbon(root, halfWidth, y, color, name) {
  const positions = [], indices = [];
  for (let i = 0; i <= 512; i++) {
    const p = sceneryPose(i / 512);
    for (const side of [-1, 1]) positions.push(p.x + p.outward.x * halfWidth * side, y, p.z + p.outward.z * halfWidth * side);
    if (i < 512) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  const object = mesh(root, geometry, color, name); object.castShadow = false; return object;
}
function railway(root, batch) {
  ribbon(root, 4.7, .016, '#cfdbc2', 'Clear railway verge');
  ribbon(root, 2.45, .036, '#b9afa0', 'Track ballast');
  const tieCount = Math.ceil(TRAIN_TRACK_LENGTH / 1.85);
  for (let i = 0; i < tieCount; i++) {
    const p = sceneryPose(i / tieCount);
    batch.part(BOX, '#8d7760', [p.x, .095, p.z], [4.05, .14, .3], [0, p.yaw, 0], { feature: 'railway tie' });
  }
  for (const side of [-1, 1]) {
    const points = [];
    for (let i = 0; i < 512; i++) {
      const p = sceneryPose(i / 512); points.push(new THREE.Vector3(p.x + p.outward.x * TRAIN_PARK.gauge / 2 * side, .225, p.z + p.outward.z * TRAIN_PARK.gauge / 2 * side));
    }
    const curve = new THREE.CatmullRomCurve3(points, true);
    mesh(root, new THREE.TubeGeometry(curve, 1024, .083, 6, true), material('#a7bbbf', { metalness: .6, roughness: .36 }), side < 0 ? 'Inner steel rail' : 'Outer steel rail');
  }
  // Each path meets the rails on a level timber crossing, never on a fence.
  box(root, 494, .02, 215, 41, .04, 12, '#e6d6b5', 'Station walking path');
  box(root, 635, .022, 215, 260, .04, 11, '#e6d6b5', 'Four landscapes promenade');
  box(root, 635, .022, 215, 11, .04, 154, '#e6d6b5', 'Garden crosswalk');
  for (const z of [210, 212, 214, 216, 218, 220]) batch.part(BOX, '#dfbd85', [485, .24, z], [5, .12, 1.65], [], { feature: 'station crossing' });
}
function station(root, batch) {
  const group = new THREE.Group(); group.name = 'Adventure railway station'; root.add(group);
  box(group, 477, .09, 215, 10, .18, 52, '#e4d4ae', 'Station platform');
  // Tactile platform edge and open boarding gap are flush enough to walk over.
  for (let z = 191; z <= 239; z += 2) batch.part(BOX, '#f3c65c', [481.1, .19, z], [.6, .06, 1.3], [], { feature: 'platform edge' });
  box(group, 459.5, 3.9, 175, 13, 7.8, 14, '#efc096', 'Ticket house');
  const roof = mesh(group, new THREE.ConeGeometry(11, 4.2, 4), '#467b79', 'Station roof'); roof.position.set(459.5, 9.9, 175); roof.rotation.y = Math.PI / 4; roof.scale.z = 1.05;
  box(group, 459.5, 2.4, 182.07, 3.3, 4.8, .12, '#4c7777', 'Station door');
  for (const x of [455.8, 463.2]) box(group, x, 4.8, 182.13, 2.5, 2.8, .14, '#c5e3dd', 'Station window');
  textSign(group, 'ADVENTURE RAILWAY', 459.5, 7, 182.2, 12);
  // The gate is offset from the train's outer lane and the road remains broad.
  for (const z of [187, 243]) {
    batch.beam('#538d89', [465, 0, z], [465, 11.4, z], .24, { feature: 'entrance post' });
    batch.part(BALL, '#f1c465', [465, 11.5, z], [.55, .55, .55]);
  }
  const sign = textSign(group, 'FOUR WORLDS EXPRESS', 465, 11.4, 215, 56, -Math.PI / 2); sign.userData.entrance = true;
  textSign(group, 'ALL ABOARD!', 477, 3.9, 188.5, 8.5);
  for (const z of [195, 235]) {
    batch.part(BOX, '#467b79', [474, .8, z], [1.1, .2, 4]);
    batch.part(BOX, '#467b79', [473.5, 1.55, z], [.18, 1.3, 4]);
    for (const offset of [-1.5, 1.5]) batch.part(BOX, '#8d7760', [474, .4, z + offset], [.2, .8, .22]);
  }
}
function scenery(root, batch) {
  const colors = { sand: '#d8ab70', cactus: '#78a77e', bark: '#8d7760', leaf: '#548d64', pale: '#dbe6dc' };
  for (const zone of TRAIN_ZONES) {
    const x=zone.x-TRAIN_PARK_OFFSET.x;
    ellipsePatch(root, x, zone.z, zone.rx, zone.rz, zone.color, `${zone.name} landscape`);
    const labelZ = zone.z < 215 ? 200 : 230;
    textSign(root, zone.name, x, 3.7, labelZ, 15);
    for (const dx of [-5.8, 5.8]) batch.beam(colors.bark, [x + dx, 0, labelZ], [x + dx, 3.4, labelZ], .12);
  }
  for (const [x, z, radius] of ROCKS) batch.part(BALL, colors.sand, [x, radius * .45, z], [radius, radius * .8, radius * .72], [0, x, .12]);
  for (const [x, z, radius, height] of PEAKS) {
    batch.part(CONE, '#92a6af', [x, height / 2, z], [radius, height, radius], [0, .18, 0], { feature: 'snow mountain' });
    batch.part(CONE, '#f4f8ee', [x, height * .825, z], [radius * .35 + .05, height * .35, radius * .35 + .05], [0, .18, 0], { feature: 'snow cap' });
  }
  for (const [x, z, height, type] of TREES) {
    batch.beam(colors.bark, [x, 0, z], [x, height * .76, z], .55, { feature: `${type} trunk` });
    if (type === 'pine') {
      for (let tier = 0; tier < 3; tier++) {
        batch.part(CONE, '#7da897', [x, height * (.45 + tier * .18), z], [3.3 - tier * .55, height * .6, 3.3 - tier * .55]);
        batch.part(CONE, '#f4f8ee', [x, height * (.59 + tier * .18), z], [1.85 - tier * .3, height * .32, 1.85 - tier * .3]);
      }
    } else {
      for (const [dx, dy, dz] of [[0, 0, 0], [-2, -1, 1], [2, -.6, -.6]]) batch.part(BALL, colors.leaf, [x + dx, height + dy, z + dz], [3.9, 2.8, 3.8]);
      if (type === 'jungle') {
        for (let vine = 0; vine < 3; vine++) batch.beam('#a4c27d', [x - 2 + vine * 1.8, height - 1.5, z + 1], [x - 1.2 + vine * 1.8, 3 + vine, z + 1.3], .09, { feature: 'hanging vine' });
      } else for (let a = 0; a < 7; a++) batch.part(BALL, '#de795e', [x + Math.cos(a * 2.4) * 3.1, height + Math.sin(a * 2.4), z + Math.sin(a * 2.4) * 3], [.34, .34, .34], [], { feature: 'orchard apple' });
    }
  }
  for (const [x, z, height] of [[548, 165, 6], [586, 154, 7.5], [562, 184, 5], [600, 163, 4.5]]) {
    batch.beam(colors.cactus, [x, 0, z], [x, height, z], .62, { feature: 'cactus' });
    for (const side of [-1, 1]) {
      batch.beam(colors.cactus, [x, height * .42, z], [x + side * 1.7, height * .42, z], .42);
      batch.beam(colors.cactus, [x + side * 1.7, height * .42, z], [x + side * 1.7, height * .75, z], .42);
      batch.part(BALL, '#edb18a', [x + side * 1.7, height * .76, z], [.55, .2, .55]);
    }
  }
  ellipsePatch(root, 695, 169, 12, 7, '#70b4b0', 'Rainforest pool', .06);
  for (const [x, z] of [[680, 174], [715, 174], [717, 146], [687, 191]]) {
    for (let i = 0; i < 5; i++) {
      const angle = i * TAU / 5;
      batch.part(BALL, '#79a96d', [x + Math.sin(angle), .8, z + Math.cos(angle)], [.55, .25, 2.3], [0, angle, .3], { feature: 'rainforest fern' });
      batch.part(BALL, '#ea9c7e', [x + Math.sin(angle) * 1.3, 1.3, z + Math.cos(angle) * 1.3], [.4, .45, .4]);
    }
  }
  const barn = new THREE.Group(); barn.name = 'Meadow farm barn'; root.add(barn);
  box(barn, 570.5, 4, 251, 19, 8, 14, '#d88173');
  box(barn, 570.5, 3, 258.08, 6, 6, .18, '#f3e4c3');
  box(barn, 570.5, 2.8, 258.2, .16, 5.6, .12, '#bd6b61');
  const roof = mesh(barn, new THREE.CylinderGeometry(1, 1, 1, 3).rotateY(Math.PI / 2), '#756e81', 'Barn pitched roof'); roof.rotation.z = Math.PI / 2; roof.position.set(570.5, 9.2, 251); roof.scale.set(2.33, 21, 9.1);
  textSign(barn, 'LITTLE MEADOW', 570.5, 6.8, 258.3, 13);
  for (let row = 0; row < 5; row++) {
    const z = 284 + row * 2.6;
    batch.part(BOX, '#ad956e', [585, .045, z], [21, .07, 1.7], [], { feature: 'vegetable bed' });
    for (let col = 0; col < 9; col++) {
      const x = 576 + col * 2.3;
      batch.part(BALL, '#7da160', [x, .4, z], [.65, .55, .55], [], { feature: 'farm crop' });
      if (row % 2 === 0) batch.part(BALL, '#e3a46a', [x, .3, z + .35], [.35, .3, .35]);
    }
  }
  for (const x of [548, 553, 558]) batch.part(CYLINDER, '#e6c778', [x, 1, 245], [1.1, 2, 1.1], [0, 0, Math.PI / 2], { feature: 'hay bale' });
  // Low decorative fences run along crops, leaving broad open approaches.
  for (const z of [281, 299]) {
    for (let x = 573; x <= 599; x += 3.25) batch.part(BOX, '#f1e9ce', [x, .95, z], [.22, 1.9, .22]);
    for (const y of [.65, 1.45]) batch.part(BOX, '#f1e9ce', [586, y, z], [26, .18, .14]);
  }
  ellipsePatch(root, 635, 215, 12, 12, '#eddcb9', 'Four worlds central garden', .04);
  for (let i = 0; i < 20; i++) {
    const a = i * TAU / 20;
    batch.part(BALL, ['#e6ab92', '#e5c879', '#a99ac9'][i % 3], [635 + Math.cos(a) * 10, .45, 215 + Math.sin(a) * 10], [.6, .55, .6], [], { feature: 'garden flower' });
  }
}

const ANIMAL_DEFINITIONS = [
  ['camel', 533, 144, .5, 1.4], ['camel', 576, 173, -1.1, 1.2],
  ['meerkat', 542, 178, .5, 1], ['meerkat', 546, 181, -.25, .9], ['meerkat', 550, 178, -.8, 1.1],
  ['monkey', 682, 160, -.5, 1.2], ['monkey', 714, 182, .8, 1.1],
  ['toucan', 737, 144, 1, 1.1], ['toucan', 725, 177, -1.2, 1],
  ['mountain-goat', 688, 270, .8, 1.3], ['mountain-goat', 716, 273, -.7, 1.1],
  ['arctic-fox', 737, 286, -1.2, 1.2], ['arctic-fox', 684, 281, .3, 1],
  ['cow', 548, 265, .8, 1.4], ['cow', 558, 277, -.6, 1.2],
  ['sheep', 586, 267, .8, 1.1], ['sheep', 594, 271, -.5, 1], ['sheep', 533, 286, 1.2, .9],
  ['pig', 545, 288, -.7, 1.2], ['pig', 555, 290, .6, 1],
];
function animals(batch) {
  return ANIMAL_DEFINITIONS.map(([species, x, z, yaw, scale], index) => {
    const id = `railway-${species}-${index + 1}`, c = Math.cos(yaw), s = Math.sin(yaw), features = new Set();
    const perched = species === 'toucan', ground = perched ? 3.5 : 0;
    const place = p => [x + (p[0] * c + p[2] * s) * scale, ground + p[1] * scale, z + (-p[0] * s + p[2] * c) * scale];
    const part = (geometry, color, p, size, feature, rotation = [0, 0, 0]) => {
      features.add(feature); batch.part(geometry, color, place(p), size.map(v => v * scale), [rotation[0], rotation[1] + yaw, rotation[2]], { animalId: id, species, feature });
    };
    const ball = (color, p, size, feature) => part(BALL, color, p, size, feature);
    const beam = (color, a, b, radius, feature) => { features.add(feature); batch.beam(color, place(a), place(b), radius * scale, { animalId: id, species, feature }); };
    const eyes = (y, front, spread = .33) => { for (const side of [-1, 1]) ball('#344b50', [side * spread, y, front], [.1, .13, .08], 'eyes'); };
    const legs = (color, y, length = 1.05, width = .65, front = 1.05) => {
      for (const xx of [-width, width]) for (const zz of [-front, front]) {
        beam(color, [xx, .25, zz], [xx, y, zz], .18, 'four legs');
        ball('#5f6158', [xx, .14, zz + .1], [.24, .15, .3], 'hooves');
      }
    };
    if (species === 'camel') {
      ball('#d7ad70', [0, 2.3, 0], [1.05, .85, 1.9], 'long camel body'); legs('#d7ad70', 2.2, 1, .65, 1.2);
      ball('#c99a60', [0, 3.04, -.45], [.8, .8, 1], 'camel hump');
      beam('#d7ad70', [0, 2.6, 1.4], [0, 4.2, 1.9], .4, 'long neck');
      ball('#d7ad70', [0, 4.45, 2.05], [.55, .5, .85], 'camel head');
      ball('#e2c18d', [0, 4.28, 2.65], [.46, .3, .5], 'camel muzzle');
      for (const side of [-1, 1]) ball('#c99a60', [side * .43, 4.9, 1.9], [.18, .38, .15], 'ears');
      eyes(4.58, 2.65); beam('#c99a60', [0, 2.5, -1.8], [.2, 1.3, -2.2], .1, 'tail');
    } else if (species === 'meerkat') {
      ball('#bd9567', [0, 1.2, 0], [.52, 1.05, .46], 'upright meerkat');
      ball('#e6cda1', [0, 1.15, .32], [.35, .78, .15], 'pale belly');
      ball('#bd9567', [0, 2.3, 0], [.56, .5, .5], 'head');
      for (const side of [-1, 1]) { ball('#bd9567', [side * .53, 2.5, 0], [.19, .22, .15], 'ears'); ball('#6e6657', [side * .22, 2.4, .4], [.2, .17, .11], 'dark eye patches'); beam('#bd9567', [side * .45, 1.9, .05], [side * .35, 1.2, .4], .12, 'little arms'); }
      eyes(2.41, .5, .22); ball('#4b5552', [0, 2.16, .55], [.12, .1, .1], 'nose');
      for (const side of [-1, 1]) ball('#bd9567', [side * .3, .13, .25], [.25, .14, .4], 'feet');
      beam('#bd9567', [0, .7, -.3], [.4, .12, -1.2], .13, 'long tail');
    } else if (species === 'monkey') {
      ball('#8f6b54', [0, 1.3, 0], [.75, .95, .55], 'monkey body');
      ball('#dac09a', [0, 1.3, .43], [.5, .65, .18], 'pale belly');
      ball('#8f6b54', [0, 2.5, .05], [.8, .75, .65], 'head');
      for (const side of [-1, 1]) { ball('#8f6b54', [side * .83, 2.5, .05], [.38, .4, .2], 'round monkey ears'); ball('#dac09a', [side * .85, 2.5, .22], [.24, .25, .08], 'inner ears'); beam('#8f6b54', [side * .6, 1.9, 0], [side * 1.1, .4, .3], .17, 'long arms'); ball('#8f6b54', [side * .45, .2, .35], [.3, .22, .5], 'feet'); }
      ball('#dac09a', [0, 2.45, .56], [.61, .53, .16], 'monkey face'); eyes(2.6, .71);
      ball('#745847', [0, 2.2, .76], [.17, .11, .09], 'nose');
      const tail = [[0, .8, -.4], [.4, .6, -1.3], [1.3, .9, -1.6], [1.7, 1.8, -1.3], [1.2, 2, -1.1]];
      for (let i = 1; i < tail.length; i++) beam('#8f6b54', tail[i - 1], tail[i], .12, 'curled monkey tail');
    } else if (species === 'toucan') {
      beam('#8d7760', [-1.7, -3.2, -.15], [-1.7, 0, -.15], .22, 'perch trunk');
      beam('#8d7760', [-1.7, -.1, -.15], [1.5, -.1, -.15], .18, 'perch branch');
      ball('#344b50', [0, .95, 0], [.6, .85, .62], 'toucan black body');
      ball('#f2e8c6', [0, 1.1, .48], [.43, .61, .16], 'white chest');
      ball('#344b50', [0, 1.95, .14], [.53, .56, .5], 'head');
      ball('#edbd63', [0, 1.95, 1.05], [.35, .33, .88], 'large golden beak');
      ball('#df8c60', [0, 1.97, 1.71], [.3, .29, .3], 'orange beak tip');
      for (const side of [-1, 1]) { ball('#5c7b80', [side * .5, .9, -.12], [.18, .55, .48], 'wings'); ball('#70b8b3', [side * .43, 2.03, .47], [.16, .21, .1], 'blue eye ring'); }
      eyes(2.03, .55, .43); part(CONE, '#344b50', [0, .35, -.6], [.35, 1.3, .35], 'tail feathers', [Math.PI / 3, 0, 0]);
      for (const side of [-1, 1]) beam('#e2ac63', [side * .22, .28, .1], [side * .22, -.05, .2], .09, 'bird feet');
    } else if (species === 'mountain-goat' || species === 'cow') {
      const cow = species === 'cow', body = cow ? '#f1e8cc' : '#e1dfcf';
      ball(body, [0, 1.5, 0], [cow ? 1 : .75, cow ? .9 : .7, 1.45], cow ? 'cow body' : 'goat body'); legs(body, 1.45, 1, cow ? .7 : .5, .95);
      ball(body, [0, 2, 1.45], [.65, .65, .7], 'head');
      ball(cow ? '#e1a7a1' : '#c1c8bd', [0, 1.7, 2], [.58, .4, .28], cow ? 'pink cow muzzle' : 'goat muzzle'); eyes(2.2, 1.97, .36);
      for (const side of [-1, 1]) {
        ball(body, [side * .7, 2.2, 1.4], [.4, .18, .2], 'ears');
        beam('#aa9473', [side * .36, 2.5, 1.25], [side * .52, cow ? 2.95 : 3.35, cow ? 1.3 : .65], .12, cow ? 'cow horns' : 'curved goat horns');
        if (!cow) beam('#aa9473', [side * .52, 3.35, .65], [side * .56, 3.2, .3], .09, 'curved goat horns');
      }
      if (cow) {
        for (const [xx, yy, zz] of [[.82, 1.7, -.4], [-.78, 1.6, .3], [.45, 2.23, .4]]) ball('#53605a', [xx, yy, zz], [.28, .4, .48], 'cow patches');
        ball('#e1a7a1', [0, .8, -.1], [.4, .3, .5], 'udder');
      } else part(CONE, '#f1e8cc', [0, 1.2, 1.85], [.2, .7, .2], 'goat beard', [Math.PI, 0, 0]);
      beam(body, [0, 1.6, -1.3], [.3, 1.2, -1.9], .12, 'tail');
    } else if (species === 'arctic-fox') {
      ball('#f4f8ee', [0, 1, 0], [.62, .53, 1.15], 'arctic fox body');
      for (const xx of [-.4, .4]) for (const zz of [-.7, .7]) beam('#e1e8df', [xx, .15, zz], [xx, .95, zz], .14, 'four paws');
      ball('#f4f8ee', [0, 1.45, 1], [.57, .51, .62], 'fox head');
      for (const side of [-1, 1]) { part(CONE, '#f4f8ee', [side * .38, 2.02, .9], [.26, .75, .25], 'pointed fox ears'); part(CONE, '#c2cbd0', [side * .38, 2.05, 1.04], [.14, .4, .1], 'inner ears'); }
      ball('#e1e8df', [0, 1.25, 1.57], [.31, .27, .44], 'pointed muzzle'); ball('#344b50', [0, 1.3, 1.96], [.12, .11, .1], 'black nose'); eyes(1.6, 1.49, .3);
      ball('#e1e8df', [.3, .8, -1.55], [.5, .43, 1.1], 'bushy fox tail'); ball('#f4f8ee', [.3, .8, -2.35], [.33, .32, .4], 'white tail tip');
    } else if (species === 'sheep') {
      for (let i = 0; i < 9; i++) { const a = i * 2.4; ball('#f2eddb', [Math.sin(a) * .46, 1.24 + Math.cos(a) * .25, (i / 8 - .5) * 1.6], [.61, .62, .63], 'fluffy wool'); }
      legs('#626c66', 1.15, 1, .4, .65); ball('#626c66', [0, 1.4, 1.15], [.5, .57, .48], 'dark sheep face');
      for (const side of [-1, 1]) ball('#626c66', [side * .6, 1.65, 1.1], [.34, .15, .19], 'ears');
      for (const side of [-1, 1]) ball('#f4f8ee', [side * .23, 1.55, 1.56], [.1, .13, .08], 'eyes');
    } else if (species === 'pig') {
      ball('#e9ada8', [0, 1, 0], [.8, .66, 1.2], 'round pig body');
      legs('#d99595', .9, 1, .5, .7); ball('#e9ada8', [0, 1.2, 1.1], [.66, .57, .6], 'pig head');
      ball('#d98f95', [0, 1.08, 1.66], [.4, .26, .18], 'round pink snout');
      for (const side of [-1, 1]) { ball('#ad747e', [side * .16, 1.1, 1.82], [.07, .09, .045], 'nostrils'); part(CONE, '#d99595', [side * .48, 1.85, 1], [.28, .65, .2], 'pig ears', [0, 0, side * -.25]); }
      eyes(1.48, 1.57, .32);
      const tail = [[0, 1.15, -1], [.35, 1.35, -1.3], [.48, 1.12, -1.6], [.2, .95, -1.6], [.1, 1.13, -1.5]];
      for (let i = 1; i < tail.length; i++) beam('#d99595', tail[i - 1], tail[i], .07, 'curly pig tail');
    }
    return freeze({ id, species, x:x+TRAIN_PARK_OFFSET.x, y: ground, z:z+TRAIN_PARK_OFFSET.z, radius: scale * (species === 'camel' ? 3 : species === 'toucan' ? 2 : 2.4), features: freeze([...features]) });
  });
}

function vehicle(engine, index) {
  const root = new THREE.Group(); root.name = engine ? 'Adventure locomotive' : `Adventure carriage ${index}`;
  root.userData.vehicle = engine ? 'engine' : 'carriage';
  const color = engine ? '#d98070' : index === 1 ? '#e2b961' : '#78a8b0';
  box(root, 0, 1.02, 0, 3.3, .4, 5.9, '#416267', 'Chassis');
  const wheels = [];
  for (const x of [-1.35, 1.35]) for (const z of [-1.9, 1.9]) {
    const wheel = new THREE.Group(); wheel.position.set(x, .86, z); wheel.name = 'Rolling train wheel'; root.add(wheel);
    const tire = cylinder(wheel, 0, 0, 0, .64, .28, '#416267'); tire.rotation.z = Math.PI / 2;
    const hub = cylinder(wheel, Math.sign(x) * .16, 0, 0, .32, .08, '#edca77'); hub.rotation.z = Math.PI / 2;
    box(wheel, Math.sign(x) * .21, 0, 0, .06, .89, .12, '#fff1ce', 'Wheel spoke');
    box(wheel, Math.sign(x) * .21, 0, 0, .06, .12, .89, '#fff1ce', 'Wheel spoke'); wheels.push(wheel);
  }
  for (const z of [-3.2, 3.2]) box(root, 0, 1, z, .5, .22, 1, '#416267', 'Coupler');
  if (engine) {
    const boiler = cylinder(root, 0, 2.1, 1.05, 1.13, 3.3, color, 'Round boiler'); boiler.rotation.x = Math.PI / 2;
    const front = cylinder(root, 0, 2.1, 2.73, .96, .16, '#f1d49a', 'Boiler face'); front.rotation.x = Math.PI / 2;
    for (const x of [-.39, .39]) { sphere(root, x, 2.3, 2.84, .15, .2, .06, '#416267', 'Friendly engine eye'); sphere(root, x - .035, 2.36, 2.9, .045, .055, .02, '#fff1ce'); }
    const smile = new THREE.CatmullRomCurve3([new THREE.Vector3(-.4, 1.85, 2.85), new THREE.Vector3(0, 1.7, 2.9), new THREE.Vector3(.4, 1.85, 2.85)]);
    mesh(root, new THREE.TubeGeometry(smile, 12, .055, 6, false), '#416267', 'Engine smile');
    box(root, 0, 2.15, -1.7, 3.1, 2.1, 2.25, color, 'Driver cabin');
    box(root, 0, 3.95, -1.7, 3.6, .28, 2.8, '#467b79', 'Locomotive roof');
    for (const x of [-1.58, 1.58]) box(root, x, 3.05, -1.7, .1, 1.25, 1.4, '#baddd7', 'Cabin window');
    box(root, 0, 3.05, -.55, 1.9, 1.25, .1, '#baddd7', 'Front cabin window');
    cylinder(root, 0, 3.6, 1.7, .36, 1.4, '#416267', 'Chimney'); cylinder(root, 0, 4.32, 1.7, .53, .19, '#edca77', 'Chimney rim');
    cylinder(root, 0, 3.2, .05, .26, .48, '#edca77', 'Brass bell');
    box(root, 0, .88, 3.1, 3.6, .8, .45, '#d98070', 'Cowcatcher');
    for (let i = -2; i <= 2; i++) box(root, i * .6, .87, 3.35, .16, .6, .13, '#fff1ce');
  } else {
    box(root, 0, 1.55, 0, 3.3, .8, 5.7, color, 'Carriage sides');
    box(root, 0, 1.99, 0, 2.9, .08, 5.1, '#d4aa79', 'Carriage floor');
    const posts = [];
    for (const x of [-1.5, 1.5]) for (const z of [-2.5, 0, 2.5]) posts.push([x, z]);
    for (const [x, z] of posts) box(root, x, 2.9, z, .14, 2.2, .14, '#fff1ce', 'Carriage roof post');
    box(root, 0, 4.05, 0, 3.7, .3, 6.1, color, 'Carriage canopy');
    for (const z of [-1.75, .15, 2]) { box(root, 0, 2.25, z, 2.7, .18, .65, '#fff1ce', 'Passenger seat'); box(root, 0, 2.6, z - .33, 2.7, .65, .12, '#fff1ce', 'Seat back'); }
    for (const x of [-1.58, 1.58]) box(root, x, 2.13, 0, .1, .18, 5.5, '#fff1ce', 'Carriage handrail');
  }
  return { root, wheels };
}
export function createTrainPark() {
  const root = new THREE.Group(); root.name = 'Four Worlds Train Park';
  const landscape=new THREE.Group();landscape.name='Translated train park scenery';landscape.position.set(TRAIN_PARK_OFFSET.x,0,TRAIN_PARK_OFFSET.z);root.add(landscape);
  const batch = staticBuilder(landscape);
  railway(landscape, batch); station(landscape, batch); scenery(landscape, batch);
  const residents = freeze(animals(batch)); batch.flush();
  const train = new THREE.Group(); train.name = 'Adventure train'; root.add(train);
  const vehicles = [vehicle(true, 0), vehicle(false, 1), vehicle(false, 2)];
  vehicles.forEach(({ root: body }) => train.add(body));
  const smoke = [];
  for (let i = 0; i < 4; i++) {
    const puff = sphere(vehicles[0].root, 0, 4.7, 1.7, .3, .3, .3, material('#f5f0dd', { transparent: true, opacity: .65, depthWrite: false }), 'Train steam puff');
    puff.castShadow = false; smoke.push(puff);
  }
  const counts = freeze({ zones: TRAIN_ZONES.length, engines: 1, carriages: 2, animals: residents.length, species: new Set(residents.map(a => a.species)).size, ties: Math.ceil(TRAIN_TRACK_LENGTH / 1.85) });
  function update(state = createTrainState(), time = 0) {
    const distance = Number.isFinite(state.distance) ? state.distance : 0;
    const motionTime = Number.isFinite(state.motionTime) ? state.motionTime : 0;
    vehicles.forEach(({ root: body, wheels }, i) => {
      const pose = trainPose((Number.isFinite(state.progress) ? state.progress : 0) - i * TRAIN_PARK.carriageSpacing / TRAIN_TRACK_LENGTH);
      body.position.set(pose.x, pose.y, pose.z); body.rotation.y = pose.yaw;
      wheels.forEach(wheel => { wheel.rotation.x = distance / .64; });
    });
    smoke.forEach((puff, i) => {
      const phase = wrap(motionTime * .45 + i / smoke.length);
      puff.position.set(Math.sin(phase * 3) * .18, 4.7 + phase * 2.4, 1.7 - phase * 1.9);
      puff.scale.setScalar(.22 + phase * .6);
      puff.visible = phase < .94;
    });
  }
  update();
  return { root, train, vehicles: vehicles.map(v => v.root), animals: residents, counts, update };
}
