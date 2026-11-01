import test from 'node:test';
import assert from 'node:assert/strict';
import { WATER_PLAY } from '../dist/geography.js';
import { groundHeight, UNDERWATER_LANDMARK } from '../dist/terrain-data.js';
import { CHARACTERS } from '../dist/character-data.js';
import { getCharacterArrangements } from '../dist/arrangements.js';
import { isInSea, waterDepthAt, immersionFor, cameraWaterBlend } from '../dist/water-view.js';

test('water depth follows the sloping floor and excludes dry land and the river', () => {
  const x = 125;
  for (let z = WATER_PLAY.shoreZ; z <= WATER_PLAY.deepZ; z += .5) {
    assert.equal(isInSea({ x, z }), true);
    assert.equal(waterDepthAt({ x, z }), WATER_PLAY.waterY - groundHeight(x, z));
  }
  for (const point of [{ x, z: 385 }, { x: 240, z: 500 }, { x, z: 700 }, { x: NaN, z: 500 }]) {
    assert.equal(waterDepthAt(point), 0);
    assert.equal(immersionFor(point).wet, false);
  }
});

test('all original friends and rectangles shorter than fifteen blocks can fully submerge', () => {
  const deep = UNDERWATER_LANDMARK.arrival;
  for (const character of CHARACTERS) {
    for (const shape of getCharacterArrangements(character.number)) {
      if (shape.height >= 15) continue;
      // Two extra units cover feet, number labels, and the tallest accessories.
      const state = immersionFor({ ...deep, height: shape.height, jump: 0 }, shape.height + 2);
      assert.equal(state.submerged, true, `${character.number}: ${shape.width} × ${shape.height}`);
    }
  }
  assert.equal(immersionFor({ ...deep, height: 30 }, 31.25).submerged, false);
  assert.equal(immersionFor({ ...deep, height: 14, jump: 4 }, 16).submerged, false);
});

test('wet feet and complete immersion remain distinct as the character enters the water', () => {
  const point = { x: 160, z: WATER_PLAY.shoreZ + 25, height: 5 };
  assert.equal(immersionFor(point, 6.25).wet, true);
  assert.equal(immersionFor(point, 6.25).submerged, false);
  assert.equal(immersionFor({ ...point, z: WATER_PLAY.shoreZ + 120 }, 6.25).submerged, true);
});

test('underwater camera tint follows its actual height, including orbits beyond the buoys', () => {
  const point = { x: 125, z: 535, y: WATER_PLAY.waterY };
  assert.equal(cameraWaterBlend(point), 0);
  assert.equal(cameraWaterBlend({ ...point, y: point.y - .75 }), .5);
  assert.equal(cameraWaterBlend({ ...point, y: -6 }), 1);
  assert.equal(cameraWaterBlend({ ...point, x: WATER_PLAY.xMax + 20, y: -6 }), 1);
  assert.equal(cameraWaterBlend({ ...point, z: 390, y: -6 }), 0);
  assert.equal(cameraWaterBlend({ ...point, y: NaN }), 0);
});
