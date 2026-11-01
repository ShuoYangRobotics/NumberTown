import * as THREE from './vendor/three.module.js';
import { WATER_PLAY } from './geography.js';

export const WATER_BALL_RADIUS = .68;
const GRAVITY = 12;
const SAND_Y = .035;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = value => Number.isFinite(value);
const finiteState = state => state && ['x', 'y', 'z', 'vx', 'vy', 'vz', 'time', 'rollX', 'rollZ', 'splash', 'throws'].every(key => finite(state[key]));

function waveHeight(x, z, time) {
  const wet = clamp((z - WATER_PLAY.shoreZ + WATER_BALL_RADIUS) / 1.7, 0, 1);
  const afloat = WATER_PLAY.waterY + WATER_BALL_RADIUS * .62
    + .075 * Math.sin(time * 2.1 + x * .11) + .035 * Math.sin(time * 3.7 + z * .19);
  return SAND_Y + WATER_BALL_RADIUS + (afloat - SAND_Y - WATER_BALL_RADIUS) * wet;
}

export function createWaterBallState() {
  return {
    x: WATER_PLAY.spawn.x, y: waveHeight(WATER_PLAY.spawn.x, WATER_PLAY.spawn.z, 0), z: WATER_PLAY.spawn.z,
    vx: 0, vy: 0, vz: 0, radius: WATER_BALL_RADIUS, mode: 'floating', heldBy: null,
    carrierX: null, carrierZ: null, time: 0, rollX: 0, rollZ: 0, splash: 0, throws: 0,
  };
}

export function resetWaterBall(state) {
  Object.assign(state, createWaterBallState());
  return state;
}

function keepInBay(state) {
  const r = WATER_BALL_RADIUS;
  for (const [axis, velocity, min, max] of [
    ['x', 'vx', WATER_PLAY.xMin + r, WATER_PLAY.xMax - r],
    ['z', 'vz', WATER_PLAY.beachZ + r, WATER_PLAY.deepZ - r],
  ]) {
    if (state[axis] < min) { state[axis] = min; state[velocity] = Math.abs(state[velocity]) * .45; }
    if (state[axis] > max) { state[axis] = max; state[velocity] = -Math.abs(state[velocity]) * .45; }
  }
}

function validPlayer(player) {
  return player && Number.isInteger(player.number) && player.number >= 0
    && [player.x, player.z, player.yaw].every(finite);
}

function playerInBay(player) {
  return player.x >= WATER_PLAY.xMin && player.x <= WATER_PLAY.xMax
    && player.z >= WATER_PLAY.beachZ && player.z <= WATER_PLAY.deepZ;
}

function holdHeight(player) {
  const ground = finite(player.groundY) ? player.groundY : 0;
  const jump = finite(player.jump) ? Math.max(0, player.jump) : 0;
  const height = finite(player.height) ? player.height : 1;
  return ground + jump + clamp(height / 3 + .5, .8, 2.8);
}

/** Update after the carrier moves. A large position jump drops the ball at its
 * previous location, protecting it even if a travel action forgot to release.
 */
export function updateHeldWaterBall(state, player, time = state.time) {
  if (!validPlayer(player) || state.heldBy !== player.number) return false;
  if (!playerInBay(player) || finite(state.carrierX) && finite(state.carrierZ)
      && Math.hypot(player.x - state.carrierX, player.z - state.carrierZ) > 8) {
    releaseWaterBall(state, player);
    return false;
  }
  const depth = finite(player.depth) ? Math.max(0, player.depth) : 1;
  const reach = clamp(depth / 2 + .75, .95, 2.2);
  state.x = player.x + Math.sin(player.yaw) * reach + Math.cos(player.yaw) * .18;
  state.z = player.z + Math.cos(player.yaw) * reach - Math.sin(player.yaw) * .18;
  state.y = Math.max(SAND_Y + WATER_BALL_RADIUS, holdHeight(player))
    + .025 * Math.sin((finite(time) ? time : state.time) * 3);
  state.vx = 0; state.vy = 0; state.vz = 0; state.mode = 'held';
  state.carrierX = player.x; state.carrierZ = player.z;
  keepInBay(state);
  return true;
}

