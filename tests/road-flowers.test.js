import test from 'node:test';
import assert from 'node:assert/strict';
import { ROAD_FLOWER_BEDS, FLOWER_DOOR_CLEARANCES, createRoadFlowerBeds } from '../dist/road-flowers.js';
import { ROAD_SEGMENTS, BUILDINGS } from '../dist/world-data.js';
import { riverX, riverWidth } from '../dist/geography.js';
import { createTown } from '../dist/world3d.js';

const overlaps = (bed, minX, minZ, maxX, maxZ) => Math.hypot(
  Math.max(minX - bed.x, 0, bed.x - maxX), Math.max(minZ - bed.z, 0, bed.z - maxZ),
) < bed.radius;

test('flower pockets leave the complete street network and every doorstep open', () => {
  for (const bed of ROAD_FLOWER_BEDS) {
    for (const road of ROAD_SEGMENTS) {
      const horizontal = road.z1 === road.z2;
      const minX = Math.min(road.x1, road.x2) - (horizontal ? 0 : road.width / 2);
      const maxX = Math.max(road.x1, road.x2) + (horizontal ? 0 : road.width / 2);
      const minZ = Math.min(road.z1, road.z2) - (horizontal ? road.width / 2 : 0);
      const maxZ = Math.max(road.z1, road.z2) + (horizontal ? road.width / 2 : 0);
      assert.ok(!overlaps(bed, minX, minZ, maxX, maxZ), `${bed.roadId} planting crosses ${road.id}`);
    }
    for (const door of FLOWER_DOOR_CLEARANCES) assert.ok(!overlaps(bed, door.x, door.z, door.x + door.w, door.z + door.d));
    for (const b of BUILDINGS) assert.ok(!overlaps(bed, b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2));
    assert.ok(Math.abs(bed.x - riverX(bed.z)) > riverWidth(bed.z) / 2 + bed.radius, 'flowers must not float in the river');
  }
});

test('every long road has flowers, including both banks, markets, and the railway approach', () => {
  for (const road of ROAD_SEGMENTS.filter(r => Math.hypot(r.x2 - r.x1, r.z2 - r.z1) >= 20)) {
    assert.ok(ROAD_FLOWER_BEDS.some(bed => bed.roadId === road.id), `No flowers beside ${road.id}`);
  }
  for (const id of ['west-river-promenade', 'east-river-promenade', 'west-market-street-218', 'east-market-street-218', 'train-park-avenue']) {
    for (const side of [-1, 1]) assert.ok(ROAD_FLOWER_BEDS.some(bed => bed.roadId === id && bed.side === side), `${id} needs both verges planted`);
  }
});

test('road flowers use stable placement and bounded instanced geometry', () => {
  assert.deepEqual(createRoadFlowerBeds(), ROAD_FLOWER_BEDS);
  const { root } = createTown(), bloomCount = ROAD_FLOWER_BEDS.reduce((sum, bed) => sum + bed.bloomCount, 0);
  assert.equal(root.userData.roadFlowers.blooms, bloomCount);
  const meshes = root.children.filter(child => child.name.startsWith('Road flowers ·'));
  assert.equal(meshes.length, 8, 'five flower colors, leaves, centers, and beds stay in shared batches');
  assert.ok(meshes.every(mesh => mesh.isInstancedMesh && !mesh.castShadow));
  assert.equal(meshes.filter(mesh => mesh.name.endsWith('roadsideBlossom')).reduce((sum, mesh) => sum + mesh.count, 0), bloomCount);
  assert.ok(meshes.every(mesh => mesh.geometry.index ? mesh.geometry.index.count / 3 <= 40 : mesh.geometry.attributes.position.count / 3 <= 40));
});
