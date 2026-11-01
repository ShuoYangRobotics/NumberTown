import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { conformGroundMarker } from '../dist/ground-marker.js';
import { WATER_PLAY } from '../dist/geography.js';
import { groundHeight } from '../dist/terrain-data.js';

const near = (a, b, epsilon = 1e-5) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const createRing = () => new THREE.Mesh(new THREE.RingGeometry(.88, 1.02, 48), new THREE.MeshBasicMaterial());
const createShadow = () => new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial());
function worldVertices(mesh) {
  mesh.updateMatrixWorld(true);
  return Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i).applyMatrix4(mesh.matrixWorld));
}

test('flat markers preserve their original footprint, yaw, scale, material and clearance', () => {
  for (const make of [createRing, createShadow]) for (const yaw of [0, .7, Math.PI / 2, Math.PI]) {
    const marker = make(), reference = new THREE.Mesh(marker.geometry.clone());
    const material = marker.material, pose = { x: 16, z: 29, yaw, scaleX: 2, scaleZ: .85, offset: .16 };
    reference.position.set(pose.x, 4 + pose.offset, pose.z);
    reference.rotation.set(-Math.PI / 2, 0, yaw); reference.scale.set(pose.scaleX, pose.scaleZ, 1);
    assert.equal(conformGroundMarker(marker, pose, () => 4), true);
    assert.equal(marker.material, material);
    const expected = worldVertices(reference), actual = worldVertices(marker);
    assert.equal(actual.length, expected.length);
    actual.forEach((vertex, i) => { near(vertex.x, expected[i].x); near(vertex.y, expected[i].y); near(vertex.z, expected[i].z); });
  }
});

test('small and wide markers follow the actual seabed at every vertex across shore and deep-floor transitions', () => {
  for (const make of [createRing, createShadow]) {
    const marker = make();
    for (const width of [1, 3, 30, 1]) for (const yaw of [0, .7, Math.PI / 2, Math.PI]) {
      for (const z of [WATER_PLAY.shoreZ - 2, WATER_PLAY.shoreZ + 12, WATER_PLAY.shoreZ + 60, WATER_PLAY.shoreZ + WATER_PLAY.depthRamp - 2, WATER_PLAY.deepZ - 20]) {
        const pose = { x: 125, z, yaw, scaleX: Math.max(.9, width * .57), scaleZ: .85, offset: .16 };
        conformGroundMarker(marker, pose, groundHeight);
        for (const point of worldVertices(marker)) near(point.y - groundHeight(point.x, point.z), pose.offset);
      }
    }
  }
});

test('a wide shadow has enough radial rows to keep triangle interiors above curved slopes', () => {
  const marker = createShadow(), original = marker.geometry;
  let disposed = 0; original.addEventListener('dispose', () => disposed++);
  for (const z of [WATER_PLAY.shoreZ + 4, WATER_PLAY.shoreZ + 12, WATER_PLAY.shoreZ + 60, WATER_PLAY.shoreZ + WATER_PLAY.depthRamp - 4]) {
    conformGroundMarker(marker, { x: 125, z, yaw: Math.PI / 2, scaleX: 30 * .57 * .9, scaleZ: .85 * .85, offset: .13 }, groundHeight);
    const vertices = worldVertices(marker), indices = marker.geometry.index;
    for (let i = 0; i < indices.count; i += 3) {
      for (const [a, b, c] of [[1 / 3, 1 / 3, 1 / 3], [.6, .2, .2], [.2, .6, .2], [.2, .2, .6]]) {
        const point = vertices[indices.getX(i)].clone().multiplyScalar(a)
          .addScaledVector(vertices[indices.getX(i + 1)], b).addScaledVector(vertices[indices.getX(i + 2)], c);
        assert.ok(point.y - groundHeight(point.x, point.z) > .1, 'shadow triangle must not cut through the seabed');
      }
    }
  }
  assert.equal(disposed, 1, 'the replaced coarse fan is disposed once');
  assert.ok(marker.geometry.attributes.position.count < 350, 'the wide shadow remains a small mesh');
});

test('stationary markers avoid terrain sampling and geometry uploads, while movement and shape changes refresh', () => {
  const marker = createRing(), pose = { x: 10, z: 20, yaw: 0, scaleX: 1, scaleZ: 1, offset: .16 };
  let samples = 0;
  const height = (x, z) => { samples++; return .2 * z + Math.sin(x / 10); };
  conformGroundMarker(marker, pose, height);
  const initialSamples = samples, initialVersion = marker.geometry.attributes.position.version;
  for (let frame = 0; frame < 100; frame++) assert.equal(conformGroundMarker(marker, { ...pose }, height), false);
  assert.equal(samples, initialSamples); assert.equal(marker.geometry.attributes.position.version, initialVersion);
  marker.geometry.computeBoundingBox();
  for (const change of [{ x: 11 }, { yaw: .5 }, { scaleX: 17 }, { scaleZ: 2 }, { offset: .2 }]) {
    Object.assign(pose, change); assert.equal(conformGroundMarker(marker, pose, height), true);
    assert.ok(samples > initialSamples);
    const points = marker.geometry.attributes.position;
    const point = new THREE.Vector3();
    for (let i = 0; i < points.count; i++) {
      point.fromBufferAttribute(points, i);
      assert.ok(point.distanceTo(marker.geometry.boundingSphere.center) <= marker.geometry.boundingSphere.radius + 1e-7,
        'updated bounds enclose deformed vertices');
    }
  }
  assert.equal(conformGroundMarker(marker, pose, () => 0), true, 'changing the terrain provider invalidates the cache');
});

test('invalid poses and non-finite terrain do not corrupt an existing marker', () => {
  const marker = createRing(), pose = { x: 10, z: 20, yaw: .3, offset: .16 };
  conformGroundMarker(marker, pose, () => 0);
  const before = marker.geometry.attributes.position.array.slice(), position = marker.position.clone();
  for (const change of [{ x: NaN }, { z: Infinity }, { yaw: NaN }, { scaleX: 0 }, { scaleZ: -1 }]) {
    assert.equal(conformGroundMarker(marker, { ...pose, ...change }, () => 0), false);
  }
  let calls = 0;
  assert.equal(conformGroundMarker(marker, pose, () => ++calls > 4 ? NaN : 0), false);
  assert.deepEqual(marker.geometry.attributes.position.array, before); assert.deepEqual(marker.position, position);
});
