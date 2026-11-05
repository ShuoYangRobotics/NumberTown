import * as THREE from './vendor/three.module.js';
import * as townData from './world-data.js';
import { WORLD } from './geography.js';
import { TERRAIN_OBSTACLES, groundHeight } from './terrain-data.js';
import { createPetRoadGraph } from './town-pets.js';
import { collides, angleLerp } from './navigation.js';

export const NUMBERBLOB_COUNT = 90;
export const NUMBERBLOB_DIAMETER = 1;
export const NUMBERBLOB_COLORS = Object.freeze(['#ff635e', '#ff963e', '#f3d447', '#a5d94a', '#40c997', '#37c5dc', '#5f9df5', '#996ce3', '#e670d0', '#fa8caf', '#e8b955', '#64d3c3']);
const RADIUS = .54;
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const safeTime = value => Number.isFinite(value) ? value : 0;
const TAU = Math.PI * 2;
function seeded(seed) { let value = seed >>> 0; return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 2 ** 32; }; }
function pointDistance(point, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
  const t = length ? clamp(((point.x - a.x) * dx + (point.z - a.z) * dz) / length, 0, 1) : 0;
  return Math.hypot(point.x - a.x - dx * t, point.z - a.z - dz * t);
}
function verticalOverlap(blob, other) {
  if (other.visible === false || other.hidden || other.onboard || other.onFoot === false) return false;
  const y = Number.isFinite(other.y) ? other.y : groundHeight(other.x, other.z) + (other.jump || 0);
  return y < blob.y + blob.height && y + (other.height ?? 1) > blob.y;
}
function checkedSegment(a, b, obstacles, world, ignoredId = null) {
  const filtered = ignoredId ? obstacles.filter(obstacle => obstacle.id !== ignoredId) : obstacles;
  const count = Math.max(1, Math.ceil(distance(a, b) / .25));
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    if (collides(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, filtered, world, RADIUS)) return false;
  }
  return true;
}

/** Ground navigation is a seeded walk on the pet graph. Twenty prevalidated
 * home spurs are the only paths that can enter a building, and only that home's
 * collision rectangle is omitted on its final, straight doorway segment.
 */
