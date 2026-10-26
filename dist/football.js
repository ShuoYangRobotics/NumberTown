import * as THREE from './vendor/three.module.js';
import { FIELD_OFFSET } from './geography.js';

export const FIELD = Object.freeze({
  x: 245 + FIELD_OFFSET.x, z: 149 + FIELD_OFFSET.z, width: 58, depth: 76,
  minX: 216 + FIELD_OFFSET.x, maxX: 274 + FIELD_OFFSET.x,
  minZ: 111 + FIELD_OFFSET.z, maxZ: 187 + FIELD_OFFSET.z,
  goalWidth: 12, goalDepth: 4, goalHeight: 4.8, ballRadius: .5,
});
export const FOOTBALL_LANDMARK = Object.freeze({
  id: 'football', name: 'Football', x: FIELD.x, z: FIELD.z, radius: 48,
  description: 'Pass, dribble, and score a friendly goal.',
  arrival: Object.freeze({ x: FIELD.x, z: FIELD.z + 9 }),
});

// The long sides have a 24-unit opening in the middle. Every fence, stand,
// and goal net is outside the playing rectangle; the entire pitch is walkable.
const FENCES = [
  { x: 210, z: 100, w: .28, d: 37 }, { x: 210, z: 161, w: .28, d: 37 },
  { x: 279.72, z: 100, w: .28, d: 37 }, { x: 279.72, z: 161, w: .28, d: 37 },
  { x: 210, z: 100, w: 27, d: .28 }, { x: 253, z: 100, w: 27, d: .28 },
  { x: 210, z: 197.72, w: 27, d: .28 }, { x: 253, z: 197.72, w: 27, d: .28 },
].map(shape => ({ ...shape, x: shape.x + FIELD_OFFSET.x, z: shape.z + FIELD_OFFSET.z }));
const STANDS = [{ x: 283, z: 119, w: 5, d: 18 }, { x: 283, z: 161, w: 5, d: 18 }]
  .map(shape => ({ ...shape, x: shape.x + FIELD_OFFSET.x, z: shape.z + FIELD_OFFSET.z }));
const GOAL_FRAMES = ['north', 'south'].flatMap(end => {
  const north = end === 'north', front = north ? FIELD.minZ - .3 : FIELD.maxZ + .3;
  const back = north ? FIELD.minZ - FIELD.goalDepth : FIELD.maxZ + FIELD.goalDepth;
  return [
    { id: `${end}-post-left`, x: FIELD.x - 6, z: front, radius: .17 },
    { id: `${end}-post-right`, x: FIELD.x + 6, z: front, radius: .17 },
    { id: `${end}-net-back`, x: FIELD.x - 6, z: back - .08, w: 12, d: .16 },
    { id: `${end}-net-left`, x: FIELD.x - 6 - .08, z: Math.min(front, back), w: .16, d: Math.abs(front - back) },
    { id: `${end}-net-right`, x: FIELD.x + 6 - .08, z: Math.min(front, back), w: .16, d: Math.abs(front - back) },
  ];
});
export const FOOTBALL_OBSTACLES = Object.freeze([
  ...FENCES.map((shape, i) => ({ id: `football-fence-${i}`, kind: 'fence', ...shape })),
  ...STANDS.map((shape, i) => ({ id: `football-stand-${i}`, kind: 'bleachers', ...shape })),
  ...GOAL_FRAMES.map(shape => ({ kind: 'goal', ...shape })),
].map(Object.freeze));

const FRICTION = .45;
const RESTITUTION = .65;
const MAX_KICK = 36;

export function createBallState() {
  return {
    x: FIELD.x, z: FIELD.z, vx: 0, vz: 0, radius: FIELD.ballRadius,
    scores: { north: 0, south: 0 }, goals: 0, lastGoal: null,
    resetIn: 0, rollX: 0, rollZ: 0,
  };
}

/** Recenter the ball. Scores survive unless clearScore is explicitly true. */
export function resetBall(state, { clearScore = false } = {}) {
  state.x = FIELD.x; state.z = FIELD.z; state.vx = 0; state.vz = 0;
  state.radius = FIELD.ballRadius; state.resetIn = 0; state.rollX = 0; state.rollZ = 0;
  if (clearScore) { state.scores = { north: 0, south: 0 }; state.goals = 0; state.lastGoal = null; }
  return state;
}

