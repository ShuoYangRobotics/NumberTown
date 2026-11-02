import { ROAD_SEGMENTS, BUILDINGS, OBSTACLES, SQUARE } from './world-data.js';
import { WORLD, COAST, HILL, riverX, riverWidth } from './geography.js';
import { PARK } from './park.js';
import { FIELD } from './football.js';
import { TRAIN_PARK } from './train-park.js';

export const ROAD_FLOWER_COLORS = Object.freeze(['#ef839c', '#ffcf5a', '#ad89db', '#fff3c7', '#ed9568']);

const rectangleDistance = (x, z, rect) => Math.hypot(
  Math.max(rect.x - x, 0, x - rect.x - rect.w),
  Math.max(rect.z - z, 0, z - rect.z - rect.d),
);
export function roadFootprint(road) {
  return road.x1 === road.x2
    ? { x: road.x1 - road.width / 2, z: Math.min(road.z1, road.z2), w: road.width, d: Math.abs(road.z2 - road.z1) }
    : { x: Math.min(road.x1, road.x2), z: road.z1 - road.width / 2, w: Math.abs(road.x2 - road.x1), d: road.width };
}

// These are the same walkable doorstep ribbons drawn by createTown. Keeping
// them clear also leaves every front door visible from the road.
export const FLOWER_DOOR_CLEARANCES = Object.freeze(BUILDINGS.map(b => {
  const width = b.doorWidth ? b.doorWidth + (b.kind === 'house' ? 1.6 : 4) : b.kind === 'library' ? 9 : 3.7;
  const front = b.z + (b.facing === 'north' ? -1 : 1) * b.d / 2;
  return Object.freeze({ x: b.x - width / 2, z: Math.min(front, b.street) - .4, w: width, d: Math.abs(b.street - front) + .8 });
}));
const boundsRectangle = bounds => ({ x: bounds.minX, z: bounds.minZ, w: bounds.maxX - bounds.minX, d: bounds.maxZ - bounds.minZ });
const reserved = [
  { x: SQUARE.x - SQUARE.w / 2, z: SQUARE.z - SQUARE.d / 2, w: SQUARE.w, d: SQUARE.d },
  boundsRectangle(PARK.bounds), boundsRectangle(FIELD), boundsRectangle(TRAIN_PARK.bounds),
];
const buildings = BUILDINGS.map(b => ({ x: b.x - b.w / 2, z: b.z - b.d / 2, w: b.w, d: b.d }));
const housePlanters = BUILDINGS.filter(b => b.kind === 'house').map(b => {
  const north = b.facing === 'north', front = b.z + (north ? -1 : 1) * (b.d / 2 + .45);
  return { x: b.x + (north ? 1 : -1) * b.w * .36 - 1.1, z: front - .325, w: 2.2, d: .65 };
});
const scenery = OBSTACLES.filter(o => o.kind !== 'building');
const roadFootprints = ROAD_SEGMENTS.map(roadFootprint);

export function isRoadFlowerSiteClear({ x, z, radius }) {
  if (x - radius < WORLD.minX + 1 || x + radius > WORLD.width - 1 || z - radius < 76 || z + radius > COAST.beachStart - 1) return false;
  if (Math.abs(x - riverX(z)) < riverWidth(z) / 2 + radius + 1.5) return false;
  if (Math.hypot(x - HILL.x, z - HILL.z) < HILL.radius + radius + .5) return false;
  if (roadFootprints.some(rect => rectangleDistance(x, z, rect) < radius + .18)) return false;
  if (buildings.some(rect => rectangleDistance(x, z, rect) < radius + .2)) return false;
  if ([...reserved, ...FLOWER_DOOR_CLEARANCES, ...housePlanters].some(rect => rectangleDistance(x, z, rect) < radius + .2)) return false;
  return !scenery.some(o => o.radius !== undefined
    ? Math.hypot(x - o.x, z - o.z) < radius + o.radius + .25
    : rectangleDistance(x, z, o) < radius + .25);
}

/** Deterministic roadside pockets: narrow verges get three blooms, boulevards
 * get five. There are no colliders, and intersections stay completely open. */
export function createRoadFlowerBeds() {
  const beds = [];
  for (const [roadIndex, road] of ROAD_SEGMENTS.entries()) {
    const dx = road.x2 - road.x1, dz = road.z2 - road.z1, length = Math.hypot(dx, dz);
    if (length < 8) continue;
    const tx = dx / length, tz = dz / length;
    const radius = road.width >= 14 ? 1.02 : .55;
    const step = road.width >= 14 ? 6.4 : 4.8;
    for (const side of [-1, 1]) for (let distance = 2.4; distance <= length - 2; distance += step) {
      const offset = side * (road.width / 2 + radius + .25);
      const bed = { roadId: road.id, side, x: road.x1 + tx * distance - tz * offset,
        z: road.z1 + tz * distance + tx * offset, radius, tx, tz,
        colorIndex: (roadIndex + Math.floor(distance / step) + (side > 0 ? 2 : 0)) % ROAD_FLOWER_COLORS.length,
        bloomCount: road.width >= 14 ? 5 : 3 };
      if (!isRoadFlowerSiteClear(bed)) continue;
      if (beds.some(other => Math.hypot(other.x - bed.x, other.z - bed.z) < other.radius + radius + .35)) continue;
      beds.push(Object.freeze(bed));
    }
  }
  return beds;
}

export const ROAD_FLOWER_BEDS = Object.freeze(createRoadFlowerBeds());