export function createNumberblobSimulation({ obstacles = [...townData.OBSTACLES, ...TERRAIN_OBSTACLES], world = WORLD,
  graph = null, homes = townData.NUMBERBLOB_HOMES ?? [], players = [], seed = 9052026 } = {}) {
  const roads = graph ?? createPetRoadGraph({ obstacles, world }), random = seeded(seed);
  const open = roads.filter(node => node.neighbors.length), homeLinks = [], homeNodes = new Map(), occupiedHomes = new Map();
  if (!open.length) throw new Error('Numberblobs need clear town roads.');
  for (const home of homes) {
    const candidates = open.filter(node => distance(node, home.approach) < 18).sort((a, b) => distance(a, home.approach) - distance(b, home.approach));
    const node = candidates.find(candidate => checkedSegment(candidate, home.approach, obstacles, world));
    if (!node || !checkedSegment(home.approach, home.doorstep, obstacles, world)
      || !checkedSegment(home.doorstep, home.inside, obstacles, world, home.id)) continue;
    const outward = home.facing === 'north' ? -1 : 1;
    const facadeZ = (home.doorstep.z * 2.2 + home.inside.z * 1.25) / 3.45;
    const entry = { ...home, node: node.id, outward, facadeZ };
    homeLinks.push(entry);
    if (!homeNodes.has(node.id)) homeNodes.set(node.id, []);
    homeNodes.get(node.id).push(entry);
  }
  const blobs = [];
  const nearSquare = open.filter(node => distance(node, { x: 90, z: 145 }) < 32);
  for (let index = 0; index < NUMBERBLOB_COUNT; index++) {
    const home = index < homeLinks.length ? homeLinks[index] : null;
    const preferred = home ? roads[home.node] : index < homeLinks.length + 14 ? nearSquare[Math.floor(random() * nearSquare.length)] : open[Math.floor(random() * open.length)];
    const candidates = [...open].sort((a, b) => distance(a, preferred) - distance(b, preferred));
    const node = candidates.find(candidate => !blobs.some(blob => distance(blob, candidate) < RADIUS * 2 + .35)
      && !players.some(player => verticalOverlap({ y: groundHeight(candidate.x, candidate.z), height: 1.2 }, player)
        && distance(candidate, player) < RADIUS + (player.radius ?? .7) + .22));
    if (!node) throw new Error('Numberblobs need ninety clear starting spots.');
    blobs.push({ id: `numberblob-${index + 1}`, index, kind: 'numberblob', color: NUMBERBLOB_COLORS[Math.floor(random() * NUMBERBLOB_COLORS.length)],
      x: node.x, z: node.z, y: groundHeight(node.x, node.z), radius: RADIUS, height: 1.2, jump: 0, yaw: random() * TAU,
      mode: 'roaming', visible: true, hidden: false, node: node.id, target: null, previous: null,
      speed: 1.45 + random() * .65, bouncePhase: random() * TAU, moving: false, distanceWalked: 0, visits: 0,
      home: null, homeStep: 0, homesEntered: 0, homesExited: 0, nextHomeAt: home && node.id === home.node ? 1 + index * .5 : 12 + random() * 20,
      waitingUntil: home && node.id === home.node ? 1 + index * .5 : index * .025, mouthOpen: 0, blockedFor: 0, greetingUntil: 0, nextGreeting: 0, nearby: false, talking: false, talkingUntil: 0 });
  }
  let nextGreeting = 0, selectedId = null, now = 0;
  const cellSize = 6, bucket = point => `${Math.floor(point.x / cellSize)},${Math.floor(point.z / cellSize)}`;
  function indexVisitors(visitors) {
    const bins = new Map(); let maxRadius = RADIUS;
    for (const visitor of [...visitors, ...blobs]) {
      if (visitor.visible === false || visitor.hidden || visitor.onboard) continue;
      const key = bucket(visitor);
      if (!bins.has(key)) bins.set(key, new Set()); bins.get(key).add(visitor);
      maxRadius = Math.max(maxRadius, visitor.radius ?? .7);
    }
    return { bins, maxRadius };
  }
  function dynamicClear(blob, next, index) {
    const range = blob.radius + index.maxRadius + .2;
    for (let bx = Math.floor((blob.x - range) / cellSize); bx <= Math.floor((blob.x + range) / cellSize); bx++) {
      for (let bz = Math.floor((blob.z - range) / cellSize); bz <= Math.floor((blob.z + range) / cellSize); bz++) {
        for (const other of index.bins.get(`${bx},${bz}`) ?? []) {
          if (other === blob || other.id === blob.id || !verticalOverlap(blob, other)) continue;
          const clearance = blob.radius + (other.radius ?? .7) + .08;
          if (distance(blob, other) < clearance) {
            if (distance(next, other) <= distance(blob, other) + .000001) return false;
          } else if (pointDistance(other, blob, next) < clearance) return false;
        }
      }
    }
    return true;
  }
  function releaseHome(blob) {
    if (blob.home && occupiedHomes.get(blob.home.id) === blob.id) occupiedHomes.delete(blob.home.id);
    blob.home = null; blob.mode = 'roaming'; blob.homeStep = 0; blob.nextHomeAt = now + 35 + random() * 45;
    blob.visible = true; blob.hidden = false;
  }
  function destination(blob) {
    const home = blob.home;
    if (blob.mode === 'home-approach') return blob.homeStep === 0 ? home.approach : home.doorstep;
    if (blob.mode === 'home-entering') return home.inside;
    if (blob.mode === 'home-exiting') return home.doorstep;
    if (blob.mode === 'home-returning') return blob.homeStep === 0 ? home.approach : roads[home.node];
    return roads[blob.target];
  }
  function chooseTarget(blob) {
    if (blob.mode !== 'roaming' || blob.target !== null) return;
    const available = (homeNodes.get(blob.node) ?? []).filter(home => !occupiedHomes.has(home.id));
    if (available.length && now >= blob.nextHomeAt) {
      const home = available[Math.floor(random() * available.length)]; occupiedHomes.set(home.id, blob.id);
      blob.home = home; blob.mode = 'home-approach'; blob.homeStep = 0; return;
    }
    let choices = roads[blob.node].neighbors.filter(id => id !== blob.previous);
    if (!choices.length) choices = roads[blob.node].neighbors;
    blob.target = choices[Math.floor(random() * choices.length)];
  }
  function arrive(blob) {
    if (blob.mode === 'home-approach') {
      if (blob.homeStep === 0) blob.homeStep = 1; else blob.mode = 'home-entering';
    } else if (blob.mode === 'home-entering') {
      blob.mode = 'inside'; blob.visible = false; blob.hidden = true; blob.waitingUntil = now + 6 + random() * 9; blob.homesEntered++;
    } else if (blob.mode === 'home-exiting') { blob.mode = 'home-returning'; blob.homeStep = 0; blob.homesExited++; }
    else if (blob.mode === 'home-returning') {
      if (blob.homeStep === 0) blob.homeStep = 1;
      else { blob.node = blob.home.node; blob.target = null; releaseHome(blob); }
    } else {
      blob.previous = blob.node; blob.node = blob.target; blob.target = null; blob.visits++;
      if (random() < .025) blob.waitingUntil = now + .4 + random() * 1.4;
    }
  }
  function update(dt, time, visitors = []) {
    now = safeTime(time); const stepTime = clamp(safeTime(dt), 0, .1), index = indexVisitors(visitors);
    for (const blob of blobs) {
      blob.moving = false;
      if (blob.talking && now >= blob.talkingUntil) blob.talking = false;
      blob.mouthOpen = blob.talking ? .2 + .45 * (.5 + .5 * Math.sin(now * 12 + blob.index)) : blob.moving ? .025 : .008;
      if (blob.mode === 'inside' && now >= blob.waitingUntil) blob.mode = 'home-exiting';
      if (blob.mode === 'inside' || now < blob.waitingUntil || now < blob.greetingUntil || blob.talking) { blob.jump = Math.max(0, blob.jump - stepTime * 3); blob.y = groundHeight(blob.x, blob.z) + blob.jump; continue; }
      chooseTarget(blob);
      const target = destination(blob);
      if (!target) continue;
      const remaining = distance(blob, target), step = Math.min(remaining, blob.speed * stepTime);
      const next = remaining ? { x: blob.x + (target.x - blob.x) * step / remaining, z: blob.z + (target.z - blob.z) * step / remaining } : { x: blob.x, z: blob.z };
      if (!dynamicClear(blob, next, index)) {
        blob.blockedFor += stepTime;
        if (blob.blockedFor > 1.7 && blob.mode === 'roaming') {
          if (distance(blob, roads[blob.node]) > .02) { const old = blob.node; blob.node = blob.target; blob.target = old; }
          else { blob.previous = blob.target; blob.target = null; }
          blob.waitingUntil = now + .2 + random() * .5; blob.blockedFor = 0;
        } else if (blob.blockedFor > 4 && blob.mode === 'home-approach') { blob.mode = 'home-returning'; blob.homeStep = 0; blob.blockedFor = 0; }
        blob.jump = Math.max(0, blob.jump - stepTime * 3); blob.y = groundHeight(blob.x, blob.z) + blob.jump; continue;
      }
      blob.blockedFor = 0;
      const oldBucket = bucket(blob), targetYaw = Math.atan2(target.x - blob.x, target.z - blob.z);
      blob.x = next.x; blob.z = next.z; blob.distanceWalked += step; blob.moving = step > .0001;
      if (blob.moving) { blob.bouncePhase += step * 7; blob.yaw = angleLerp(blob.yaw, targetYaw, Math.min(1, stepTime * 12)); }
      blob.jump = blob.moving ? Math.abs(Math.sin(blob.bouncePhase)) * .34 : 0;
      blob.y = groundHeight(blob.x, blob.z) + blob.jump;
      if (remaining <= step + .001) arrive(blob);
      if (blob.home && ['home-entering', 'home-exiting', 'inside'].includes(blob.mode)) {
        const depth = (blob.home.facadeZ - blob.z) * blob.home.outward;
        blob.visible = depth <= RADIUS + .08; blob.hidden = !blob.visible;
      }
      const newBucket = bucket(blob);
      if (oldBucket !== newBucket || !blob.visible) index.bins.get(oldBucket)?.delete(blob);
      if (blob.visible) { if (!index.bins.has(newBucket)) index.bins.set(newBucket, new Set()); index.bins.get(newBucket).add(blob); }
    }
  }
  function greet(selected, time) {
    if (!selected || !Number.isFinite(time) || selected.visible === false || selected.hidden || selected.onboard || selected.onFoot === false) return null;
    const identity = selected.number ?? selected.id ?? 'selected';
    if (identity !== selectedId) { selectedId = identity; for (const blob of blobs) blob.nearby = false; }
    let nearest = null, nearestGap = Infinity;
    for (const blob of blobs) {
      const gap = distance(blob, selected) - blob.radius - (selected.radius ?? .7);
      const near = blob.visible && blob.mode === 'roaming' && verticalOverlap(blob, selected);
      if (!near || gap > 9) blob.nearby = false;
      if (near && gap < 4.5 && !blob.nearby && time >= blob.nextGreeting && gap < nearestGap) { nearest = blob; nearestGap = gap; }
    }
    if (!nearest || time < nextGreeting) return null;
    nearest.nearby = true; nearest.nextGreeting = time + 45; nearest.greetingUntil = time + 3;
    nearest.moving = false; nearest.yaw = Math.atan2(selected.x - nearest.x, selected.z - nearest.z); nextGreeting = time + 15;
    return { id: nearest.id, index: nearest.index, color: nearest.color, x: nearest.x, y: nearest.y, z: nearest.z, radius: nearest.radius, height: nearest.height };
  }
  function setTalking(id, value = true) {
    const blob = blobs.find(item => item.id === id); if (!blob) return false;
    for (const other of blobs) if (other !== blob) other.talking = false;
    blob.talking = value !== false;
    blob.talkingUntil = typeof value === 'number' ? Math.max(now, value) : value ? now + 15 : now;
    blob.moving = false; return true;
  }
  function stopTalking() { for (const blob of blobs) { blob.talking = false; blob.talkingUntil = 0; } }
  function animalPoses() { return blobs.filter(blob => blob.visible); }
  function diagnosticSnapshot() { return blobs.map(({ id, index, color, x, y, z, radius, height, jump, yaw, mode, visible, moving, distanceWalked, visits, homesEntered, homesExited, talking, mouthOpen, home }) => ({ id, index, color, x, y, z, radius, height, jump, yaw, mode, visible, moving, distanceWalked, visits, homesEntered, homesExited, talking, mouthOpen, inside: mode === 'inside', homeId: home?.id ?? null })); }
  return { blobs, graph: roads, homes: homeLinks, counts: { numberblobs: NUMBERBLOB_COUNT }, update, greet, setTalking, stopTalking, animalPoses, diagnosticSnapshot };
}

