/** Camera visibility geometry, independent of Three.js and the browser. */
export const CAMERA_ELEVATION_LIMITS = Object.freeze({ min: .26, max: 1.25 });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

export function buildingOccluders(buildings, padding = .22) {
  const boxes = [];
  function add(building, part, x, z, width, depth, bottom, top) {
    boxes.push(Object.freeze({ id: `${building.id}:${part}`,
      minX: x - width / 2 - padding, maxX: x + width / 2 + padding,
      minY: bottom - padding, maxY: top + padding,
      minZ: z - depth / 2 - padding, maxZ: z + depth / 2 + padding }));
  }
  for (const building of buildings) {
    if (![building.x, building.z, building.w, building.d, building.h].every(Number.isFinite)) continue;
    const shop = ['shop', 'bakery', 'cafe'].includes(building.kind);
    const publicBuilding = ['library', 'school', 'hall'].includes(building.kind);
    const roofHeight = shop ? 3.6 : publicBuilding ? 3 : 2.3;
    add(building, 'walls', building.x, building.z, building.w + .38, building.d + .38, 0, building.h + .2);
    // Keep the overhanging roof separate: an eave is not a wall down to ground.
    add(building, 'roof', building.x, building.z, building.w + 1.1, building.d + 1.15, building.h + .1, building.h + roofHeight + .2);
    if (shop) {
      const front = building.facing === 'north' ? -1 : 1;
      add(building, 'awning', building.x, building.z + front * (building.d / 2 + .7), building.w * .86, 1.5, building.h - 1.85, building.h - 1.2);
    }
    if (['school', 'hall'].includes(building.kind)) add(building, 'bell tower', building.x, building.z, 2.4, 2.4, building.h + roofHeight, building.h + roofHeight + 2.5);
  }
  return Object.freeze(boxes);
}

/** Slab intersection includes cameras inside a roof and parallel sight lines. */
export function segmentIntersectsBox(from, to, box) {
  let near = 0, far = 1;
  for (const [axis, minimum, maximum] of [['x', 'minX', 'maxX'], ['y', 'minY', 'maxY'], ['z', 'minZ', 'maxZ']]) {
    const start = from[axis], change = to[axis] - start;
    if (Math.abs(change) < 1e-10) {
      if (start < box[minimum] || start > box[maximum]) return false;
    } else {
      let entry = (box[minimum] - start) / change, exit = (box[maximum] - start) / change;
      if (entry > exit) [entry, exit] = [exit, entry];
      near = Math.max(near, entry); far = Math.min(far, exit);
      if (near > far) return false;
    }
  }
  return far > 1e-5 && near < 1 - 1e-5;
}

export function orbitCameraPosition(target, yaw, elevation, distance) {
  const horizontal = Math.cos(elevation) * distance;
  return { x: target.x + Math.sin(yaw) * horizontal,
    y: target.y + Math.sin(elevation) * distance,
    z: target.z + Math.cos(yaw) * horizontal };
}

/** Sample occupied lower cubes, not an irregular body's empty bounding space. */
export function characterVisibilityPoints({ x, y = 0, z, yaw = 0, width = 1, depth = 1, cells = [], face }) {
  const points = [], c = Math.cos(yaw), s = Math.sin(yaw);
  const worldPoint = (px, py, pz) => ({ x: x + px * c + pz * s, y: y + py, z: z - px * s + pz * c });
  if (face) points.push(worldPoint(face.x, face.y, face.z));
  const bottom = cells.filter(cell => cell.y === 0).sort((a, b) => a.x - b.x || (a.z ?? 0) - (b.z ?? 0));
  if (!bottom.length) points.push(worldPoint(0, .22, 0));
  else {
    const samples = Math.min(bottom.length, Math.max(3, Math.ceil(width / 4) + 1));
    const indices = new Set(Array.from({ length: samples }, (_, index) => Math.round(index * (bottom.length - 1) / Math.max(1, samples - 1))));
    for (const index of indices) {
      const cell = bottom[index];
      points.push(worldPoint(cell.x + .5 - width / 2, .27, (cell.z ?? 0) - (depth - 1) / 2 + .46));
    }
  }
  return points;
}

export function cameraViewBlocked(position, focusPoints, occluders) {
  return occluders.some(box => focusPoints.some(point => segmentIntersectsBox(point, position, box)));
}

/** Preserve heading and distance; find the first clear elevation above the request. */
export function resolveCameraClearance({ target, yaw, elevation, distance, focusPoints, occluders,
  minElevation = CAMERA_ELEVATION_LIMITS.min, maxElevation = CAMERA_ELEVATION_LIMITS.max }) {
  const requested = clamp(finite(elevation, .64), minElevation, maxElevation);
  const heading = finite(yaw, 0), radius = Math.max(.1, finite(distance, 76));
  const points = focusPoints?.length ? focusPoints : [target];
  const positionAt = angle => orbitCameraPosition(target, heading, angle, radius);
  // Reject unrelated streets before the more precise segment tests.
  const reach = radius + Math.max(...points.map(point => Math.hypot(point.x - target.x, point.z - target.z)));
  const nearby = occluders.filter(box => box.maxX >= target.x - reach && box.minX <= target.x + reach
    && box.maxZ >= target.z - reach && box.minZ <= target.z + reach);
  const clear = angle => !cameraViewBlocked(positionAt(angle), points, nearby);
  const result = (angle, occluded) => ({ position: positionAt(angle), elevation: angle,
    lift: angle - requested, occluded, yaw: heading, distance: radius });
  if (!nearby.length || clear(requested)) return result(requested, false);
  const steps = Math.max(1, Math.ceil((maxElevation - requested) / .035));
  let previous = requested;
  for (let step = 1; step <= steps; step++) {
    const angle = requested + (maxElevation - requested) * step / steps;
    if (clear(angle)) {
      let low = previous, high = angle;
      for (let iteration = 0; iteration < 10; iteration++) {
        const middle = (low + high) / 2;
        if (clear(middle)) high = middle; else low = middle;
      }
      return result(high, false);
    }
    previous = angle;
  }
  return result(maxElevation, true);
}

/** Rise promptly, return gently, and keep frame-rate-independent camera motion. */
export function smoothCameraLift(current, desired, dt) {
  const from = Math.max(0, finite(current, 0)), to = Math.max(0, finite(desired, 0));
  const step = Math.max(0, finite(dt, 0));
  return from + (to - from) * (1 - Math.exp(-step * (to > from ? 12 : 3)));
}
