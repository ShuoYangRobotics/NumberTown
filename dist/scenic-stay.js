import { hillHeight } from './terrain-data.js';
import { mountainWalkHeight } from './mountain-route.js';

/** Retain a user's hill or mountain view until they return to flat ground. */
export function shouldStayAtScenicSpot(player) {
  if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.z)) return false;
  // Actual walking surfaces exclude bridges, the unwalkable mountain range,
  // and flat trail approaches. A small threshold releases a completed descent.
  return hillHeight(player.x, player.z) > .2 || (mountainWalkHeight(player.x, player.z) ?? 0) > .2;
}
