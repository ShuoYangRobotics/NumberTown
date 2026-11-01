import { RingGeometry } from './vendor/three.module.js';

const markers = new WeakMap();
const MAX_EDGE = 3;

function prepare(marker, scaleX, scaleZ) {
  let cache = markers.get(marker);
  if (!cache || cache.geometry !== marker.geometry) {
    const geometry = marker.geometry, p = geometry.parameters;
    const circle = geometry.type === 'CircleGeometry';
    cache = { geometry, pose: null, surface: null,
      shape: circle || geometry.type === 'RingGeometry' ? {
        innerRadius: circle ? 0 : p.innerRadius, outerRadius: circle ? p.radius : p.outerRadius,
        thetaSegments: p.thetaSegments ?? p.segments, phiSegments: p.phiSegments ?? 1,
        thetaStart: p.thetaStart, thetaLength: p.thetaLength,
      } : null };
    markers.set(marker, cache);
  }
  if (cache.shape) {
    const shape = cache.shape, extent = Math.max(scaleX, scaleZ);
    const theta = Math.max(shape.thetaSegments, Math.ceil(shape.thetaLength * shape.outerRadius * extent / MAX_EDGE));
    const radial = Math.max(shape.phiSegments, Math.ceil((shape.outerRadius - shape.innerRadius) * extent / MAX_EDGE));
    // A circle's original fan has long triangles across wide footprints. Add
    // radial rows so its interior follows curved slopes as well as its rim.
    if (theta > (cache.theta ?? shape.thetaSegments) || radial > (cache.radial ?? shape.phiSegments)) {
      const geometry = new RingGeometry(shape.innerRadius, shape.outerRadius,
        Math.max(theta, cache.theta ?? 0), Math.max(radial, cache.radial ?? 0), shape.thetaStart, shape.thetaLength);
      cache.geometry.dispose(); marker.geometry = cache.geometry = geometry;
      cache.theta = geometry.parameters.thetaSegments; cache.radial = geometry.parameters.phiSegments;
      cache.pose = null; cache.positions = null;
    }
  }
  if (!cache.positions) {
    const positions = cache.geometry.attributes.position;
    cache.positions = Float32Array.from(positions.array);
    cache.heights = new Float32Array(positions.count);
  }
  return cache;
}

/** Conform an unlit XY-plane marker with its own geometry to a static terrain.
 * Its world footprint matches rotation (-PI/2, 0, yaw) and (scaleX, scaleZ, 1).
 * Stationary poses reuse their mesh; returns true only when it was updated.
 */
export function conformGroundMarker(marker, { x, z, yaw = 0, scaleX = 1, scaleZ = 1, offset = .1 }, heightAt) {
  if (!marker?.geometry?.attributes?.position || typeof heightAt !== 'function'
      || ![x, z, yaw, scaleX, scaleZ, offset].every(Number.isFinite) || scaleX <= 0 || scaleZ <= 0) return false;
  const cache = prepare(marker, scaleX, scaleZ), pose = [x, z, yaw, scaleX, scaleZ, offset];
  if (cache.surface === heightAt && cache.pose?.every((value, i) => value === pose[i])) return false;
  const centerY = heightAt(x, z), cosine = Math.cos(yaw), sine = Math.sin(yaw);
  if (!Number.isFinite(centerY)) return false;
  const positions = cache.geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const localX = cache.positions[i * 3] * scaleX, localY = cache.positions[i * 3 + 1] * scaleZ;
    const height = heightAt(x + cosine * localX - sine * localY, z - sine * localX - cosine * localY);
    if (!Number.isFinite(height)) return false;
    cache.heights[i] = height - centerY;
  }
  for (let i = 0; i < positions.count; i++) positions.setZ(i, cache.heights[i]);
  positions.needsUpdate = true;
  cache.geometry.computeBoundingSphere();
  if (cache.geometry.boundingBox) cache.geometry.computeBoundingBox();
  marker.position.set(x, centerY + offset, z);
  marker.rotation.set(-Math.PI / 2, 0, yaw); marker.scale.set(scaleX, scaleZ, 1);
  cache.pose = pose; cache.surface = heightAt;
  return true;
}