/** A closed body is exactly one unit in diameter. The upper hemisphere, its
 * dark mouth lining and both googly eyes share a hinge at the back of the ball.
 * Opening the hinge reveals a pink lower mouth and tongue instead of stretching
 * or flattening the spherical body. All ninety residents share four batches.
 */
export function createNumberblobs(options = {}) {
  const simulation = createNumberblobSimulation(options), root = new THREE.Group(); root.name = 'Ninety bouncing Numberblobs';
  const hemisphere = new THREE.SphereGeometry(.5, 20, 10, 0, TAU, 0, Math.PI / 2);
  hemisphere.userData.unitDiameter = NUMBERBLOB_DIAMETER;
  const disk = new THREE.CircleGeometry(.495, 24); disk.rotateX(-Math.PI / 2);
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  const ring = new THREE.TorusGeometry(.492, .012, 5, 24); ring.rotateX(-Math.PI / 2);
  const geometries = [hemisphere, disk, sphere, ring];
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .55, side: THREE.DoubleSide });
  function batch(name, geometry, count) {
    const mesh = new THREE.InstancedMesh(geometry, material, count); mesh.name = name;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = false;
    root.add(mesh); return mesh;
  }
  const shells = batch('Unit spherical hinged body halves', hemisphere, NUMBERBLOB_COUNT * 2);
  const mouths = batch('Dark upper mouths and rosy lower mouths', disk, NUMBERBLOB_COUNT * 2);
  const eyes = batch('Googly eyes, pupils, highlights and tongues', sphere, NUMBERBLOB_COUNT * 7);
  const lips = batch('Rounded mouth rims', ring, NUMBERBLOB_COUNT * 2);
  for (const blob of simulation.blobs) {
    const index = blob.index;
    shells.setColorAt(index * 2, new THREE.Color(blob.color)); shells.setColorAt(index * 2 + 1, new THREE.Color(blob.color));
    mouths.setColorAt(index * 2, new THREE.Color('#62223d')); mouths.setColorAt(index * 2 + 1, new THREE.Color('#bd4266'));
    lips.setColorAt(index * 2, new THREE.Color(blob.color)); lips.setColorAt(index * 2 + 1, new THREE.Color('#e77c99'));
    for (let side = 0; side < 2; side++) {
      eyes.setColorAt(index * 7 + side * 3, new THREE.Color('#fffef4'));
      eyes.setColorAt(index * 7 + side * 3 + 1, new THREE.Color('#243143'));
      eyes.setColorAt(index * 7 + side * 3 + 2, new THREE.Color('#ffffff'));
    }
    eyes.setColorAt(index * 7 + 6, new THREE.Color('#f489a4'));
  }
  const position = new THREE.Vector3(), scale = new THREE.Vector3(), euler = new THREE.Euler(), quaternion = new THREE.Quaternion();
  const base = new THREE.Matrix4(), upper = new THREE.Matrix4(), lower = new THREE.Matrix4(), local = new THREE.Matrix4(), output = new THREE.Matrix4();
  const hinge = new THREE.Matrix4(), shift = new THREE.Matrix4().makeTranslation(0, 0, .5);
  function transform(matrix, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    return matrix.compose(position.set(x, y, z), quaternion.setFromEuler(euler.set(rx, ry, rz)), scale.set(sx, sy, sz));
  }
  function put(mesh, index, parent, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    transform(local, x, y, z, sx, sy, sz, rx, ry, rz); mesh.setMatrixAt(index, output.multiplyMatrices(parent, local));
  }
  function render(time) {
    const t = safeTime(time);
    for (const blob of simulation.blobs) {
      const index = blob.index, visible = blob.visible ? 1 : 0;
      transform(base, blob.x, blob.y + .065, blob.z, visible, visible, visible, 0, blob.yaw, 0);
      transform(hinge, 0, .5, -.5, 1, 1, 1, -blob.mouthOpen);
      upper.multiplyMatrices(base, hinge).multiply(shift);
      transform(local, 0, .5, 0); lower.multiplyMatrices(base, local);
      put(shells, index * 2, upper, 0, 0, 0);
      put(shells, index * 2 + 1, lower, 0, 0, 0, 1, 1, 1, Math.PI);
      put(mouths, index * 2, upper, 0, -.002, 0);
      put(mouths, index * 2 + 1, lower, 0, .004, 0);
      put(lips, index * 2, upper, 0, -.004, 0);
      put(lips, index * 2 + 1, lower, 0, .008, 0);
      for (let side = 0; side < 2; side++) {
        const direction = side ? 1 : -1, x = direction * .18;
        const wiggle = Math.sin(t * 2 + blob.index * .9) * .011;
        put(eyes, index * 7 + side * 3, upper, x, .406, .17, .145, .16, .145);
        put(eyes, index * 7 + side * 3 + 1, upper, x + wiggle, .411, .298, .075, .093, .04);
        put(eyes, index * 7 + side * 3 + 2, upper, x + wiggle - .019, .445, .334, .022, .027, .013);
      }
      put(eyes, index * 7 + 6, lower, 0, .014, .19, .22, .019, .13);
    }
    for (const mesh of [shells, mouths, eyes, lips]) mesh.instanceMatrix.needsUpdate = true;
  }
  let disposed = false;
  function dispose() {
    if (disposed) return; disposed = true;
    for (const geometry of geometries) geometry.dispose(); material.dispose(); root.removeFromParent();
  }
  render(0);
  return { ...simulation, root, update(dt, time, visitors) { simulation.update(dt, time, visitors); render(time); }, dispose };
}
