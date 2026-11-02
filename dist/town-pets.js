import * as THREE from './vendor/three.module.js';
import { ROAD_SEGMENTS, OBSTACLES } from './world-data.js';
import { WORLD, BRIDGES } from './geography.js';
import { TERRAIN_OBSTACLES, groundHeight } from './terrain-data.js';
import { collides, angleLerp } from './navigation.js';

export const TOWN_PET_COUNTS = Object.freeze({ cats: 10, dogs: 10 });
const PET_RADIUS = 1.55;
const TAU = Math.PI * 2;
const finite = value => Number.isFinite(value);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const furs = ['#edb568', '#738795', '#eee8d8', '#ad7654', '#494c58', '#d4c0a4', '#db8f55', '#f6e8d2', '#778a85', '#bc926d'];
const collars = ['#df648c', '#38b8c3', '#8b70d5', '#ef9252', '#599ddb'];

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 2 ** 32; };
}
function segmentDistance(point, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, length2 = dx * dx + dz * dz;
  const t = length2 ? clamp(((point.x - a.x) * dx + (point.z - a.z) * dz) / length2, 0, 1) : 0;
  return Math.hypot(point.x - a.x - dx * t, point.z - a.z - dz * t);
}
function verticalOverlap(pet, player) {
  if (player.visible === false || player.onboard || player.hidden) return false;
  const y = finite(player.y) ? player.y : finite(player.groundY) ? player.groundY : groundHeight(player.x, player.z);
  return y < pet.y + 2.1 && y + (player.height ?? 1) > pet.y + .1;
}

/** Construct one modest graph on the paving. Curbs and water are validated once,
 * not searched every frame. Explicit crossings split intersecting streets, and
 * the three bridge center lines are the only graph edges crossing the river.
 */
export function createPetRoadGraph({ roads = ROAD_SEGMENTS, obstacles = [...OBSTACLES, ...TERRAIN_OBSTACLES], world = WORLD } = {}) {
  const segments = roads.filter(road => Math.min(road.z1, road.z2) <= 345 && Math.max(road.z1, road.z2) >= 72).map(road => {
    const dx = road.x2 - road.x1, dz = road.z2 - road.z1;
    if (!dz) return { ...road };
    const cuts = [(72 - road.z1) / dz, (345 - road.z1) / dz].sort((a, b) => a - b);
    const start = Math.max(0, cuts[0]), end = Math.min(1, cuts[1]);
    return { ...road, x1: road.x1 + dx * start, z1: road.z1 + dz * start, x2: road.x1 + dx * end, z2: road.z1 + dz * end };
  });
  for (const bridge of BRIDGES) segments.push({ x1: bridge.x - bridge.span / 2, z1: bridge.z, x2: bridge.x + bridge.span / 2, z2: bridge.z });
  const plaza = [[58, 146, 90, 146], [90, 146, 122, 146], [70, 110, 110, 110], [70, 110, 70, 146], [110, 110, 110, 116], [70, 110, 58, 110]];
  for (const [x1, z1, x2, z2] of plaza) segments.push({ x1, z1, x2, z2 });
  const nodes = [], byPosition = new Map();
  const nodeAt = (x, z) => {
    const key = `${x.toFixed(4)},${z.toFixed(4)}`;
    if (!byPosition.has(key)) {
      const id = nodes.length;
      if (collides(x, z, obstacles, world, PET_RADIUS)) { byPosition.set(key, -1); return -1; }
      byPosition.set(key, id); nodes.push({ id, x, z, neighbors: [] });
    }
    return byPosition.get(key);
  };
  const clear = (a, b) => {
    const count = Math.ceil(distance(a, b) / .35);
    for (let i = 0; i <= count; i++) {
      const t = count ? i / count : 0;
      if (collides(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, obstacles, world, PET_RADIUS)) return false;
    }
    return true;
  };
  for (const road of segments) {
    const dx = road.x2 - road.x1, dz = road.z2 - road.z1, length2 = dx * dx + dz * dz;
    if (!length2) continue;
    const length = Math.sqrt(length2), cuts = [0, 1];
    for (let step = 1; step < Math.ceil(length / 4); step++) cuts.push(step / Math.ceil(length / 4));
    for (const other of segments) {
      const ex = other.x2 - other.x1, ez = other.z2 - other.z1, det = dx * ez - dz * ex;
      if (Math.abs(det) > 1e-8) {
        const ax = other.x1 - road.x1, az = other.z1 - road.z1;
        const t = (ax * ez - az * ex) / det, u = (ax * dz - az * dx) / det;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) cuts.push(t);
      } else {
        for (const p of [{ x: other.x1, z: other.z1 }, { x: other.x2, z: other.z2 }]) {
          if (segmentDistance(p, { x: road.x1, z: road.z1 }, { x: road.x2, z: road.z2 }) < .001) cuts.push(clamp(((p.x - road.x1) * dx + (p.z - road.z1) * dz) / length2, 0, 1));
        }
      }
    }
    const sorted = [...new Set(cuts.map(t => t.toFixed(8)))].map(Number).sort((a, b) => a - b);
    let last = -1;
    for (const t of sorted) {
      const current = nodeAt(road.x1 + dx * t, road.z1 + dz * t);
      if (current >= 0 && last >= 0 && current !== last && clear(nodes[last], nodes[current])) {
        if (!nodes[last].neighbors.includes(current)) nodes[last].neighbors.push(current);
        if (!nodes[current].neighbors.includes(last)) nodes[current].neighbors.push(last);
      }
      last = current;
    }
  }
  return nodes;
}