/**
 * Advance ground-plane physics in seconds. Returns null, or a single goal
 * event: {type:'goal', end:'north'|'south', goals, scores:{north,south}}.
 * A scored ball pauses in the goal for 1.4 seconds, then recenters. Goals are
 * counted only after the whole ball crosses the line inside the goal posts.
 */
export function stepBall(state, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return null;
  if (![state.x, state.z, state.vx, state.vz].every(Number.isFinite)) { resetBall(state); return null; }
  if (state.resetIn > 0) {
    state.resetIn = Math.max(0, state.resetIn - dt);
    if (!state.resetIn) resetBall(state);
    return null;
  }
  // All supported kicks settle well before 30 seconds. Bounding a background
  // tab's unusually long frame also prevents an unbounded simulation loop.
  const duration = Math.min(dt, 30), steps = Math.ceil(duration * 120), h = duration / steps;
  const speed = Math.hypot(state.vx, state.vz);
  if (speed > 80) { state.vx *= 80 / speed; state.vz *= 80 / speed; }
  const radius = FIELD.ballRadius;
  for (let i = 0; i < steps; i++) {
    const previousX = state.x, previousZ = state.z;
    const damping = Math.exp(-FRICTION * h), travel = (1 - damping) / FRICTION;
    state.x += state.vx * travel; state.z += state.vz * travel;
    state.vx *= damping; state.vz *= damping;
    if (state.x < FIELD.minX + radius) { state.x = FIELD.minX + radius; state.vx = Math.abs(state.vx) * RESTITUTION; }
    if (state.x > FIELD.maxX - radius) { state.x = FIELD.maxX - radius; state.vx = -Math.abs(state.vx) * RESTITUTION; }

    const inGoalMouth = Math.abs(state.x - FIELD.x) <= FIELD.goalWidth / 2 - radius;
    const north = state.z <= FIELD.minZ - radius, south = state.z >= FIELD.maxZ + radius;
    if (inGoalMouth && (north || south)) {
      const end = north ? 'north' : 'south';
      state.scores[end]++; state.goals++; state.lastGoal = end;
      state.z = north ? FIELD.minZ - 1 : FIELD.maxZ + 1;
      state.vx = 0; state.vz = 0; state.resetIn = 1.4;
      return { type: 'goal', end, goals: state.goals, scores: { ...state.scores } };
    }
    if (!inGoalMouth) {
      if (state.z < FIELD.minZ + radius) { state.z = FIELD.minZ + radius; state.vz = Math.abs(state.vz) * RESTITUTION; }
      if (state.z > FIELD.maxZ - radius) { state.z = FIELD.maxZ - radius; state.vz = -Math.abs(state.vz) * RESTITUTION; }
    }
    state.rollX += (state.z - previousZ) / radius;
    state.rollZ -= (state.x - previousX) / radius;
    if (Math.hypot(state.vx, state.vz) < .06) { state.vx = 0; state.vz = 0; }
  }
  return null;
}

/** Explicit kick: facing yaw uses the same +z-forward convention as players. */
export function kickBall(state, player, power = 24) {
  if (state.resetIn > 0 || ![player.x, player.z, player.yaw, power].every(Number.isFinite) || power <= 0) return false;
  const radius = Math.max(0, player.radius ?? .7);
  if (Math.hypot(state.x - player.x, state.z - player.z) > radius + 2.2) return false;
  const strength = Math.min(power, MAX_KICK);
  state.vx = Math.sin(player.yaw) * strength; state.vz = Math.cos(player.yaw) * strength;
  return true;
}

/** Gentle automatic dribbling. Call after player movement, before stepBall. */
export function updateBallContact(state, player, dt) {
  if (!player.moving || state.resetIn > 0 || !Number.isFinite(dt) || dt <= 0 ||
      ![player.x, player.z, player.yaw].every(Number.isFinite)) return false;
  const radius = Math.max(0, player.radius ?? .7), dx = state.x - player.x, dz = state.z - player.z;
  const distance = Math.hypot(dx, dz), fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
  if (distance > radius + FIELD.ballRadius + .35 || Math.hypot(state.vx, state.vz) > 9) return false;
  const nx = distance > .001 ? dx / distance : fx, nz = distance > .001 ? dz / distance : fz;
  if (nx * fx + nz * fz < -.2) return false;
  if (distance < radius + FIELD.ballRadius + .05) {
    state.x = player.x + nx * (radius + FIELD.ballRadius + .05);
    state.z = player.z + nz * (radius + FIELD.ballRadius + .05);
  }
  const mix = 1 - Math.exp(-Math.min(dt, .25) * 18);
  state.vx += (fx * 8 - state.vx) * mix; state.vz += (fz * 8 - state.vz) * mix;
  return true;
}

