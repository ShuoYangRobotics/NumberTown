import * as THREE from './vendor/three.module.js';
import { waterPlayHeight } from './terrain-data.js';
import { SEA_LIFE_COUNTS, starPose } from './sea-life.js';

const TAU = Math.PI * 2;
const LOOP_SEGMENTS = 96;
const safeTime = time => Number.isFinite(time) ? time : 0;
export const GARDEN_CENTER = Object.freeze({ x: 125, z: 550 });
export const GARDEN_ENTRANCE = Object.freeze({ x: 125, z: 535 });
export const GARDEN_PATH_WIDTH = 6;
export const GARDEN_LOOP = Object.freeze(Array.from({ length: LOOP_SEGMENTS + 1 }, (_, index) => {
  const angle = index % LOOP_SEGMENTS * TAU / LOOP_SEGMENTS;
  return Object.freeze({ x: GARDEN_CENTER.x + 34 * Math.sin(angle), z: GARDEN_CENTER.z - 28 * Math.cos(angle) });
}));

function projection(point, start, end) {
  const dx = end.x - start.x, dz = end.z - start.z;
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / (dx * dx + dz * dz)));
  const x = start.x + dx * t, z = start.z + dz * t;
  return { x, z, distance: Math.hypot(point.x - x, point.z - z) };
}
function nearestLoop(point) {
  let nearest = { distance: Infinity, index: 0 };
  for (let index = 0; index < LOOP_SEGMENTS; index++) {
    const hit = projection(point, GARDEN_LOOP[index], GARDEN_LOOP[index + 1]);
    if (hit.distance < nearest.distance) nearest = { ...hit, index };
  }
  return nearest;
}
function pathDistance(point) {
  return Math.min(nearestLoop(point).distance, projection(point, GARDEN_ENTRANCE, GARDEN_LOOP[0]).distance);
}

/** Join the nearest paving, finish one circuit, then use the clear north spur
 * back to the arrival. Returned heights are walking heights, not render offsets.
 */
export function gardenTourWaypoints(start = GARDEN_ENTRANCE) {
  const origin = Number.isFinite(start?.x) && Number.isFinite(start?.z) ? start : GARDEN_ENTRANCE;
  const near = nearestLoop(origin), spur = projection(origin, GARDEN_ENTRANCE, GARDEN_LOOP[0]);
  const points = [];
  if (spur.distance <= near.distance + .001) {
    points.push(spur, GARDEN_LOOP[0]);
    for (let index = 1; index <= LOOP_SEGMENTS; index++) points.push(GARDEN_LOOP[index]);
  } else {
    points.push(near);
    for (let step = 1; step <= LOOP_SEGMENTS; step++) points.push(GARDEN_LOOP[(near.index + step) % LOOP_SEGMENTS]);
    points.push(near);
    if (near.index < LOOP_SEGMENTS / 2) {
      for (let index = near.index; index >= 0; index--) points.push(GARDEN_LOOP[index]);
    } else {
      for (let step = 1; step <= LOOP_SEGMENTS - near.index; step++) points.push(GARDEN_LOOP[(near.index + step) % LOOP_SEGMENTS]);
    }
  }
  points.push(GARDEN_ENTRANCE);
  return points.filter((point, index) => !index || Math.hypot(point.x - points[index - 1].x, point.z - points[index - 1].z) > .001)
    .map(({ x, z }) => ({ x, y: waterPlayHeight(x, z), z }));
}

const coralSeeds = [[105, 545], [145, 537], [146, 558], [132, 564], [113, 563], [106, 552], [86, 538], [162, 535], [164, 565], [110, 584]];
const urchinSeeds = [[108, 536], [138, 554], [122, 563], [147, 546], [101, 550], [139, 585]];
const crabSeeds = [[117, 541], [145, 565], [106, 559], [157, 581]];
const animalDefinitions = Object.freeze([
  ...coralSeeds.map(([x, z], index) => ({ id: `garden-coral-${index + 1}`, species: 'coral', x, z, radius: 2.65, index, form: ['branching', 'fan', 'tube', 'plate'][index % 4] })),
  ...urchinSeeds.map(([x, z], index) => ({ id: `garden-urchin-${index + 1}`, species: 'sea-urchin', x, z, radius: 1.15, index })),
  ...crabSeeds.map(([x, z], index) => ({ id: `garden-crab-${index + 1}`, species: 'crab', x, z, radius: 2.8, index })),
].map(item => Object.freeze(item)));

