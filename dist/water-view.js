import { WATER_PLAY } from './geography.js';
import { waterPlayHeight } from './terrain-data.js';

/** Actual sea coordinates, excluding the dry beach and surrounding ocean. */
export function isInSea(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.z)
    && point.x >= WATER_PLAY.xMin && point.x <= WATER_PLAY.xMax
    && point.z >= WATER_PLAY.shoreZ && point.z <= WATER_PLAY.deepZ;
}

export function waterDepthAt(point) {
  return isInSea(point) ? Math.max(0, WATER_PLAY.waterY - waterPlayHeight(point.x, point.z)) : 0;
}

/** Use visual height so the number label and accessories also submerge. */
export function immersionFor(player, visualHeight = player?.height ?? 1) {
  const depth = waterDepthAt(player);
  const jump = Number.isFinite(player?.swimY) && isInSea(player) ? Math.max(0, player.swimY - waterPlayHeight(player.x, player.z)) : Number.isFinite(player?.jump) ? Math.max(0, player.jump) : 0;
  const height = Number.isFinite(visualHeight) ? Math.max(0, visualHeight) : 1;
  return { depth, wet: depth > jump + .12, submerged: depth > height + jump + .1 };
}

/** A short transition avoids a flash as the orbit camera crosses the surface. */
export function cameraWaterBlend(point) {
  // Orbiting can put the camera beyond the playable buoys, still under sea.
  if (!point || ![point.x, point.y, point.z].every(Number.isFinite) || point.z < WATER_PLAY.shoreZ) return 0;
  return Math.max(0, Math.min(1, (WATER_PLAY.waterY - point.y) / 1.5));
}
