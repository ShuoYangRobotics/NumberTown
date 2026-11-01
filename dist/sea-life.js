import * as THREE from './vendor/three.module.js';
import { WATER_PLAY } from './geography.js';
import { waterPlayHeight } from './terrain-data.js';

export const SEA_LIFE_COUNTS = Object.freeze({ fish: 30, stars: 14, turtles: 4 });
export const TURTLE_CYCLE = 184;
export const SEA_STAR_OUTLINE = Object.freeze(Array.from({ length: 10 }, (_, index) => {
  const angle = index * Math.PI / 5, radius = index % 2 ? .43 : 1;
  return Object.freeze({ x: Math.sin(angle) * radius, z: Math.cos(angle) * radius });
}));
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const safeTime = time => Number.isFinite(time) ? time : 0;
const modulo = (value, length) => ((value % length) + length) % length;
const fishColors = ['#ff9250', '#f4d34e', '#49c9d7', '#d783d8', '#54c4a0'];
const starColors = ['#f18d67', '#e7bc57', '#d783aa', '#b9a0df'];
const schoolX = [.72, .25, .52, .82, .37], schoolZ = [.14, .27, .45, .65, .83];

/** Five small schools follow smooth, deterministic loops at different depths. */
export function fishPose(index, time = 0) {
  const id = modulo(Math.floor(index), SEA_LIFE_COUNTS.fish), school = Math.floor(id / 6), member = id % 6;
  const t = safeTime(time), phase = t * .19 + school * 1.7 + member * .08;
  const radiusX = 5.5 + school * 1.15, radiusZ = 4.5 + school * .8;
  const centerX = school === 2 ? 130 : WATER_PLAY.xMin + (WATER_PLAY.xMax - WATER_PLAY.xMin) * schoolX[school];
  const centerZ = school === 2 ? 540 : WATER_PLAY.shoreZ + (WATER_PLAY.deepZ - WATER_PLAY.shoreZ) * schoolZ[school];
  const x = centerX
    + Math.sin(phase) * radiusX + (member % 3 - 1) * 1.65;
  const z = centerZ
    + Math.cos(phase * .83) * radiusZ + (Math.floor(member / 3) - .5) * 2;
  const floor = waterPlayHeight(x, z), depth = WATER_PLAY.waterY - floor;
  const size = Math.min(.8 + id % 4 * .13, depth / 2.4);
  const lower = floor + size * .9, upper = WATER_PLAY.waterY - size * .9;
  const fraction = (school === 2 ? .26 : .58) + (school === 2 ? .09 : .16) * Math.sin(t * .45 + member * .7 + school);
  const y = lower + (upper - lower) * fraction;
  return { x, y, z, floor, size, yaw: Math.atan2(Math.cos(phase) * radiusX, -Math.sin(phase * .83) * radiusZ * .83),
    tail: Math.sin(t * 6 + id * 1.7) * .42, school };
}

/** Starfish lie on the sand's tangent plane, including the sloping shore shelf. */
export function starPose(index) {
  const id = modulo(Math.floor(index), SEA_LIFE_COUNTS.stars);
  const across = [.2, .57, .81, .33, .68, .46, .12, .85, .3, .62, .46, .76, .19, .56][id];
  const along = [.11, .14, .19, .25, .3, .35, .43, .47, .54, .62, .69, .75, .82, .9][id];
  const garden = [[112, 531], [133, 535], [140, 548], [119, 553]][id - 4];
  const x = garden?.[0] ?? WATER_PLAY.xMin + (WATER_PLAY.xMax - WATER_PLAY.xMin) * across;
  const z = garden?.[1] ?? WATER_PLAY.shoreZ + (WATER_PLAY.deepZ - WATER_PLAY.shoreZ) * along;
  const floor = waterPlayHeight(x, z);
  const nx = waterPlayHeight(x - .25, z) - waterPlayHeight(x + .25, z);
  const nz = waterPlayHeight(x, z - .25) - waterPlayHeight(x, z + .25);
  const length = Math.hypot(nx, .5, nz);
  return { x, y: floor + .055, z, floor, size: .95 + id % 4 * .16, yaw: id * 1.93,
    normal: { x: nx / length, y: .5 / length, z: nz / length } };
}