/** Pickup uses explicit null checks: Zero (number 0) is a valid carrier. */
export function pickUpWaterBall(state, player) {
  if (!finiteState(state) || !validPlayer(player) || !playerInBay(player) || state.heldBy !== null) return false;
  const reach = Math.max(0, finite(player.radius) ? player.radius : .7) + 2.2;
  const feetY = (finite(player.groundY) ? player.groundY : 0) + (finite(player.jump) ? Math.max(0, player.jump) : 0);
  // Every friend can reach down to the ground or water, regardless of their
  // holding height. Upward catches still have a limited reach above the hand.
  if (Math.hypot(state.x - player.x, state.z - player.z) > reach
      || state.y < feetY - WATER_BALL_RADIUS || state.y > holdHeight(player) + 2.4) return false;
  state.heldBy = player.number; state.carrierX = player.x; state.carrierZ = player.z;
  return updateHeldWaterBall(state, player);
}

/** Drop without consulting the player's new location: switching and fast
 * travel must not teleport an already held ball to the destination.
 */
export function releaseWaterBall(state, player) {
  if (state.heldBy === null || player && state.heldBy !== player.number) return false;
  state.heldBy = null; state.carrierX = null; state.carrierZ = null;
  state.vx = 0; state.vy = 0; state.vz = 0; state.mode = 'airborne';
  keepInBay(state);
  return true;
}

/** Facing follows the game's convention: yaw 0 throws toward +z. */
export function throwWaterBall(state, player, power = 12, lift = 7) {
  if (!finiteState(state) || !validPlayer(player) || state.heldBy !== player.number
      || !finite(power) || power <= 0 || !finite(lift) || lift <= 0) return false;
  if (!updateHeldWaterBall(state, player)) return false;
  const strength = clamp(power, 1, 22);
  state.heldBy = null; state.carrierX = null; state.carrierZ = null;
  state.vx = Math.sin(player.yaw) * strength; state.vz = Math.cos(player.yaw) * strength;
  state.vy = clamp(lift, 3, 11); state.mode = 'airborne'; state.throws++;
  return true;
}

/** Seconds, with optional frame-end world time. Returns a splash/landing event
 * or null. Substeps preserve throw arcs and shoreline crossings during stalls.
 */
export function stepWaterBall(state, dt, time) {
  if (!finite(dt) || dt <= 0) return null;
  if (!finiteState(state)) { resetWaterBall(state); return null; }
  const duration = Math.min(dt, 30), end = finite(time) ? time : state.time + duration;
  const steps = Math.ceil(duration * 240), h = duration / steps;
  state.radius = WATER_BALL_RADIUS;
  if (state.heldBy !== null) { state.time = end; state.splash = Math.max(0, state.splash - duration); return null; }
  const speed = Math.hypot(state.vx, state.vz);
  if (speed > 80) { state.vx *= 80 / speed; state.vz *= 80 / speed; }
  state.vy = clamp(state.vy, -50, 40);
  let event = null;
  for (let i = 0; i < steps; i++) {
    const t = end - duration + (i + 1) * h, previousX = state.x, previousZ = state.z;
    state.splash = Math.max(0, state.splash - h);
    if (state.mode === 'floating') {
      const currentX = .16 * Math.sin(t * .7 + state.z * .09);
      const currentZ = -.76 - .12 * Math.sin(t * .9 + state.z * .08);
      const damping = Math.exp(-2 * h), travel = (1 - damping) / 2;
      state.x += currentX * h + (state.vx - currentX) * travel;
      state.z += currentZ * h + (state.vz - currentZ) * travel;
      state.vx = currentX + (state.vx - currentX) * damping;
      state.vz = currentZ + (state.vz - currentZ) * damping;
      state.y = waveHeight(state.x, state.z, t); state.vy = 0;
      if (state.z <= WATER_PLAY.shoreZ - WATER_BALL_RADIUS) {
        state.mode = 'sand'; state.y = SAND_Y + WATER_BALL_RADIUS;
        event = { type: 'washed-ashore' };
      }
    } else if (state.mode === 'sand') {
      const damping = Math.exp(-3.8 * h), travel = (1 - damping) / 3.8;
      state.x += state.vx * travel; state.z += state.vz * travel;
      state.vx *= damping; state.vz *= damping; state.vy = 0; state.y = SAND_Y + WATER_BALL_RADIUS;
      if (Math.hypot(state.vx, state.vz) < .055) { state.vx = 0; state.vz = 0; }
      if (state.z >= WATER_PLAY.shoreZ) state.mode = 'floating';
    } else {
      state.mode = 'airborne';
      const damping = Math.exp(-.075 * h), travel = (1 - damping) / .075;
      state.x += state.vx * travel; state.z += state.vz * travel;
      state.vx *= damping; state.vz *= damping;
      state.y += state.vy * h - GRAVITY * h * h / 2; state.vy -= GRAVITY * h;
      const inWater = state.z >= WATER_PLAY.shoreZ;
      const floor = inWater ? waveHeight(state.x, state.z, t) : SAND_Y + WATER_BALL_RADIUS;
      if (state.y <= floor && state.vy <= 0) {
        state.y = floor;
        if (inWater) {
          state.mode = 'floating'; state.vy = 0; state.vx *= .38; state.vz *= .38;
          state.splash = 1; event = { type: 'splash' };
        } else if (state.vy < -2.4) {
          state.vy *= -.32; state.vx *= .7; state.vz *= .7;
        } else {
          state.mode = 'sand'; state.vy = 0; event = { type: 'landed' };
        }
      }
    }
    keepInBay(state);
    state.rollX = (state.rollX + (state.z - previousZ) / WATER_BALL_RADIUS) % (Math.PI * 2);
    state.rollZ = (state.rollZ - (state.x - previousX) / WATER_BALL_RADIUS) % (Math.PI * 2);
  }
  state.time = end;
  return event;
}

