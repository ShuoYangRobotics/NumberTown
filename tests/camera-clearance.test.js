import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from '../dist/vendor/three.module.js';
import { BUILDINGS } from '../dist/world-data.js';
import { getCharacterDefinition } from '../dist/character-data.js';
import { createCharacter } from '../dist/characters3d.js';
import {
  CAMERA_ELEVATION_LIMITS, buildingOccluders, segmentIntersectsBox,
  orbitCameraPosition, characterVisibilityPoints, cameraViewBlocked,
  resolveCameraClearance, smoothCameraLift,
} from '../dist/camera-clearance.js';

const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);
const occluders = buildingOccluders(BUILDINGS);
function characterPoints(definition, position) {
  const model = createCharacter(definition.number, { definition });
  const points = characterVisibilityPoints({ ...definition, ...position, face: model.root.userData.faceCenter });
  model.dispose(); return points;
}
const framePoints = characterPoints(getCharacterDefinition(43), { x: -140, y: 0, z: 122, yaw: .26 });
const shopView = { target: { x: -140, y: 4, z: 122 }, yaw: .26, elevation: .64,
  distance: 76, focusPoints: framePoints, occluders };

test('segment boxes handle parallel rays, inside cameras, negative coordinates, and obstacles beyond the view', () => {
  const box = { minX: -12, maxX: -8, minY: 0, maxY: 5, minZ: 3, maxZ: 7 };
  assert.equal(segmentIntersectsBox({ x: -10, y: 2, z: 0 }, { x: -10, y: 2, z: 10 }, box), true);
  assert.equal(segmentIntersectsBox({ x: -10, y: 2, z: 0 }, { x: -10, y: 2, z: 5 }, box), true);
  assert.equal(segmentIntersectsBox({ x: -10, y: 6, z: 0 }, { x: -10, y: 6, z: 10 }, box), false);
  assert.equal(segmentIntersectsBox({ x: -7, y: 2, z: 0 }, { x: -7, y: 2, z: 10 }, box), false);
  assert.equal(segmentIntersectsBox({ x: -10, y: 2, z: 0 }, { x: -10, y: 2, z: 2 }, box), false);
  assert.equal(segmentIntersectsBox({ x: -10, y: 2, z: 8 }, { x: -10, y: 2, z: 12 }, box), false);
});

test('building volumes include the actual roof types, awnings and public towers without turning eaves into ground walls', () => {
  for (const [kind, roofHeight] of [['house', 2.3], ['shop', 3.6], ['library', 3], ['school', 3]]) {
    const building = { id: kind, kind, x: -140, z: 146, w: 26, d: 22, h: 12 };
    const boxes = buildingOccluders([building], 0), roof = boxes.find(box => box.id.endsWith(':roof'));
    close(roof.maxY, 12 + roofHeight + .2); close(roof.minY, 12.1);
    close(roof.minX, -153.55); close(roof.maxZ, 157.575);
    const underEave = { x: -153.4, y: .5, z: 146 };
    assert.equal(boxes.some(box => segmentIntersectsBox(underEave, { ...underEave, y: 1 }, box)), false);
  }
  const boxes = buildingOccluders([{ id: 'north', kind: 'shop', facing: 'north', x: -100, z: 20, w: 26, d: 22, h: 12 }], 0);
  const awning = boxes.find(box => box.id.endsWith(':awning'));
  assert.ok(awning.maxZ < 10 && awning.minZ < 8, 'a north-facing awning must stay on the north side');
  const tower = buildingOccluders([{ id: 'school', kind: 'school', x: 0, z: 0, w: 16, d: 12, h: 5.8 }], 0).find(box => box.id.endsWith(':bell tower'));
  close(tower.maxY, 11.3);
});

test('the default Forty-Three market view rises only as far as needed to clear the foreground store', () => {
  assert.equal(cameraViewBlocked(orbitCameraPosition(shopView.target, .26, .64, 76), framePoints, occluders), true, 'exercise the reported hidden character');
  const resolved = resolveCameraClearance(shopView);
  assert.equal(resolved.occluded, false);
  assert.ok(resolved.elevation > .85 && resolved.elevation < 1.02, 'a nearby shop needs a modest rise, not the maximum overhead view');
  close(resolved.yaw, .26); close(resolved.distance, 76);
  close(Math.hypot(resolved.position.x + 140, resolved.position.y - 4, resolved.position.z - 122), 76);
  assert.equal(cameraViewBlocked(resolved.position, framePoints, occluders), false);
  assert.equal(cameraViewBlocked(orbitCameraPosition(shopView.target, .26, resolved.elevation - .002, 76), framePoints, occluders), true, 'the solver should select the lowest clear elevation');
});

test('open streets and manual rotation retain the requested orbit exactly', () => {
  for (const options of [{ ...shopView, occluders: [] }, { ...shopView, yaw: Math.PI / 2 }]) {
    const resolved = resolveCameraClearance(options);
    assert.equal(resolved.elevation, options.elevation); assert.equal(resolved.lift, 0);
    assert.deepEqual(resolved.position, orbitCameraPosition(options.target, options.yaw, options.elevation, options.distance));
    assert.equal(resolved.yaw, options.yaw); assert.equal(resolved.distance, options.distance);
  }
});