/** Renderer-free movement and approach events, with bounded work for twenty pets. */
export function createPetSimulation({ obstacles = [...OBSTACLES, ...TERRAIN_OBSTACLES], world = WORLD, roads = ROAD_SEGMENTS, players = [], seed = 3072026 } = {}) {
  const graph = createPetRoadGraph({ obstacles, world, roads }), random = seededRandom(seed);
  const open = graph.filter(node => node.neighbors.length);
  if (!open.length) throw new Error('Town pets need a clear town road.');
  const starts = [[86, 146], [106, 146], [34, 122], [178, 194], [130, 266], [-115, 122], [-65, 218], [299, 170], [515, 170], [435, 266],
    [96, 146], [58, 170], [154, 122], [202, 266], [82, 218], [-165, 170], [-270, 266], [299, 242], [515, 266], [625, 122]];
  const pets = [];
  for (let index = 0; index < 20; index++) {
    const species = index < 10 ? 'cat' : 'dog', [x, z] = starts[index];
    const candidate = { x, z, y: 0 };
    const choices = open.filter(node => !pets.some(pet => distance(pet, node) < PET_RADIUS * 2 + .5)
      && !players.some(player => verticalOverlap(candidate, player) && distance(player, node) < (player.radius ?? .7) + PET_RADIUS + .4));
    choices.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    const node = choices[0];
    if (!node) throw new Error('Town pets need twenty clear starting spots.');
    pets.push({ id: `town-${species}-${index % 10 + 1}`, species, x: node.x, y: groundHeight(node.x, node.z), z: node.z, radius: PET_RADIUS,
      height: 2.2, yaw: random() * TAU, index, node: node.id, target: null, previous: null,
      speed: species === 'cat' ? 1.7 + random() * .5 : 2 + random() * .6, waitingUntil: index * .13, greetingUntil: 0,
      stride: 0, moving: false, distanceWalked: 0, visits: 0, blockedFor: 0, nearby: false, nextGreeting: 0 });
  }
  let nextGreeting = 0, selectedId = null;
  function segmentOpen(pet, next, visitors) {
    for (const player of visitors) {
      if (!verticalOverlap(pet, player)) continue;
      const clearance = pet.radius + (player.radius ?? .7) + .16;
      // If another moving friend has approached us, allow a retreat that only
      // increases separation; never step further through their body.
      if (distance(pet, player) < clearance) {
        if (distance(next, player) <= distance(pet, player) + 1e-6) return false;
      } else if (segmentDistance(player, pet, next) < clearance) return false;
    }
    return !pets.some(other => other !== pet && segmentDistance(other, pet, next) < pet.radius + other.radius + .05);
  }
  function update(dt, time, visitors = []) {
    const stepTime = clamp(finite(dt) ? dt : 0, 0, .1), now = finite(time) ? time : 0;
    for (const pet of pets) {
      pet.moving = false;
      if (now < pet.greetingUntil || now < pet.waitingUntil) continue;
      if (pet.target === null) {
        let choices = graph[pet.node].neighbors.filter(id => id !== pet.previous);
        if (!choices.length) choices = graph[pet.node].neighbors;
        pet.target = choices[Math.floor(random() * choices.length)];
      }
      const target = graph[pet.target], remaining = distance(pet, target), step = Math.min(remaining, pet.speed * stepTime);
      const next = remaining ? { x: pet.x + (target.x - pet.x) * step / remaining, z: pet.z + (target.z - pet.z) * step / remaining } : { x: pet.x, z: pet.z };
      if (!segmentOpen(pet, next, visitors)) {
        pet.blockedFor += stepTime;
        if (pet.blockedFor > 1.3) {
          // Walk back along the already checked edge before trying a new turn.
          if (distance(pet, graph[pet.node]) > .05) { const old = pet.node; pet.node = pet.target; pet.target = old; }
          else { pet.previous = pet.target; pet.target = null; }
          pet.blockedFor = 0; pet.waitingUntil = now + .3 + random() * .6;
        }
        continue;
      }
      pet.blockedFor = 0;
      const targetYaw = Math.atan2(target.x - pet.x, target.z - pet.z);
      pet.x = next.x; pet.z = next.z; pet.y = groundHeight(pet.x, pet.z); pet.distanceWalked += step;
      pet.moving = step > .0001;
      if (pet.moving) { pet.stride += step * 5.5; pet.yaw = angleLerp(pet.yaw, targetYaw, Math.min(1, stepTime * 9)); }
      if (remaining <= step + .001) {
        pet.previous = pet.node; pet.node = pet.target; pet.target = null; pet.visits++;
        if (random() < .035) pet.waitingUntil = now + .7 + random() * 1.5;
      }
    }
  }
  function greet(selected, time) {
    if (!selected || !finite(time) || selected.visible === false || selected.onboard || selected.hidden) return null;
    const identity = selected.number ?? selected.id ?? 'selected';
    if (identity !== selectedId) { selectedId = identity; for (const pet of pets) pet.nearby = false; }
    const candidates = [];
    for (const pet of pets) {
      const edge = distance(pet, selected) - pet.radius - (selected.radius ?? .7);
      const near = verticalOverlap(pet, selected) && edge < 5;
      if (!verticalOverlap(pet, selected) || edge > 8) pet.nearby = false;
      if (near && !pet.nearby && time >= pet.nextGreeting) candidates.push({ pet, edge });
    }
    candidates.sort((a, b) => a.edge - b.edge);
    if (time < nextGreeting || !candidates.length) return null;
    const pet = candidates[0].pet;
    pet.nearby = true; pet.nextGreeting = time + 18; pet.greetingUntil = time + 2.2; pet.moving = false;
    pet.yaw = Math.atan2(selected.x - pet.x, selected.z - pet.z); nextGreeting = time + 3.5;
    return { id: pet.id, species: pet.species, text: pet.species === 'cat' ? 'Meow!' : 'Woof!', x: pet.x, y: pet.y + pet.height, z: pet.z, radius: pet.radius };
  }
  function diagnosticSnapshot() { return pets.map(({ id, species, x, y, z, yaw, radius, moving, distanceWalked, visits, greetingUntil }) => ({ id, species, x, y, z, yaw, radius, moving, distanceWalked, visits, greetingUntil })); }
  return { pets, graph, counts: TOWN_PET_COUNTS, update, greet, animalPoses: () => pets, diagnosticSnapshot };
}

