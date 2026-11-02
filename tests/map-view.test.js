import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_MAX_ZOOM, fitMapView, clampMapView, zoomMapView, centerMapView, resizeMapView } from '../dist/map-view.js';

const bounds = { minX: -320, maxX: 1040, minZ: -90, maxZ: 690 };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);
function containsWorld(view) {
  assert.ok(view.x <= bounds.minX && view.y <= bounds.minZ);
  assert.ok(view.x + view.width >= bounds.maxX && view.y + view.height >= bounds.maxZ);
}

test('fit shows the complete town in a wide screen and a tall phone', () => {
  for (const [width, height] of [[1100, 620], [330, 560], [900, 250]]) {
    const view = fitMapView(bounds, width, height);
    containsWorld(view);
    near(view.width / view.height, width / height);
  }
});

test('zoom keeps the same point under the cursor and respects useful limits', () => {
  const fit = fitMapView(bounds, 1000, 600), anchor = { x: .7, y: .4 };
  const view = zoomMapView(fit, fit, 2, anchor);
  near(fit.x + fit.width * anchor.x, view.x + view.width * anchor.x);
  near(fit.y + fit.height * anchor.y, view.y + view.height * anchor.y);
  near(zoomMapView(view, fit, 1000).width, fit.width / MAP_MAX_ZOOM);
  const full = zoomMapView(view, fit, .0001);
  for (const key of Object.keys(fit)) near(full[key], fit[key]);
});

test('panning cannot lose the town outside the map viewport', () => {
  const fit = fitMapView(bounds, 1000, 600), zoomed = zoomMapView(fit, fit, 3);
  const upperLeft = clampMapView({ ...zoomed, x: -1e9, y: -1e9 }, fit);
  near(upperLeft.x, fit.x); near(upperLeft.y, fit.y);
  const lowerRight = clampMapView({ ...zoomed, x: 1e9, y: 1e9 }, fit);
  near(lowerRight.x + lowerRight.width, fit.x + fit.width);
  near(lowerRight.y + lowerRight.height, fit.y + fit.height);
});

test('follow centers a character and keeps edge locations visible', () => {
  const fit = fitMapView(bounds, 1000, 600), zoomed = zoomMapView(fit, fit, 4);
  const player = { x: 100, z: 150 }, centered = centerMapView(zoomed, fit, player);
  near(centered.x + centered.width / 2, player.x);
  near(centered.y + centered.height / 2, player.z);
  const edge = centerMapView(zoomed, fit, { x: bounds.maxX, z: bounds.maxZ });
  assert.ok(edge.x <= bounds.maxX && edge.x + edge.width >= bounds.maxX);
  assert.ok(edge.y <= bounds.maxZ && edge.y + edge.height >= bounds.maxZ);
});

test('resizing preserves zoom and the viewed location instead of returning to full map', () => {
  const oldFit = fitMapView(bounds, 1000, 600), newFit = fitMapView(bounds, 850, 700);
  const view = centerMapView(zoomMapView(oldFit, oldFit, 4), oldFit, { x: 300, z: 200 });
  const resized = resizeMapView(view, oldFit, newFit);
  near(oldFit.width / view.width, newFit.width / resized.width);
  near(view.x + view.width / 2, resized.x + resized.width / 2);
  near(view.y + view.height / 2, resized.y + resized.height / 2);
  containsWorld(resizeMapView(oldFit, oldFit, newFit));
});

test('small-screen labels prefer major places and reveal details when there is room', async () => {
  const { visibleMapLabels } = await import('../dist/map-view.js');
  const garden = { id: 'garden', priority: 3, left: 100, right: 220, top: 100, bottom: 110 };
  const depth = { id: 'depth', priority: -1, left: 110, right: 210, top: 107, bottom: 117 };
  const bank = { id: 'bank', priority: 3, left: 105, right: 170, top: 70, bottom: 81 };
  assert.deepEqual([...visibleMapLabels([depth, garden, bank])], ['garden', 'bank']);
  assert.deepEqual([...visibleMapLabels([garden, { ...depth, top: 116, bottom: 126 }, bank])], ['garden', 'bank', 'depth']);
});