test('Fifty’s fifty-wide form clears roofs without shortening the camera or clipping its full width', () => {
  const original = getCharacterDefinition(50);
  const definition = { ...original, formId: '50x1', transformed: true, width: 50, height: 1, depth: 1,
    cells: original.cells.map((cell, index) => ({ ...cell, x: index, y: 0, z: 0 })) };
  const focusPoints = characterPoints(definition, { x: -140, y: 0, z: 330, yaw: 0 });
  const options = { target: { x: -140, y: 1.4, z: 330 }, yaw: Math.PI, elevation: .26, distance: 140, focusPoints, occluders };
  const resolved = resolveCameraClearance(options);
  assert.equal(resolved.occluded, false); assert.ok(resolved.lift > 0);
  assert.equal(resolved.distance, 140); assert.equal(resolved.yaw, Math.PI);
  assert.equal(cameraViewBlocked(resolved.position, focusPoints, occluders), false);
  const camera = new PerspectiveCamera(42, 1.5, .3, 1300);
  camera.position.set(resolved.position.x, resolved.position.y, resolved.position.z);
  camera.lookAt(options.target.x, options.target.y, options.target.z); camera.updateMatrixWorld();
  for (const point of focusPoints) {
    const projected = new Vector3(point.x, point.y, point.z).project(camera);
    assert.ok(Math.abs(projected.x) < .95 && Math.abs(projected.y) < .95 && projected.z < 1, 'the wide body must stay inside the view');
  }
});

test('visibility samples follow occupied lower cubes in sparse forms and retain their true rotated depth', () => {
  const definition = getCharacterDefinition(31), points = characterPoints(definition, { x: -220, y: 4, z: 120, yaw: 0 });
  assert.ok(points.slice(1).every(point => point.x < -220.5), 'calendar feet belong below its left cells, not the empty bounding center');
  const rotated = characterVisibilityPoints({ x: -10, y: 2, z: -30, yaw: Math.PI / 2, width: 1, depth: 3,
    cells: [{ x: 0, y: 0, z: 2 }], face: { x: 0, y: 1, z: 1.65 } });
  close(rotated[0].x, -8.35); close(rotated[0].y, 3); close(rotated[0].z, -30);
  close(rotated[1].x, -8.54); close(rotated[1].y, 2.27);
  const tall = characterPoints(getCharacterDefinition(47), { x: -140, y: 0, z: 122, yaw: .26 });
  assert.equal(resolveCameraClearance({ ...shopView, target: { ...shopView.target, y: 8.5 }, focusPoints: tall }).occluded, false);
});

test('negative-world translations preserve clearance and elevation limits cannot be exceeded', () => {
  const shift = { x: -1000, z: -500 };
  const moved = resolveCameraClearance({ ...shopView,
    target: { ...shopView.target, x: shopView.target.x + shift.x, z: shopView.target.z + shift.z },
    focusPoints: framePoints.map(point => ({ ...point, x: point.x + shift.x, z: point.z + shift.z })),
    occluders: occluders.map(box => ({ ...box, minX: box.minX + shift.x, maxX: box.maxX + shift.x, minZ: box.minZ + shift.z, maxZ: box.maxZ + shift.z })),
  });
  const original = resolveCameraClearance(shopView); close(moved.elevation, original.elevation);
  close(moved.position.x, original.position.x + shift.x); close(moved.position.z, original.position.z + shift.z);
  for (const [elevation, expected] of [[-10, CAMERA_ELEVATION_LIMITS.min], [10, CAMERA_ELEVATION_LIMITS.max]]) {
    const resolved = resolveCameraClearance({ ...shopView, elevation, occluders: [] });
    assert.equal(resolved.elevation, expected); assert.equal(resolved.distance, 76);
  }
  const impossible = resolveCameraClearance({ target: { x: 0, y: 1, z: 0 }, yaw: 0, elevation: .26, distance: 17,
    focusPoints: [{ x: 0, y: .3, z: 0 }], occluders: [{ minX: -10, maxX: 10, minY: 0, maxY: 500, minZ: 2, maxZ: 30 }] });
  assert.equal(impossible.elevation, 1.25); assert.equal(impossible.occluded, true);
  assert.ok(Object.values(impossible.position).every(Number.isFinite));
});

test('automatic lift rises and releases smoothly with the same motion at different frame rates', () => {
  function advance(start, target, seconds, fps) {
    let value = start;
    for (let frame = 0; frame < seconds * fps; frame++) {
      const next = smoothCameraLift(value, target, 1 / fps);
      assert.ok(next >= Math.min(value, target) && next <= Math.max(value, target)); value = next;
    }
    return value;
  }
  const raised = advance(0, .3, 1, 60);
  assert.ok(raised > .299); close(raised, advance(0, .3, 1, 30));
  const released = advance(raised, 0, 2, 60);
  assert.ok(released < .001); close(released, advance(raised, 0, 2, 30));
  assert.equal(smoothCameraLift(.2, .3, NaN), .2);
});
