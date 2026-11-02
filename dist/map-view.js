/** Map camera math is independent from the game camera and never changes the world. */
export const MAP_MAX_ZOOM = 10;

export function fitMapView(bounds, width, height) {
  const aspect = Math.max(1, width) / Math.max(1, height);
  let viewWidth = (bounds.maxX - bounds.minX) * 1.04;
  let viewHeight = (bounds.maxZ - bounds.minZ) * 1.04;
  if (viewWidth / viewHeight < aspect) viewWidth = viewHeight * aspect;
  else viewHeight = viewWidth / aspect;
  return {
    x: (bounds.minX + bounds.maxX - viewWidth) / 2,
    y: (bounds.minZ + bounds.maxZ - viewHeight) / 2,
    width: viewWidth,
    height: viewHeight,
  };
}

export function clampMapView(view, fitted) {
  const width = Math.max(fitted.width / MAP_MAX_ZOOM, Math.min(fitted.width, view.width));
  const height = width * fitted.height / fitted.width;
  return {
    x: Math.max(fitted.x, Math.min(fitted.x + fitted.width - width, view.x)),
    y: Math.max(fitted.y, Math.min(fitted.y + fitted.height - height, view.y)),
    width,
    height,
  };
}

/** Keep the place under the pointer still when zooming, except at a map edge. */
export function zoomMapView(view, fitted, factor, anchor = { x: .5, y: .5 }) {
  const width = Math.max(fitted.width / MAP_MAX_ZOOM, Math.min(fitted.width, view.width / factor));
  const height = width * fitted.height / fitted.width;
  return clampMapView({
    x: view.x + anchor.x * (view.width - width),
    y: view.y + anchor.y * (view.height - height),
    width,
    height,
  }, fitted);
}

export function centerMapView(view, fitted, point) {
  return clampMapView({ ...view, x: point.x - view.width / 2, y: point.z - view.height / 2 }, fitted);
}

/** Retain the user's location and zoom when the map panel changes size. */
export function resizeMapView(view, oldFitted, fitted) {
  const zoom = oldFitted.width / view.width;
  const width = fitted.width / zoom;
  const height = fitted.height / zoom;
  return clampMapView({
    x: view.x + view.width / 2 - width / 2,
    y: view.y + view.height / 2 - height / 2,
    width,
    height,
  }, fitted);
}

/** Keep overview labels readable; detail labels return naturally as the user zooms in. */
export function visibleMapLabels(labels, gap = 4) {
  const kept = [];
  for (const label of [...labels].sort((a, b) => (b.priority || 0) - (a.priority || 0))) {
    const overlaps = kept.some(other => label.left < other.right + gap && label.right + gap > other.left &&
      label.top < other.bottom + gap && label.bottom + gap > other.top);
    if (!overlaps) kept.push(label);
  }
  return new Set(kept.map(label => label.id));
}