/** Bright spherical panels, a valve, a soft shadow and small water ripples. */
export function createWaterBall() {
  const root = new THREE.Group(); root.name = 'Beach ball water play';
  const ballMesh = new THREE.Group(); ballMesh.name = 'Throwable beach ball'; root.add(ballMesh);
  const colors = ['#f46d65', '#fff7d7', '#42bfd6', '#f8d54c', '#8f73d6', '#fff7d7'];
  for (const [index, color] of colors.entries()) {
    const panel = new THREE.Mesh(
      new THREE.SphereGeometry(WATER_BALL_RADIUS, 10, 22, index * Math.PI / 3, Math.PI / 3),
      new THREE.MeshStandardMaterial({ color, roughness: .35, metalness: .02 }),
    );
    panel.name = 'Colorful beach ball panel'; panel.castShadow = true;
    panel.userData.panel = index; ballMesh.add(panel);
  }
  const valve = new THREE.Mesh(new THREE.CircleGeometry(.085, 16), new THREE.MeshStandardMaterial({ color: '#fff9e8', roughness: .5 }));
  valve.name = 'Beach ball valve'; valve.rotation.x = -Math.PI / 2; valve.position.y = WATER_BALL_RADIUS + .003; ballMesh.add(valve);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.83, 28), new THREE.MeshBasicMaterial({ color: '#426a69', transparent: true, opacity: .16, depthWrite: false }));
  shadow.name = 'Beach ball shadow'; shadow.rotation.x = -Math.PI / 2; root.add(shadow);
  const ripples = Array.from({ length: 3 }, (_, index) => {
    const ripple = new THREE.Mesh(new THREE.RingGeometry(.72, .755, 48), new THREE.MeshBasicMaterial({ color: '#e8fbf2', transparent: true, opacity: .15, depthWrite: false, side: THREE.DoubleSide }));
    ripple.name = 'Beach ball ripple'; ripple.rotation.x = -Math.PI / 2; root.add(ripple);
    return ripple;
  });
  function update(state, time = state.time) {
    const live = finiteState(state) ? state : createWaterBallState(), t = finite(time) ? time : live.time;
    ballMesh.position.set(live.x, live.y, live.z);
    ballMesh.rotation.set(live.rollX + (live.mode === 'floating' ? Math.sin(t * 1.6) * .08 : 0), 0, live.rollZ);
    const water = live.z >= WATER_PLAY.shoreZ, surface = water ? WATER_PLAY.waterY : SAND_Y;
    shadow.position.set(live.x, surface + .012, live.z);
    shadow.material.opacity = .16 * Math.exp(-Math.max(0, live.y - surface - WATER_BALL_RADIUS) * .3);
    shadow.scale.setScalar(1 + Math.max(0, live.y - surface - WATER_BALL_RADIUS) * .035);
    ripples.forEach((ripple, index) => {
      const phase = ((t * .45 + index / 3) % 1 + 1) % 1;
      ripple.visible = water && live.heldBy === null && (live.mode === 'floating' || live.splash > 0);
      ripple.position.set(live.x, WATER_PLAY.waterY + .018, live.z);
      ripple.scale.setScalar(.8 + phase * 1.5 + live.splash * .5);
      ripple.material.opacity = (1 - phase) * (.14 + live.splash * .1);
    });
  }
  let disposed = false;
  function dispose() {
    if (disposed) return; disposed = true;
    root.traverse(object => { if (object.geometry) object.geometry.dispose(); if (object.material) object.material.dispose(); });
    root.removeFromParent();
  }
  update(createWaterBallState());
  return { root, ballMesh, update, dispose };
}
