import { getCharacterDefinition, getCharacterMetrics } from './character-data.js';
import { collides } from './navigation.js';

const arrangements = new Map();
const bodyDepth = definition => definition.depth ?? Math.max(...definition.cells.map(cell => (cell.z ?? 0) + 1));

function isRectangle(definition) {
  if (bodyDepth(definition) !== 1 || definition.width * definition.height !== definition.number) return false;
  const cells = new Set();
  for (const cell of definition.cells) {
    if ((cell.z ?? 0) !== 0 || cell.x < 0 || cell.y < 0 || cell.x >= definition.width || cell.y >= definition.height) return false;
    cells.add(`${cell.x},${cell.y}`);
  }
  return cells.size === definition.number;
}

/** Original identity and exact cell styles, followed by every unique factor rectangle. */
export function getCharacterArrangements(number) {
  const original = getCharacterDefinition(number);
  if (arrangements.has(original.number)) return arrangements.get(original.number);
  const originalShape = Object.freeze({ width: original.width, height: original.height, depth: bodyDepth(original) });
  const first = Object.freeze({ ...original, depth: originalShape.depth,
    cells: Object.freeze(original.cells.map(cell => Object.freeze({ ...cell }))),
    formId: 'original', transformed: false, label: 'Original shape', originalShape });
  const factors = [];
  for (let width = 1; width <= original.number; width++) {
    if (original.number % width) continue;
    const height = original.number / width;
    if (isRectangle(first) && width === first.width && height === first.height) continue;
    factors.push({ width, height });
  }
  factors.sort((a, b) => Math.abs(a.width - a.height) - Math.abs(b.width - b.height) || a.width - b.width);
  const forms = [first, ...factors.map(({ width, height }) => Object.freeze({
    ...original, width, height, depth: 1, originalShape,
    formId: `${width}x${height}`, transformed: true, label: `${width} by ${height}`,
    cells: Object.freeze(original.cells.map((cell, index) => Object.freeze({
      ...cell, x: index % width, y: Math.floor(index / width), z: 0,
    }))),
  }))];
  const frozen = Object.freeze(forms); arrangements.set(original.number, frozen); return frozen;
}

export function getNextArrangement(number, currentFormId = 'original') {
  const forms = getCharacterArrangements(number), index = forms.findIndex(form => form.formId === currentFormId);
  return forms[index < 0 ? 0 : (index + 1) % forms.length];
}

/** Find a short, unobstructed step before growing, without changing the player. */
export function findArrangementPosition(player, definition, { obstacles, world, maxDistance = 8, groundHeight } = {}) {
  const metrics = getCharacterMetrics(definition), oldRadius = player.radius ?? getCharacterMetrics(player.definition ?? player.number).radius;
  if (![player.x, player.z, oldRadius, metrics.radius, maxDistance].every(Number.isFinite) || maxDistance < 0) return null;
  const original = { x: player.x, z: player.z };
  const heightAt = typeof groundHeight === 'function' ? groundHeight : null;
  const originalHeight = heightAt?.(original.x, original.z);
  if (heightAt && !Number.isFinite(originalHeight)) return null;
  function safe(point) {
    if (collides(point.x, point.z, obstacles, world, metrics.radius)) return false;
    // Move in the old body, then transform at the clear endpoint. Requiring
    // the enlarged body at the start would reject a safe step away from a wall.
    const distance = Math.hypot(point.x - original.x, point.z - original.z);
    const steps = Math.max(1, Math.ceil(distance / .15));
    let previousHeight = originalHeight;
    for (let step = 0; step <= steps; step++) {
      const t = step / steps, x = original.x + (point.x - original.x) * t, z = original.z + (point.z - original.z) * t;
      if (collides(x, z, obstacles, world, oldRadius)) return false;
      if (heightAt) {
        const height = heightAt(x, z);
        if (!Number.isFinite(height) || Math.abs(height - previousHeight) > distance / steps * 1.25 + .12) return false;
        previousHeight = height;
      }
    }
    return true;
  }
  const result = point => ({ position: point, metrics: { ...metrics } });
  if (safe(original)) return result(original);
  // Increasing quarter-unit rings keep any relocation local and near the
  // current position; a straight corridor may never cross a wall or river.
  for (let ring = 1; ring <= Math.ceil(maxDistance / .25); ring++) {
    const distance = Math.min(maxDistance, ring * .25), samples = Math.max(16, Math.ceil(2 * Math.PI * distance / .4));
    for (let i = 0; i < samples; i++) {
      const angle = 2 * Math.PI * i / samples;
      const point = { x: original.x + Math.cos(angle) * distance, z: original.z + Math.sin(angle) * distance };
      if (safe(point)) return result(point);
    }
  }
  return null;
}