/** Crabs sidestep within a small, clear patch; corals and urchins stay rooted. */
export function animalPoses(time = 0) {
  const t = safeTime(time);
  return animalDefinitions.map(animal => {
    const crab = animal.species === 'crab';
    const x = animal.x + (crab ? .48 * Math.sin(t * .45 + animal.index * 1.7) : 0);
    const z = animal.z + (crab ? .16 * Math.sin(t * .8 + animal.index) : 0);
    return { ...animal, x, z, y: waterPlayHeight(x, z) + .04,
      yaw: crab ? -.3 + animal.index * 1.1 + .12 * Math.sin(t * .7 + animal.index) : animal.index * 1.7,
      stride: crab ? Math.sin(t * 5 + animal.index * 1.4) : 0 };
  });
}

// Seeded scatter is created once. Its conservative footprints include swaying
// tips, crab movement and the existing stars, keeping the whole road clear.
function makePlantingPlan() {
  const stars = Array.from({ length: SEA_LIFE_COUNTS.stars }, (_, index) => starPose(index));
  const result = animalDefinitions.map(animal => ({ ...animal, kind: animal.species }));
  let seed = 70513;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (const [kind, count, radius] of [['kelp', 12, 1.7], ['seaweed', 30, 1.45], ['rock', 24, 1.1]]) {
    let placed = 0;
    for (let attempt = 0; placed < count && attempt < 12000; attempt++) {
      const x = 80 + random() * 92, z = 520 + random() * 72, point = { x, z };
      if (pathDistance(point) < GARDEN_PATH_WIDTH / 2 + radius + .55) continue;
      if (Math.hypot(x - GARDEN_ENTRANCE.x, z - GARDEN_ENTRANCE.z) < radius + 4) continue;
      if (stars.some(star => Math.hypot(star.x - x, star.z - z) < radius + star.size + .6)) continue;
      if (result.some(other => Math.hypot(other.x - x, other.z - z) < radius + other.radius + .35)) continue;
      result.push({ kind, x, z, radius, index: placed, height: kind === 'kelp' ? 4.5 + random() * 1.5 : kind === 'seaweed' ? 1.8 + random() * 1.6 : .6 + random() * .7, yaw: random() * TAU });
      placed++;
    }
  }
  return Object.freeze(result.map(item => Object.freeze(item)));
}
export const GARDEN_DECORATIONS = makePlantingPlan();