function bezier(points, progress) {
  const t = smooth(progress), u = 1 - t;
  const x = u ** 3 * points[0][0] + 3 * u * u * t * points[1][0] + 3 * u * t * t * points[2][0] + t ** 3 * points[3][0];
  const z = u ** 3 * points[0][1] + 3 * u * u * t * points[1][1] + 3 * u * t * t * points[2][1] + t ** 3 * points[3][1];
  const dx = u * u * (points[1][0] - points[0][0]) + 2 * u * t * (points[2][0] - points[1][0]) + t * t * (points[3][0] - points[2][0]);
  const dz = u * u * (points[1][1] - points[0][1]) + 2 * u * t * (points[2][1] - points[1][1]) + t * t * (points[3][1] - points[2][1]);
  return { x, z, yaw: Math.atan2(dx, dz) };
}

/** Closed shore visits use broad, umbrella-free lanes. At time zero one turtle
 * is already basking, while the others swim, approach, and return to the sea.
 */
export function turtlePose(index, time = 0) {
  const id = modulo(Math.floor(index), SEA_LIFE_COUNTS.turtles), t = safeTime(time);
  const cycle = modulo(t + [110, 20, 70, 145][id], TURTLE_CYCLE);
  const lane = [70, 130, 160, 175][id], shore = WATER_PLAY.shoreZ;
  let point, phase;
  if (cycle < 56) {
    phase = 'swim';
    point = bezier([[lane - 9, shore + 44], [lane - 9, shore + 78], [lane + 8, shore + 78], [lane + 8, shore + 44]], cycle / 56);
  } else if (cycle < 82) {
    phase = 'approach';
    point = bezier([[lane + 8, shore + 44], [lane + 8, shore + 30], [lane, shore + 16], [lane, shore + 6]], (cycle - 56) / 26);
  } else if (cycle < 104) {
    phase = 'crawl';
    point = { x: lane, z: shore + 6 - 14 * smooth((cycle - 82) / 22), yaw: Math.PI };
  } else if (cycle < 134) {
    phase = 'bask';
    point = { x: lane, z: shore - 8, yaw: Math.PI + Math.PI * smooth((cycle - 128) / 6) };
  } else if (cycle < 156) {
    phase = 'return';
    point = { x: lane, z: shore - 8 + 14 * smooth((cycle - 134) / 22), yaw: 0 };
  } else {
    phase = 'return';
    point = bezier([[lane, shore + 6], [lane, shore + 20], [lane - 9, shore + 30], [lane - 9, shore + 44]], (cycle - 156) / 28);
  }
  const size = [1.1, 1, 1.18, .93][id], floor = waterPlayHeight(point.x, point.z);
  const floatingY = WATER_PLAY.waterY - 1.25 * size + .1 * Math.sin(t * .8 + id * 1.4);
  const y = Math.max(floor + .035, floatingY);
  const grounded = 1 - smooth((y - floor - .035) / .5);
  const normalZ = (waterPlayHeight(point.x, point.z - .5) - waterPlayHeight(point.x, point.z + .5)) * grounded;
  const normalLength = Math.hypot(1, normalZ);
  return { ...point, y, floor, size, phase, cycle, swimming: y - floor > .25,
    normal: { x: 0, y: 1 / normalLength, z: normalZ / normalLength },
    stroke: phase === 'bask' ? 0 : Math.sin(t * (point.z > shore + 9 ? 2.3 : 3.8) + id * 1.8) };
}

function finGeometry(vertices, triangles) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flat(), 3));
  geometry.setIndex(triangles); geometry.computeVertexNormals(); return geometry;
}

