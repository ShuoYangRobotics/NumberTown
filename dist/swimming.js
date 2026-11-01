import { WATER_PLAY } from './geography.js';
import { groundHeight } from './terrain-data.js';
import { isInSea } from './water-view.js';

export const SWIM_SPEED = 5;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Feet retain their absolute world height, rather than following the sand. */
export function bodyHeight(player) {
  const floor = groundHeight(player.x, player.z);
  if (isInSea(player) && Number.isFinite(player.swimY)) return clamp(player.swimY, floor, Math.max(floor, WATER_PLAY.waterY));
  return floor + Math.max(0, Number.isFinite(player.jump) ? player.jump : 0);
}

/** Call after horizontal movement. entryY is the height before that movement. */
export function stepSwimming(player, dt, direction = 0, entryY) {
  const floor = groundHeight(player.x, player.z);
  if (!isInSea(player)) { player.swimY = null; return bodyHeight(player); }
  if (!Number.isFinite(player.swimY)) player.swimY = Number.isFinite(entryY) ? entryY : floor + (player.jump || 0);
  const step = Number.isFinite(dt) ? clamp(dt, 0, .1) : 0;
  const input = Number.isFinite(direction) ? clamp(direction, -1, 1) : 0;
  player.swimY = clamp(player.swimY + input * SWIM_SPEED * step, floor, Math.max(floor, WATER_PLAY.waterY));
  player.jump = 0; player.jumpVelocity = 0;
  return player.swimY;
}

export function resetSwimming(player) { player.swimY = null; }

/** Horizontal collision applies only while two actual body spans overlap. */
export function bodiesOverlap(a, b) {
  const ay=bodyHeight(a),by=bodyHeight(b);
  return ay < by + Math.max(.3,b.height||1) + .08 && by < ay + Math.max(.3,a.height||1) + .08;
}

/** Check a proposed body at its actual depth, including a newly taller shape. */
export function hasBodyClearance(player, others) {
  return others.every(other => !bodiesOverlap(player, other) ||
    Math.hypot(player.x-other.x,player.z-other.z) >= (player.radius??.6)+(other.radius??.6)+.08);
}