function bladeGeometry() {
  const vertices = [], indices = [];
  for (let step = 0; step <= 12; step++) {
    const t = step / 12, width = .15 * Math.sin(Math.PI * t) + .015 * (1 - t);
    const bend = Math.sin(t * 5) * .055, depth = .035 * Math.sin(t * 7);
    vertices.push(bend - width, t, depth, bend + width, t, depth);
    if (step < 12) { const index = step * 2; indices.push(index, index + 1, index + 2, index + 1, index + 3, index + 2); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

export function createUnderwaterGarden() {
  const root = new THREE.Group(); root.name = 'Underwater garden';
  const geometries = {
    sphere: new THREE.SphereGeometry(1, 12, 8), rock: new THREE.IcosahedronGeometry(1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 8), tube: new THREE.CylinderGeometry(1, 1, 1, 12, 1, true),
    cone: new THREE.ConeGeometry(1, 1, 6), ring: new THREE.TorusGeometry(1, .11, 6, 14),
    disk: new THREE.CircleGeometry(1, 12), blade: bladeGeometry(),
  };
  const materials = new Map();
  function material(color, double = false) {
    const key = `${color}:${double}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .8, ...(double ? { side: THREE.DoubleSide } : {}) }));
    return materials.get(key);
  }
  const batches = new Map(), dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  function put(shape, color, x, y, z, sx, sy, sz, rotation = null) {
    const key = shape;
    if (!batches.has(key)) batches.set(key, []);
    dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz);
    if (rotation?.isQuaternion) dummy.quaternion.copy(rotation); else dummy.rotation.set(...(rotation ?? [0, 0, 0]));
    dummy.updateMatrix(); batches.get(key).push({ matrix: dummy.matrix.clone(), color });
  }
  function beam(a, b, radius, color, shape = 'cylinder') {
    const direction = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const length = direction.length();
    put(shape, color, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, radius, length, radius, new THREE.Quaternion().setFromUnitVectors(up, direction.normalize()));
  }

  // Pale paving stays flat on the existing sand. The spur uses the same
  // material and height as the ring, so its T-junction has no step or seam.
  const pavingVertices = [], pavingIndices = [], groutVertices = [];
  for (let index = 0; index <= LOOP_SEGMENTS; index++) {
    const angle = index % LOOP_SEGMENTS * TAU / LOOP_SEGMENTS, center = GARDEN_LOOP[index];
    const nx = Math.sin(angle) / 34, nz = -Math.cos(angle) / 28, length = Math.hypot(nx, nz);
    for (const side of [-1, 1]) {
      const x = center.x + side * nx / length * GARDEN_PATH_WIDTH / 2, z = center.z + side * nz / length * GARDEN_PATH_WIDTH / 2;
      pavingVertices.push(x, waterPlayHeight(x, z) + .065, z);
      if (index % 3 === 0 && index > 1 && index < LOOP_SEGMENTS - 1) groutVertices.push(x, waterPlayHeight(x, z) + .075, z);
    }
    if (index < LOOP_SEGMENTS) { const v = index * 2; pavingIndices.push(v, v + 2, v + 1, v + 1, v + 2, v + 3); }
  }
  const spurStart = pavingVertices.length / 3;
  for (const z of [GARDEN_LOOP[0].z, GARDEN_ENTRANCE.z + 3]) for (const x of [122, 128]) pavingVertices.push(x, waterPlayHeight(x, z) + .065, z);
  pavingIndices.push(spurStart, spurStart + 2, spurStart + 1, spurStart + 1, spurStart + 2, spurStart + 3);
  const pavingGeometry = new THREE.BufferGeometry(); pavingGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pavingVertices, 3)); pavingGeometry.setIndex(pavingIndices); pavingGeometry.computeVertexNormals();
  const pavingMaterial = new THREE.MeshStandardMaterial({ color: '#f6e9c5', roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const paving = new THREE.Mesh(pavingGeometry, pavingMaterial); paving.name = 'Pale underwater garden road'; root.add(paving);
  const grout = new THREE.BufferGeometry(); grout.setAttribute('position', new THREE.Float32BufferAttribute(groutVertices, 3));
  const groutLines = new THREE.LineSegments(grout, new THREE.LineBasicMaterial({ color: '#b8c4b3', transparent: true, opacity: .7, depthWrite: false })); groutLines.name = 'Underwater paving joints'; root.add(groutLines);

  const coralColors = ['#f58b85', '#b294e4', '#57bed0', '#e985b4', '#efb75e', '#c38bcc'];
  for (const coral of animalDefinitions.filter(item => item.species === 'coral')) {
    const { x, z, index, form } = coral, y = waterPlayHeight(x, z) + .05, color = coralColors[index % coralColors.length];
    put('rock', '#91ada3', x, y + .22, z, 1.1, .3, .8);
    if (form === 'branching') {
      beam([x, y + .2, z], [x, y + 1.65, z], .22, color);
      for (let branch = 0; branch < 3; branch++) {
        const angle = branch * TAU / 3 + index;
        const middle = [x + Math.sin(angle) * .9, y + 2.2, z + Math.cos(angle) * .9];
        beam([x, y + 1.1, z], middle, .16, color);
        for (const side of [-1, 1]) {
          const end = [middle[0] + Math.sin(angle + side * .65) * .65, y + 3.1 + branch * .22, middle[2] + Math.cos(angle + side * .65) * .65];
          beam(middle, end, .105, color); put('sphere', '#ffd4af', ...end, .135, .135, .135);
        }
      }
    } else if (form === 'fan') {
      beam([x, y + .2, z], [x, y + 1.15, z], .13, color);
      const tips = [];
      for (let spoke = 0; spoke < 7; spoke++) {
        const angle = -1.15 + spoke * 2.3 / 6;
        const end = [x + Math.sin(angle) * 2, y + 1.1 + Math.cos(angle) * 2.6, z + .15 * Math.sin(spoke * 1.8)];
        beam([x, y + .65, z], end, .065, color); tips.push(end);
        put('sphere', '#efcaeb', ...end, .095, .095, .095);
      }
      for (let index = 0; index < tips.length - 1; index++) for (const fraction of [.5, .75, .93]) {
        const a = tips[index].map((value, axis) => [x, y + .65, z][axis] + (value - [x, y + .65, z][axis]) * fraction);
        const b = tips[index + 1].map((value, axis) => [x, y + .65, z][axis] + (value - [x, y + .65, z][axis]) * fraction);
        beam(a, b, .035, color);
      }
    } else if (form === 'tube') {
      for (let tube = 0; tube < 6; tube++) {
        const angle = tube * TAU / 6, tx = x + Math.sin(angle) * .7, tz = z + Math.cos(angle) * .7, height = 1.6 + tube % 3 * .5;
        put('tube', color, tx, y + height / 2, tz, .3, height, .3);
        put('ring', '#a4e5e3', tx, y + height, tz, .3, .3, .3, [Math.PI / 2, 0, 0]);
        put('disk', '#3e758e', tx, y + height - .07, tz, .28, .28, 1, [-Math.PI / 2, 0, 0]);
      }
    } else {
      for (let plate = 0; plate < 6; plate++) {
        const angle = plate * 2.4, px = x + Math.sin(angle) * .8, pz = z + Math.cos(angle) * .8, py = y + .5 + plate * .34;
        beam([x, y + .2, z], [px, py, pz], .09, '#bc6d9c');
        put('sphere', plate % 2 ? '#efb4c9' : color, px, py, pz, .95, .13, .78);
      }
    }
  }

  for (const urchin of animalDefinitions.filter(item => item.species === 'sea-urchin')) {
    const { x, z, index } = urchin, y = waterPlayHeight(x, z) + .6;
    const color = index % 2 ? '#74628c' : '#605c85';
    put('sphere', color, x, y, z, .55, .55, .55);
    for (let spine = 0; spine < 62; spine++) {
      const ny = .025 + spine / 62 * .975, angle = spine * 2.399963, radius = Math.sqrt(1 - ny * ny);
      const normal = new THREE.Vector3(Math.sin(angle) * radius, ny, Math.cos(angle) * radius);
      put('cone', spine % 3 ? color : '#aa91b4', x + normal.x * .78, y + normal.y * .78, z + normal.z * .78, .036, .55, .036, new THREE.Quaternion().setFromUnitVectors(up, normal));
    }
    for (const side of [-1, 1]) {
      put('sphere', '#f9edcf', x + side * .16, y + .1, z + .5, .085, .095, .065);
      put('sphere', '#34344e', x + side * .16, y + .1, z + .555, .035, .045, .025);
    }
  }

  const seaweedPlants = GARDEN_DECORATIONS.filter(item => item.kind === 'seaweed');
  const kelpPlants = GARDEN_DECORATIONS.filter(item => item.kind === 'kelp');
  const rockPlants = GARDEN_DECORATIONS.filter(item => item.kind === 'rock');
  for (const rock of rockPlants) put('rock', ['#8da9a0', '#9aa8ae', '#b5b3a3'][rock.index % 3], rock.x, waterPlayHeight(rock.x, rock.z) + rock.height * .4, rock.z, .8 + rock.index % 3 * .1, rock.height * .55, .7, [rock.index * .3, rock.yaw, .1]);
  for (const plant of [...seaweedPlants, ...kelpPlants]) put('rock', '#a1b8a6', plant.x, waterPlayHeight(plant.x, plant.z) + .1, plant.z, .5, .16, .4);
  for (const [shape, entries] of batches) {
    const mesh = new THREE.InstancedMesh(geometries[shape], material('#ffffff'), entries.length);
    mesh.name = `Garden ${shape} details`;
    entries.forEach((entry, index) => { mesh.setMatrixAt(index, entry.matrix); mesh.setColorAt(index, new THREE.Color(entry.color)); });
    mesh.computeBoundingSphere(); root.add(mesh);
  }

  const seaweed = new THREE.InstancedMesh(geometries.blade, material('#ffffff', true), seaweedPlants.length * 3);
  seaweed.name = 'Swaying colorful seaweed'; seaweed.frustumCulled = false; seaweed.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(seaweed);
  for (let index = 0; index < seaweed.count; index++) seaweed.setColorAt(index, new THREE.Color(['#4fa88d', '#83bb72', '#4ba8b2', '#b1ba6a'][Math.floor(index / 3) % 4]));
  const kelpStems = new THREE.InstancedMesh(geometries.cylinder, material('#779153'), kelpPlants.length);
  const kelpLeaves = new THREE.InstancedMesh(geometries.sphere, material('#a0b565'), kelpPlants.length * 8);
  kelpStems.name = 'Swaying kelp stalks'; kelpLeaves.name = 'Swaying kelp leaves';
  for (const mesh of [kelpStems, kelpLeaves]) { mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(mesh); }

  function meshBall(parent, name, color, x, y, z, sx, sy, sz) {
    const mesh = new THREE.Mesh(geometries.sphere, material(color)); mesh.name = name;
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh); return mesh;
  }
  function meshBeam(parent, a, b, radius, color) {
    const direction = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const mesh = new THREE.Mesh(geometries.cylinder, material(color)); mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    mesh.scale.set(radius, direction.length(), radius); mesh.quaternion.setFromUnitVectors(up, direction.normalize()); parent.add(mesh); return mesh;
  }
  const crabs = animalDefinitions.filter(item => item.species === 'crab').map(crab => {
    const group = new THREE.Group(); group.name = `Garden crab ${crab.index + 1}`; group.userData.animalId = crab.id;
    const color = ['#ed8967', '#df9a59', '#df7569', '#e6a177'][crab.index];
    meshBall(group, 'Crab shell', color, 0, .43, 0, .8, .33, .55);
    meshBall(group, 'Crab cream belly', '#f9c38d', 0, .25, .04, .62, .16, .46);
    const legs = [];
    for (const side of [-1, 1]) {
      for (let leg = 0; leg < 4; leg++) {
        const pivot = new THREE.Group(); pivot.position.set(side * .54, .24, -.37 + leg * .22); group.add(pivot);
        meshBeam(pivot, [0, 0, 0], [side * .57, .06, (leg - 1.5) * .12], .055, color);
        meshBeam(pivot, [side * .57, .06, (leg - 1.5) * .12], [side * .96, -.2, (leg - 1.5) * .19], .045, color);
        legs.push({ pivot, side, leg });
      }
      meshBeam(group, [side * .28, .55, .38], [side * .32, .97, .61], .055, color);
      meshBall(group, 'Crab eye', '#fff5d7', side * .32, 1, .64, .13, .15, .13);
      meshBall(group, 'Crab pupil', '#423c42', side * .32, 1.01, .75, .06, .075, .04);
      meshBeam(group, [side * .65, .44, .3], [side * 1.08, .63, .86], .12, color);
      const claw = new THREE.Group(); claw.position.set(side * 1.22, .65, 1.04); group.add(claw);
      meshBall(claw, 'Crab claw palm', color, 0, 0, 0, .29, .19, .29);
      for (const pincer of [-1, 1]) {
        const finger = meshBall(claw, 'Crab pincer', '#f6ad7e', pincer * .16, .015, .28, .105, .14, .3);
        finger.rotation.y = -pincer * .28;
      }
      legs.push({ claw, side });
    }
    meshBall(group, 'Crab happy mouth', '#a15550', 0, .4, .543, .12, .045, .035);
    return { id: crab.id, group, legs };
  });
  // The articulated rigs stay off-scene; their world matrices feed just two
  // instanced draws, including all tiny eyes, pincers and walking legs.
  const crabParts = new Map();
  for (const crab of crabs) crab.group.traverse(object => {
    if (!object.isMesh) return;
    const shape = object.geometry === geometries.sphere ? 'sphere' : 'cylinder';
    if (!crabParts.has(shape)) crabParts.set(shape, []);
    crabParts.get(shape).push(object);
  });
  const crabBatches = [...crabParts].map(([shape, parts]) => {
    const mesh = new THREE.InstancedMesh(geometries[shape], material('#ffffff'), parts.length);
    mesh.name = shape === 'sphere' ? 'Garden crab shells eyes and pincers' : 'Garden crab articulated legs and arms';
    mesh.userData.species = 'crab'; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    parts.forEach((part, index) => mesh.setColorAt(index, part.material.color)); root.add(mesh); return { mesh, parts };
  });

  const plantRoot = new THREE.Matrix4(), part = new THREE.Matrix4(), composed = new THREE.Matrix4();
  const plantQuaternion = new THREE.Quaternion(), plantPosition = new THREE.Vector3(), plantScale = new THREE.Vector3(), plantEuler = new THREE.Euler();
  function update(time = 0) {
    const t = safeTime(time);
    seaweedPlants.forEach((plant, index) => {
      for (let blade = 0; blade < 3; blade++) {
        const yaw = plant.yaw + blade * 2.15;
        dummy.position.set(plant.x + Math.sin(yaw) * .22, waterPlayHeight(plant.x, plant.z) + .08, plant.z + Math.cos(yaw) * .22);
        dummy.rotation.set(.055 * Math.sin(t * .85 + index + blade), yaw, .09 * Math.sin(t * .9 + index * 1.3 + blade));
        dummy.scale.set(1.5, plant.height * (1 - blade * .12), 1.5); dummy.updateMatrix(); seaweed.setMatrixAt(index * 3 + blade, dummy.matrix);
      }
    });
    kelpPlants.forEach((plant, index) => {
      plantQuaternion.setFromEuler(plantEuler.set(.045 * Math.sin(t * .7 + index), plant.yaw, .06 * Math.sin(t * .8 + index * 1.5)));
      plantRoot.compose(plantPosition.set(plant.x, waterPlayHeight(plant.x, plant.z) + .08, plant.z), plantQuaternion, plantScale.set(1, 1, 1));
      dummy.position.set(0, plant.height / 2, 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(.055, plant.height, .055); dummy.updateMatrix();
      kelpStems.setMatrixAt(index, composed.multiplyMatrices(plantRoot, dummy.matrix));
      for (let leaf = 0; leaf < 8; leaf++) {
        const side = leaf % 2 ? 1 : -1;
        dummy.position.set(side * .35, plant.height * (.22 + leaf * .09), 0); dummy.rotation.set(0, .2 * Math.sin(index), side * -.55);
        dummy.scale.set(.56 * (1 - leaf * .04), .14, .19); dummy.updateMatrix(); part.copy(dummy.matrix);
        kelpLeaves.setMatrixAt(index * 8 + leaf, composed.multiplyMatrices(plantRoot, part));
      }
    });
    for (const mesh of [seaweed, kelpStems, kelpLeaves]) mesh.instanceMatrix.needsUpdate = true;
    const poses = animalPoses(t);
    for (const crab of crabs) {
      const pose = poses.find(item => item.id === crab.id);
      crab.group.position.set(pose.x, pose.y, pose.z); crab.group.rotation.y = pose.yaw;
      for (const limb of crab.legs) {
        if (limb.pivot) { limb.pivot.rotation.y = .12 * Math.sin(t * 5 + limb.leg * Math.PI + pose.index); limb.pivot.rotation.z = limb.side * .025 * (1 + pose.stride); }
        else limb.claw.rotation.x = -.12 + .1 * Math.sin(t * 1.6 + pose.index + limb.side);
      }
      crab.group.updateMatrixWorld(true);
    }
    for (const { mesh, parts } of crabBatches) {
      parts.forEach((part, index) => mesh.setMatrixAt(index, part.matrixWorld)); mesh.instanceMatrix.needsUpdate = true;
    }
  }
  const counts = Object.freeze({ seaweed: seaweedPlants.length * 3, kelp: kelpPlants.length, rocks: rockPlants.length,
    coral: coralSeeds.length, seaUrchins: urchinSeeds.length, crabs: crabSeeds.length });
  let disposed = false;
  function dispose() {
    if (disposed) return; disposed = true;
    const usedGeometry = new Set(), usedMaterial = new Set(materials.values());
    root.traverse(object => { if (object.geometry) usedGeometry.add(object.geometry); if (object.material) usedMaterial.add(object.material); });
    for (const geometry of usedGeometry) geometry.dispose(); for (const mat of usedMaterial) mat.dispose(); root.removeFromParent();
  }
  update(0);
  return { root, update, animals: animalPoses(0), animalPoses, counts, dispose };
}