/** A real 3D pitch, goals and ball, with shared geometry and batched scenery. */
export function createFootball() {
  const root = new THREE.Group(); root.name = 'Football field';
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 10);
  const materials = new Map(), batches = new Map(), dummy = new THREE.Object3D();
  const material = color => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .9 }));
    return materials.get(color);
  };
  function put(geometry, color, x, y, z, sx, sy, sz, rotation = null, cast = true) {
    const key = `${geometry.uuid}:${color}:${cast}`;
    if (!batches.has(key)) batches.set(key, { geometry, material: material(color), matrices: [], cast });
    dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(0, 0, 0);
    if (rotation) dummy.quaternion.copy(rotation);
    dummy.updateMatrix(); batches.get(key).matrices.push(dummy.matrix.clone());
  }
  const box = (x, y, z, w, h, d, color, cast = false) => put(boxGeometry, color, x, y, z, w, h, d, null, cast);
  function pole(a, b, radius = .13, color = '#fffaf0') {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const center = start.clone().add(end).multiplyScalar(.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
    put(cylinderGeometry, color, center.x, center.y, center.z, radius, delta.length(), radius, q);
  }
  const line = (x, z, w, d) => box(x, .102, z, w, .018, d, '#fff9e5');
  box(FIELD.x, .012, FIELD.z, FIELD.width + 5, .045, FIELD.depth + 5, '#d7d5ad');
  for (let i = 0; i < 8; i++) box(FIELD.x, .055, FIELD.minZ + (i + .5) * FIELD.depth / 8,
    FIELD.width, .07, FIELD.depth / 8, i % 2 ? '#82b16d' : '#90bd79');
  for (const x of [FIELD.minX, FIELD.maxX]) line(x, FIELD.z, .18, FIELD.depth);
  for (const z of [FIELD.minZ, FIELD.z, FIELD.maxZ]) line(FIELD.x, z, FIELD.width, .18);
  function circle(x, z, radius, filled = false) {
    const geometry = filled ? new THREE.CircleGeometry(radius, 24) : new THREE.RingGeometry(radius - .085, radius + .085, 64);
    const mesh = new THREE.Mesh(geometry, material('#fff9e5'));
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, .114, z); root.add(mesh);
  }
  circle(FIELD.x, FIELD.z, 8); circle(FIELD.x, FIELD.z, .3, true);
  for (const sign of [-1, 1]) {
    const endZ = FIELD.z + sign * FIELD.depth / 2;
    for (const [width, depth] of [[30, 13], [18, 5.5]]) {
      line(FIELD.x, endZ - sign * depth, width, .18);
      line(FIELD.x - width / 2, endZ - sign * depth / 2, .18, depth);
      line(FIELD.x + width / 2, endZ - sign * depth / 2, .18, depth);
    }
    circle(FIELD.x, endZ - sign * 9, .25, true);
  }

  const nets = [];
  function netLine(a, b) { nets.push(...a, ...b); }
  for (const sign of [-1, 1]) {
    const front = FIELD.z + sign * (FIELD.depth / 2 + .3), back = FIELD.z + sign * (FIELD.depth / 2 + FIELD.goalDepth);
    const left = FIELD.x - FIELD.goalWidth / 2, right = FIELD.x + FIELD.goalWidth / 2, h = FIELD.goalHeight;
    pole([left, .1, front], [left, h, front]); pole([right, .1, front], [right, h, front]);
    pole([left, h, front], [right, h, front]);
    pole([left, .1, back], [left, h, back], .07); pole([right, .1, back], [right, h, back], .07);
    pole([left, h, back], [right, h, back], .07);
    for (const x of [left, right]) {
      pole([x, .15, front], [x, .15, back], .07); pole([x, h, front], [x, h, back], .07);
      for (let y = .1; y <= h; y += .6) netLine([x, y, front], [x, y, back]);
      for (let t = 0; t <= 1; t += .16) netLine([x, .1, front + (back - front) * t], [x, h, front + (back - front) * t]);
    }
    for (let x = left; x <= right + .01; x += .6) {
      netLine([x, .1, back], [x, h, back]); netLine([x, h, front], [x, h, back]);
    }
    for (let y = .1; y <= h; y += .6) netLine([left, y, back], [right, y, back]);
    for (let t = 0; t <= 1; t += .16) netLine([left, h, front + (back - front) * t], [right, h, front + (back - front) * t]);
  }
  const netGeometry = new THREE.BufferGeometry(); netGeometry.setAttribute('position', new THREE.Float32BufferAttribute(nets, 3));
  const net = new THREE.LineSegments(netGeometry, new THREE.LineBasicMaterial({ color: '#fffbed', transparent: true, opacity: .7 }));
  net.name = 'Two goal nets'; root.add(net);

  for (const fence of FENCES) {
    const horizontal = fence.w > fence.d, length = horizontal ? fence.w : fence.d;
    for (const y of [.55, 1.2]) box(fence.x + fence.w / 2, y, fence.z + fence.d / 2, fence.w, .12, fence.d, '#e8e4c9', true);
    for (let d = 0; d <= length; d += 3) box(fence.x + (horizontal ? d : fence.w / 2), .8,
      fence.z + (horizontal ? fence.d / 2 : d), .22, 1.6, .22, '#c5b794', true);
  }
  for (const stand of STANDS) {
    for (let row = 0; row < 3; row++) {
      box(stand.x + .8 + row * 1.5, .32 + row * .6, stand.z + stand.d / 2, 1.4, .24, stand.d, '#e0bd84', true);
      for (const z of [stand.z + 1, stand.z + stand.d - 1]) box(stand.x + .8 + row * 1.5, (.32 + row * .6) / 2, z,
        .18, .32 + row * .6, .18, '#8b9b88', true);
    }
  }
  for (const { geometry, material: mat, matrices, cast } of batches.values()) {
    const mesh = new THREE.InstancedMesh(geometry, mat, matrices.length);
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix)); mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = cast; mesh.receiveShadow = true; mesh.computeBoundingSphere(); root.add(mesh);
  }

  const ballMesh = new THREE.Group(); ballMesh.name = 'Kickable football';
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(FIELD.ballRadius, 28, 18), material('#fffdf5'));
  sphere.castShadow = true; ballMesh.add(sphere);
  // Twelve pentagons, arranged at the vertices of an icosahedron, make a
  // recognizable football without a texture, canvas, or external asset.
  const seed = new THREE.IcosahedronGeometry(1, 0), points = seed.attributes.position;
  const directions = new Map();
  for (let i = 0; i < points.count; i++) {
    const direction = new THREE.Vector3().fromBufferAttribute(points, i).normalize();
    directions.set(direction.toArray().map(n => n.toFixed(4)).join(','), direction);
  }
  const patchVertices = [];
  function patchTriangle(a, b, c, depth = 2) {
    if (!depth) { patchVertices.push(...a.toArray(), ...b.toArray(), ...c.toArray()); return; }
    const ab = a.clone().add(b).normalize().multiplyScalar(.507);
    const bc = b.clone().add(c).normalize().multiplyScalar(.507);
    const ca = c.clone().add(a).normalize().multiplyScalar(.507);
    patchTriangle(a, ab, ca, depth - 1); patchTriangle(ab, b, bc, depth - 1);
    patchTriangle(ca, bc, c, depth - 1); patchTriangle(ab, bc, ca, depth - 1);
  }
  for (const normal of directions.values()) {
    const reference = Math.abs(normal.y) > .9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const u = reference.clone().cross(normal).normalize(), v = normal.clone().cross(u).normalize();
    const center = normal.clone().multiplyScalar(.507), corners = [];
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      corners.push(normal.clone().addScaledVector(u, Math.cos(angle) * .33).addScaledVector(v, Math.sin(angle) * .33).normalize().multiplyScalar(.507));
    }
    for (let i = 0; i < 5; i++) patchTriangle(center, corners[i], corners[(i + 1) % 5]);
  }
  seed.dispose();
  const patchGeometry = new THREE.BufferGeometry(); patchGeometry.setAttribute('position', new THREE.Float32BufferAttribute(patchVertices, 3)); patchGeometry.computeVertexNormals();
  ballMesh.add(new THREE.Mesh(patchGeometry, material('#283b3c'))); root.add(ballMesh);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.65, 24), new THREE.MeshBasicMaterial({ color: '#426b42', transparent: true, opacity: .18, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .125; root.add(shadow);
  const update = state => {
    ballMesh.position.set(state.x, FIELD.ballRadius + .105, state.z);
    ballMesh.rotation.set(state.rollX, 0, state.rollZ);
    shadow.position.x = state.x; shadow.position.z = state.z;
  };
  update(createBallState());
  return { root, ballMesh, update };
}