export function createSeaLife() {
  const root = new THREE.Group(); root.name = 'Sea life';
  const sphere = new THREE.SphereGeometry(1, 14, 10);
  const materials = new Map();
  function material(color, extra = '') {
    const key = color + extra;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .67, ...(extra === 'double' ? { side: THREE.DoubleSide } : {}) }));
    return materials.get(key);
  }
  const matrix = new THREE.Matrix4(), local = new THREE.Matrix4(), quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3(), scale = new THREE.Vector3(), euler = new THREE.Euler();
  function transform(x, y, z, sx = 1, sy = 1, sz = 1, yaw = 0) {
    return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(sx, sy, sz));
  }
  function instances(name, geometry, count, color = '#ffffff') {
    const mesh = new THREE.InstancedMesh(geometry, material(color), count);
    mesh.name = name; mesh.receiveShadow = false; root.add(mesh); return mesh;
  }
  const fish = {
    body: instances('School fish bodies', sphere, SEA_LIFE_COUNTS.fish),
    bands: instances('School fish ivory bands', sphere, SEA_LIFE_COUNTS.fish, '#fff3cf'),
    tails: instances('School fish tails', finGeometry([[0, 0, 0], [-.55, .07, -.8], [.55, .07, -.8], [-.55, -.07, -.8], [.55, -.07, -.8]], [0, 2, 1, 0, 3, 4, 0, 1, 3, 0, 4, 2, 1, 2, 4, 1, 4, 3]), SEA_LIFE_COUNTS.fish),
    fins: instances('School fish dorsal fins', finGeometry([[-.025, .28, -.35], [-.025, .73, -.52], [-.025, .32, .25], [.025, .28, -.35], [.025, .73, -.52], [.025, .32, .25]], [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0]), SEA_LIFE_COUNTS.fish),
    eyes: instances('School fish eyes', sphere, SEA_LIFE_COUNTS.fish * 2, '#fffdf0'),
    pupils: instances('School fish pupils', sphere, SEA_LIFE_COUNTS.fish * 2, '#213b43'),
    mouths: instances('School fish mouths', sphere, SEA_LIFE_COUNTS.fish, '#9c5947'),
  };
  const fishParts = {
    body: transform(0, 0, 0, .33, .4, .85), bands: transform(0, 0, -.08, .334, .405, .14),
    fins: transform(0, 0, 0), mouths: transform(0, -.1, .824, .075, .04, .045),
  };
  const fishPartEntries = Object.entries(fishParts), tailMatrix = new THREE.Matrix4();
  const fishEyeParts = [-1, 1].map(side => ({
    white: transform(side * .272, .11, .55, .115, .13, .13),
    pupil: transform(side * .345, .12, .6, .055, .075, .07),
  }));
  for (const mesh of Object.values(fish)) { mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
  for (let index = 0; index < SEA_LIFE_COUNTS.fish; index++) {
    const color = new THREE.Color(fishColors[Math.floor(index / 6)]);
    fish.body.setColorAt(index, color); fish.tails.setColorAt(index, color); fish.fins.setColorAt(index, color);
  }

  const starShape = new THREE.Shape();
  SEA_STAR_OUTLINE.forEach((point, index) => index ? starShape.lineTo(point.x, -point.z) : starShape.moveTo(point.x, -point.z));
  starShape.closePath();
  const starGeometry = new THREE.ExtrudeGeometry(starShape, { depth: .14, bevelEnabled: true, bevelThickness: .025, bevelSize: .025, bevelSegments: 1, steps: 1 });
  starGeometry.rotateX(-Math.PI / 2); starGeometry.userData.arms = 5;
  const stars = instances('Five-armed sea stars', starGeometry, SEA_LIFE_COUNTS.stars);
  const starDots = instances('Sea star raised cream dots', sphere, SEA_LIFE_COUNTS.stars * 15, '#ffe9c1');
  const starEyes = instances('Sea star tiny eyes', sphere, SEA_LIFE_COUNTS.stars * 2, '#784345');
  for (let index = 0; index < SEA_LIFE_COUNTS.stars; index++) {
    const pose = starPose(index);
    const normal = new THREE.Vector3(pose.normal.x, pose.normal.y, pose.normal.z);
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw));
    matrix.compose(position.set(pose.x, pose.y, pose.z), quaternion, scale.setScalar(pose.size));
    stars.setMatrixAt(index, matrix); stars.setColorAt(index, new THREE.Color(starColors[index % starColors.length]));
    for (let arm = 0; arm < 5; arm++) for (let dot = 0; dot < 3; dot++) {
      const angle = arm * TAU / 5, radius = .28 + dot * .23;
      starDots.setMatrixAt(index * 15 + arm * 3 + dot, local.multiplyMatrices(matrix, transform(Math.sin(angle) * radius, .175, Math.cos(angle) * radius, .034, .023, .034)));
    }
    for (let side = 0; side < 2; side++) starEyes.setMatrixAt(index * 2 + side, local.multiplyMatrices(matrix, transform((side - .5) * .22, .18, .05, .035, .022, .035)));
  }
  for (const mesh of [stars, starDots, starEyes]) mesh.computeBoundingSphere();

  function ball(parent, name, color, x, y, z, sx, sy, sz) {
    const mesh = new THREE.Mesh(sphere, material(color)); mesh.name = name;
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh); return mesh;
  }
  const turtles = Array.from({ length: SEA_LIFE_COUNTS.turtles }, (_, index) => {
    const group = new THREE.Group(); group.name = `Sea turtle ${index + 1}`; group.userData.kind = 'turtle'; group.userData.index = index; root.add(group);
    const green = ['#8eae69', '#83a86e', '#a3ba79', '#7fa476'][index];
    ball(group, 'Turtle cream belly', '#ddce91', 0, .18, 0, 1.11, .18, 1.4);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, TAU, 0, Math.PI / 2), material('#4f754c'));
    shell.name = 'Domed turtle shell'; shell.position.y = .22; shell.scale.set(1.2, .75, 1.48); group.add(shell);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1, .055, 8, 40), material('#c1b97a'));
    rim.name = 'Turtle shell rim'; rim.rotation.x = Math.PI / 2; rim.scale.set(1.2, 1.48, 1); rim.position.y = .24; group.add(rim);
    const hexGeometry = new THREE.CylinderGeometry(.29, .29, .045, 6);
    const hexCenters = [[0, 0], ...Array.from({ length: 6 }, (_, i) => [.63 * Math.sin(i * TAU / 6), .83 * Math.cos(i * TAU / 6)]), [0, 1.18], [0, -1.18]];
    hexCenters.forEach(([x, z], plate) => {
      const y = .22 + .75 * Math.sqrt(1 - (x / 1.2) ** 2 - (z / 1.48) ** 2);
      const mesh = new THREE.Mesh(hexGeometry, material(plate % 2 ? '#93b56b' : '#759650'));
      mesh.name = 'Hexagonal turtle shell plate'; mesh.position.set(x, y + .015, z);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x / 1.2 ** 2, (y - .22) / .75 ** 2, z / 1.48 ** 2).normalize()); group.add(mesh);
    });
    ball(group, 'Turtle neck', green, 0, .31, 1.32, .29, .25, .48);
    const head = ball(group, 'Turtle head', green, 0, .43, 1.74, .47, .36, .53);
    for (const side of [-1, 1]) {
      ball(group, 'Turtle ivory eye', '#fff9db', side * .32, .62, 1.98, .14, .16, .12);
      ball(group, 'Turtle dark pupil', '#233b35', side * .33, .63, 2.075, .075, .09, .055);
      ball(group, 'Turtle eye sparkle', '#ffffff', side * .32, .66, 2.123, .025, .03, .018);
      ball(group, 'Turtle rosy cheek', '#b0b173', side * .32, .34, 2.04, .12, .075, .07);
    }
    const smile = new THREE.CatmullRomCurve3([new THREE.Vector3(-.19, .33, 2.18), new THREE.Vector3(0, .28, 2.22), new THREE.Vector3(.19, .33, 2.18)]);
    const mouth = new THREE.Mesh(new THREE.TubeGeometry(smile, 10, .018, 5, false), material('#496c42')); mouth.name = 'Turtle smile'; group.add(mouth);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(.12, .6, 8), material(green)); tail.name = 'Turtle tail'; tail.rotation.x = -Math.PI / 2; tail.position.set(0, .16, -1.6); group.add(tail);
    const flippers = [];
    for (const front of [true, false]) for (const side of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(side * (front ? .86 : .73), .14, front ? .64 : -.94); group.add(pivot);
      ball(pivot, 'Turtle flipper', green, side * .53, 0, 0, front ? .82 : .63, .105, front ? .3 : .25);
      flippers.push({ pivot, side, front });
    }
    group.traverse(object => { if (object.isMesh) object.castShadow = true; });
    return { group, flippers, head };
  });

  function update(time = 0) {
    const t = safeTime(time);
    for (let index = 0; index < SEA_LIFE_COUNTS.fish; index++) {
      const pose = fishPose(index, t);
      quaternion.setFromEuler(euler.set(0, pose.yaw, 0));
      matrix.compose(position.set(pose.x, pose.y, pose.z), quaternion, scale.setScalar(pose.size));
      for (const [part, partMatrix] of fishPartEntries) fish[part].setMatrixAt(index, local.multiplyMatrices(matrix, partMatrix));
      tailMatrix.makeRotationY(pose.tail).setPosition(0, 0, -.77);
      fish.tails.setMatrixAt(index, local.multiplyMatrices(matrix, tailMatrix));
      for (let side = 0; side < 2; side++) {
        const eye = index * 2 + side;
        fish.eyes.setMatrixAt(eye, local.multiplyMatrices(matrix, fishEyeParts[side].white));
        fish.pupils.setMatrixAt(eye, local.multiplyMatrices(matrix, fishEyeParts[side].pupil));
      }
    }
    for (const mesh of Object.values(fish)) mesh.instanceMatrix.needsUpdate = true;
    turtles.forEach(({ group, flippers }, index) => {
      const pose = turtlePose(index, t);
      group.position.set(pose.x, pose.y, pose.z); group.scale.setScalar(pose.size);
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(pose.normal.x, pose.normal.y, pose.normal.z))
        .multiply(quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw));
      group.userData.phase = pose.phase;
      flippers.forEach(({ pivot, side, front }) => {
        pivot.rotation.y = side * ((front ? -.28 : .3) + pose.stroke * (pose.swimming ? .42 : .18) * (front ? 1 : -1));
        pivot.rotation.z = side * (pose.swimming ? .12 * pose.stroke : .015);
      });
    });
  }
  function diagnosticSnapshot(time = 0) {
    return { counts: SEA_LIFE_COUNTS, fish: Array.from({ length: SEA_LIFE_COUNTS.fish }, (_, i) => fishPose(i, time)),
      stars: Array.from({ length: SEA_LIFE_COUNTS.stars }, (_, i) => starPose(i)), turtles: Array.from({ length: SEA_LIFE_COUNTS.turtles }, (_, i) => turtlePose(i, time)) };
  }
  let disposed = false;
  function dispose() {
    if (disposed) return; disposed = true;
    const geometries = new Set(), usedMaterials = new Set();
    root.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) usedMaterials.add(object.material); });
    for (const geometry of geometries) geometry.dispose(); for (const mat of usedMaterials) mat.dispose();
    root.removeFromParent();
  }
  update(0);
  return { root, update, counts: SEA_LIFE_COUNTS, diagnosticSnapshot, dispose };
}