/** Twenty toys share a few instanced meshes; eyes, paws, ears and curved tails
 * retain their 3D silhouettes without hundreds of additional draw calls. */
export function createTownPets(options = {}) {
  const simulation = createPetSimulation(options), root = new THREE.Group(); root.name = 'Ten cats and ten dogs';
  const geometries = { ball: new THREE.SphereGeometry(1, 12, 8), cone: new THREE.ConeGeometry(1, 1, 4), beam: new THREE.CylinderGeometry(1, 1, 1, 7) };
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .85 });
  const batches = new Map(), parts = [];
  function part(pet, name, shape, color, xyz, scale, motion = null, rotation = [0, 0, 0]) {
    if (!batches.has(shape)) batches.set(shape, []);
    const batch = batches.get(shape), descriptor = { pet, name, shape, color, xyz, scale, motion, rotation, index: batch.length };
    batch.push(descriptor); parts.push(descriptor);
  }
  for (const pet of simulation.pets) {
    const cat = pet.species === 'cat', fur = furs[pet.index % 10], patch = pet.index % 3 === 0 ? '#fff0db' : pet.index % 3 === 1 ? '#374d59' : '#bb794e';
    const bodyY = cat ? .88 : 1.05, headY = cat ? 1.44 : 1.64, headZ = cat ? .62 : .78;
    part(pet, 'Soft furry body', 'ball', fur, [0, bodyY, -.04], [cat ? .44 : .54, cat ? .4 : .51, cat ? .69 : .83]);
    part(pet, 'Cream chest', 'ball', '#fff0da', [0, bodyY, .45], [.3, .33, .25]);
    if (pet.index % 3 !== 2) part(pet, 'Fur back patch', 'ball', patch, [.17, bodyY + .23, -.2], [.3, .23, .42]);
    for (const side of [-1, 1]) for (const front of [false, true]) {
      const phase = (front ? 0 : Math.PI) + (side > 0 ? Math.PI : 0), x = side * (cat ? .29 : .37), z = front ? .42 : -.49;
      part(pet, 'Walking leg', 'ball', fur, [x, .39, z], [.145, .37, .17], { kind: 'leg', phase });
      part(pet, 'Round paw', 'ball', cat || pet.index % 2 ? '#f8e9d3' : patch, [x, .13, z + .055], [.19, .13, .25], { kind: 'paw', phase });
    }
    part(pet, 'Round head', 'ball', fur, [0, headY, headZ], [cat ? .48 : .57, cat ? .44 : .5, cat ? .42 : .48]);
    for (const side of [-1, 1]) {
      if (cat) {
        part(pet, 'Pointed cat ear', 'cone', fur, [side * .31, headY + .43, headZ - .05], [.22, .52, .2], null, [0, Math.PI / 4, side * -.12]);
        part(pet, 'Pink cat ear', 'cone', '#e8a49f', [side * .31, headY + .43, headZ + .065], [.115, .3, .09], null, [0, Math.PI / 4, side * -.12]);
      } else part(pet, 'Floppy dog ear', 'ball', patch, [side * .51, headY - .07, headZ - .01], [.19, .48, .25], { kind: 'ear', side }, [0, 0, side * .17]);
      const eyeZ = headZ + (cat ? .35 : .41), eyeY = headY + .06;
      part(pet, 'Ivory eye', 'ball', '#fffdf1', [side * .2, eyeY, eyeZ], [.145, .165, .09]);
      part(pet, 'Shiny dark eye', 'ball', '#253342', [side * .2, eyeY, eyeZ + .075], [cat ? .055 : .085, .11, .04]);
      part(pet, 'Eye sparkle', 'ball', '#ffffff', [side * .2 - .018, eyeY + .04, eyeZ + .111], [.027, .03, .015]);
      part(pet, 'Muzzle cheek', 'ball', '#f9eddc', [side * .105, headY - .17, headZ + .37], [cat ? .15 : .24, cat ? .115 : .19, cat ? .1 : .26]);
      if (cat) for (const row of [-1, 1]) part(pet, 'Cat whisker', 'beam', '#605b60', [side * .32, headY - .16 + row * .055, headZ + .41], [.012, .36, .012], null, [0, 0, side * (Math.PI / 2 + row * .14)]);
    }
    part(pet, 'Button nose', 'ball', cat ? '#d98191' : '#343640', [0, headY - .11, headZ + (cat ? .47 : .65)], [cat ? .09 : .14, .08, .07]);
    part(pet, 'Little smile', 'ball', '#705454', [0, headY - .27, headZ + (cat ? .435 : .55)], [.105, .025, .025]);
    if (!cat) part(pet, 'Happy pink tongue', 'ball', '#ec9caa', [.03, headY - .35, headZ + .56], [.085, .13, .045]);
    part(pet, 'Bright collar', 'ball', collars[pet.index % 5], [0, headY - .39, headZ - .04], [cat ? .34 : .4, .09, .28]);
    part(pet, 'Golden name tag', 'ball', '#f6cc61', [0, headY - .44, headZ + .24], [.08, .1, .04]);
    for (let segment = 0; segment < 4; segment++) {
      part(pet, cat ? 'Upright curling cat tail' : 'Wagging dog tail', 'ball', segment === 3 ? patch : fur,
        [0, bodyY + segment * (cat ? .23 : .12), -.72 - segment * .16], [cat ? .11 : .15, .23, .13], { kind: 'tail', segment });
    }
  }
  const meshes = new Map();
  for (const [shape, entries] of batches) {
    const mesh = new THREE.InstancedMesh(geometries[shape], material, entries.length);
    mesh.name = `Town pet ${shape} details`; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.castShadow = true; mesh.receiveShadow = false; mesh.frustumCulled = false;
    entries.forEach(entry => mesh.setColorAt(entry.index, new THREE.Color(entry.color))); root.add(mesh); meshes.set(shape, mesh);
  }
  const matrix = new THREE.Matrix4(), local = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(), quaternion = new THREE.Quaternion(), euler = new THREE.Euler();
  const bases = simulation.pets.map(() => new THREE.Matrix4());
  function render(time) {
    const now = finite(time) ? time : 0;
    for (const pet of simulation.pets) {
      quaternion.setFromEuler(euler.set(0, pet.yaw, 0));
      bases[pet.index].compose(position.set(pet.x, pet.y + .03 + (pet.moving ? .025 * Math.sin(pet.stride * 2) : 0), pet.z), quaternion, scale.set(1, 1, 1));
    }
    for (const entry of parts) {
      const { pet, xyz, motion, rotation } = entry;
      let [x, y, z] = xyz, [rx, ry, rz] = rotation;
      if (motion?.kind === 'leg' || motion?.kind === 'paw') {
        const swing = pet.moving ? Math.sin(pet.stride + motion.phase) : 0;
        z += swing * .18; y += Math.max(0, swing) * .09; rx += swing * .3;
      } else if (motion?.kind === 'ear') rz += pet.moving ? .07 * Math.sin(pet.stride) * motion.side : 0;
      else if (motion?.kind === 'tail') {
        const greeting = now < pet.greetingUntil, wag = Math.sin(now * (greeting ? 13 : pet.species === 'dog' ? 5 : 1.7) + pet.index);
        x += wag * (motion.segment + 1) * (pet.species === 'cat' ? .04 : .09); rz += wag * .15;
      }
      quaternion.setFromEuler(euler.set(rx, ry, rz));
      local.compose(position.set(x, y, z), quaternion, scale.set(...entry.scale));
      meshes.get(entry.shape).setMatrixAt(entry.index, matrix.multiplyMatrices(bases[pet.index], local));
    }
    for (const mesh of meshes.values()) mesh.instanceMatrix.needsUpdate = true;
  }
  let disposed = false;
  function dispose() {
    if (disposed) return; disposed = true;
    for (const geometry of Object.values(geometries)) geometry.dispose(); material.dispose(); root.removeFromParent();
  }
  render(0);
  return { ...simulation, root, update(dt, time, players) { simulation.update(dt, time, players); render(time); }, dispose };
}
