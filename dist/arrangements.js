import { getCharacterDefinition, getCharacterMetrics } from './character-data.js';
import { collides } from './navigation.js';

const arrangements = new Map();
const freeze = Object.freeze;
const bodyDepth = definition => definition.depth ?? Math.max(1, ...definition.cells.map(cell => (cell.z ?? 0) + 1));
const positionKey = cell => `${cell.x},${cell.y},${cell.z ?? 0}`;
const geometryKey = cells => cells.map(positionKey).sort().join(';');
const directions = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

function originalForm(original) {
  const originalShape = freeze({ width: original.width, height: original.height, depth: bodyDepth(original) });
  return freeze({ ...original, depth: originalShape.depth,
    cells: freeze(original.cells.map(cell => freeze({ ...cell }))),
    formId: 'original', transformed: false, shapeKind: 'original', label: 'Original shape', originalShape });
}
function normalize(positions) {
  const minX = Math.min(...positions.map(p => p.x)), minY = Math.min(...positions.map(p => p.y)), minZ = Math.min(...positions.map(p => p.z ?? 0));
  return positions.map(p => ({ x: p.x - minX, y: p.y - minY, z: (p.z ?? 0) - minZ }));
}
function variant(original, positions, metadata, originalShape, styles = original.cells) {
  const normalized = normalize(positions);
  return freeze({ ...original, ...metadata, transformed: true,
    width: Math.max(...normalized.map(p => p.x)) + 1,
    height: Math.max(...normalized.map(p => p.y)) + 1,
    depth: Math.max(...normalized.map(p => p.z)) + 1,
    originalShape: originalShape ?? freeze({ width: original.width, height: original.height, depth: bodyDepth(original) }),
    cells: freeze(normalized.map((point, index) => freeze({ ...styles[index], ...point }))),
  });
}
function rectangleCells(width, height) {
  return Array.from({ length: width * height }, (_, i) => ({ x: i % width, y: Math.floor(i / width), z: 0 }));
}
function rowCells(lengths, centered = false) {
  const width = Math.max(...lengths);
  return lengths.flatMap((length, y) => Array.from({ length }, (_, x) => ({ x: x + (centered ? Math.floor((width - length) / 2) : 0), y, z: 0 })));
}
function stairs(number) {
  const columns = Math.floor((Math.sqrt(8 * number + 1) - 1) / 2);
  const heights = Array.from({ length: columns }, (_, i) => i + 1);
  const remainder = number - columns * (columns + 1) / 2;
  for (let i = 0; i < remainder; i++) heights[columns - 1 - i]++;
  return heights.flatMap((height, x) => Array.from({ length: height }, (_, y) => ({ x, y, z: 0 })));
}
function pyramid(number) {
  const height = Math.floor(Math.sqrt(number));
  const lengths = Array.from({ length: height }, (_, y) => 2 * (height - y) - 1);
  for (let i = 0; i < number - height * height; i++) lengths[i % height]++;
  return rowCells(lengths, true);
}
function corner(number) {
  const width = Math.ceil(Math.sqrt(number)), baseHeight = Math.max(1, Math.floor(width / 3)), stemWidth = Math.max(1, Math.floor(width / 2));
  const base = rectangleCells(width, baseHeight);
  return [...base, ...Array.from({ length: number - base.length }, (_, i) => ({ x: i % stemWidth, y: baseHeight + Math.floor(i / stemWidth), z: 0 }))];
}
function tee(number) {
  const width = Math.min(number - 1, Math.max(3, Math.ceil(Math.sqrt(2 * number))));
  const stemWidth = Math.max(1, Math.floor(width / 3)), stemCount = number - width, stemHeight = Math.ceil(stemCount / stemWidth);
  const stem = Array.from({ length: stemCount }, (_, i) => ({ x: Math.floor((width - stemWidth) / 2) + i % stemWidth, y: stemHeight - 1 - Math.floor(i / stemWidth), z: 0 }));
  return [...stem, ...Array.from({ length: width }, (_, x) => ({ x, y: stemHeight, z: 0 }))];
}
function zigzag(number) {
  const width = Math.max(2, Math.round(Math.sqrt(number))), rows = Math.ceil(number / width), cells = [];
  for (let y = 0; y < rows; y++) {
    const length = Math.min(width, number - cells.length), offset = length < width ? Math.max(y % 2, (y - 1) % 2) : y % 2;
    for (let x = 0; x < length; x++) cells.push({ x: x + offset, y, z: 0 });
  }
  return cells;
}
function tensStyles(original) {
  const counts = new Map();
  for (const cell of original.cells) counts.set(cell.color, (counts.get(cell.color) ?? 0) + 1);
  const bodyColor = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  const body = original.cells.filter(cell => cell.color === bodyColor);
  // Every reference from Eleven to Thirty-Nine uses one ten/twenty/thirty
  // body color, even when the bright last-digit cubes begin in a stripe.
  if (body.length !== original.number - original.number % 10) return original.cells;
  return [...body, ...original.cells.filter(cell => cell.color !== bodyColor)];
}
function tensShape(number, placement, alternate = false) {
  const tens = Math.floor(number / 10), ones = number % 10, width = tens * 2, height = 5;
  const body = rectangleCells(width, height), onesWidth = Math.ceil(Math.sqrt(ones));
  // A slight offset keeps a two- or four-block cap visibly separate from the
  // factor rectangles already in the cycle, while remaining face-connected.
  let ox = placement === 'top' ? Math.floor((width - onesWidth) / 2) : width;
  let oy = placement === 'top' ? height : 0;
  if (placement === 'top' && (alternate || onesWidth === width && ones % onesWidth === 0)) ox++;
  if (placement === 'side' && alternate) oy = 1;
  const extra = Array.from({ length: ones }, (_, i) => ({ x: ox + i % onesWidth, y: oy + Math.floor(i / onesWidth), z: 0 }));
  const minX = Math.min(0, ox);
  return { positions: [...body, ...extra], decomposition: freeze({ tens, ones, placement,
    body: freeze({ x: -minX, y: 0, z: 0, width, height }),
    extra: freeze({ x: ox - minX, y: oy, z: 0, count: ones }),
  }) };
}
function hashSeed(number, seed) {
  const text = `${number}:${String(seed)}`;
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) { value ^= text.charCodeAt(i); value = Math.imul(value, 16777619); }
  return value >>> 0;
}
function randomFromSeed(seed) {
  let value = seed;
  return () => {
    value += 0x6D2B79F5;
    let mixed = value; mixed = Math.imul(mixed ^ mixed >>> 15, mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
}
function growConnected(number, random) {
  const limit = Math.max(3, Math.ceil(Math.sqrt(number) * 1.55));
  const depth = number < 7 || random() < .58 ? 1 : number < 15 || random() < .65 ? 2 : 3;
  const cells = [{ x: 0, y: 0, z: 0 }], occupied = new Set(['0,0,0']);
  let minX = 0, maxX = 0;
  while (cells.length < number) {
    const candidates = new Map();
    for (const cell of cells) for (const [dx, dy, dz] of directions) {
      const point = { x: cell.x + dx, y: cell.y + dy, z: cell.z + dz }, key = positionKey(point);
      if (occupied.has(key) || candidates.has(key) || point.y < 0 || point.y >= limit || point.z < 0 || point.z >= depth || Math.max(maxX, point.x) - Math.min(minX, point.x) >= limit) continue;
      let neighbors = 0;
      for (const [nx, ny, nz] of directions) if (occupied.has(`${point.x + nx},${point.y + ny},${point.z + nz}`)) neighbors++;
      // Multiple contacts favor sturdy clusters. The bounded footprint and a
      // distance penalty stop a sequence of lucky choices becoming a long arm.
      const distance = point.x * point.x + .7 * point.y * point.y + 1.25 * point.z * point.z;
      const weight = (neighbors * neighbors + .55) / (1 + distance / Math.sqrt(number));
      candidates.set(key, { point, weight });
    }
    const options = [...candidates.values()];
    let choice = random() * options.reduce((sum, option) => sum + option.weight, 0), selected = options.at(-1).point;
    for (const option of options) { choice -= option.weight; if (choice <= 0) { selected = option.point; break; } }
    cells.push(selected); occupied.add(positionKey(selected)); minX = Math.min(minX, selected.x); maxX = Math.max(maxX, selected.x);
  }
  return normalize(cells);
}

/** A deterministic compact polycube, with no new or missing character blocks. */
export function createCrazyArrangement(number, seed = 0) {
  const original = getCharacterDefinition(number), count = original.number;
  if (count < 2) return getCharacterArrangements(count)[0];
  const seedValue = hashSeed(count, seed), random = randomFromSeed(seedValue);
  if (count === 2) return variant(original, random() < .5 ? rectangleCells(1, 2) : rectangleCells(2, 1), {
    formId: `crazy:${seedValue.toString(36)}`, shapeKind: 'rectangle', label: 'Random domino', crazySeed: String(seed),
  });
  let positions;
  for (let attempt = 0; attempt < 16; attempt++) {
    positions = growConnected(count, random);
    const volume = ['x', 'y', 'z'].reduce((value, axis) => value * (Math.max(...positions.map(cell => cell[axis])) + 1), 1);
    if (volume !== count) break;
    positions = null;
  }
  positions ??= stairs(count);
  return variant(original, positions, { formId: `crazy:${seedValue.toString(36)}`, shapeKind: 'crazy', label: 'Crazy shape', crazySeed: String(seed) });
}

/** Exact original, all factor rectangles, recognizable shapes, then a crazy sample. */
export function getCharacterArrangements(number) {
  const original = getCharacterDefinition(number);
  if (arrangements.has(original.number)) return arrangements.get(original.number);
  const first = originalForm(original), forms = [first], seen = new Set([geometryKey(first.cells)]);
  function add(form) {
    const key = geometryKey(form.cells);
    if (seen.has(key)) return false;
    seen.add(key); forms.push(form); return true;
  }
  function addShape(formId, shapeKind, label, positions, metadata = {}, styles) {
    return add(variant(original, positions, { formId, shapeKind, label, ...metadata }, first.originalShape, styles));
  }
  const factors = [];
  for (let width = 1; width <= original.number; width++) if (original.number % width === 0) factors.push({ width, height: original.number / width });
  factors.sort((a, b) => Math.abs(a.width - a.height) - Math.abs(b.width - b.height) || a.width - b.width);
  for (const { width, height } of factors) addShape(`${width}x${height}`, 'rectangle', `${width} by ${height}`, rectangleCells(width, height));
  if (original.number >= 3) {
    const count = original.number;
    if (count >= 11 && count % 10) for (const placement of ['top', 'side']) {
      for (const alternate of [false, true]) {
        const { positions, decomposition } = tensShape(count, placement, alternate);
        if (addShape(`tens-${placement}`, `tens-${placement}`, `${count - count % 10} with ${count % 10} ${placement === 'top' ? 'on top' : 'beside'}`, positions, { decomposition }, tensStyles(original))) break;
      }
    }
    const steps = stairs(count);
    addShape('stairs-up', 'stairs', 'Stairs rising right', steps);
    addShape('stairs-down', 'stairs', 'Stairs rising left', steps.map(cell => ({ ...cell, x: -cell.x })));
    addShape('corner', 'corner', 'L-shaped corner', corner(count));
    if (count >= 4) {
      addShape('tee', 'tee', 'T-shaped tower', tee(count));
      addShape('pyramid', 'pyramid', 'Stepped pyramid', pyramid(count));
    }
    if (count >= 5) addShape('zigzag', 'zigzag', 'Zigzag stack', zigzag(count));
    // Skip coincident geometry, including an occasional small random L that is
    // already a stair. The same sampled form returns on every trip around T.
    for (let attempt = 0; attempt < 64; attempt++) if (add(createCrazyArrangement(count, `cycle-${attempt}`))) break;
  }
  const frozen = freeze(forms); arrangements.set(original.number, frozen); return frozen;
}

export function getNextArrangement(number, currentFormId = 'original') {
  const forms = getCharacterArrangements(number), index = forms.findIndex(form => form.formId === currentFormId);
  return forms[index < 0 ? 0 : (index + 1) % forms.length];
}

/** Find a short, unobstructed step before growing, without changing the player. */
export function findArrangementPosition(player, definition, { obstacles, world, maxDistance = 8, groundHeight, canPlace } = {}) {
  const metrics = getCharacterMetrics(definition), oldRadius = player.radius ?? getCharacterMetrics(player.definition ?? player.number).radius;
  if (![player.x, player.z, oldRadius, metrics.radius, maxDistance].every(Number.isFinite) || maxDistance < 0) return null;
  const original = { x: player.x, z: player.z };
  const heightAt = typeof groundHeight === 'function' ? groundHeight : null;
  const originalHeight = heightAt?.(original.x, original.z);
  if (heightAt && !Number.isFinite(originalHeight)) return null;
  function safe(point) {
    if (canPlace && !canPlace(point, metrics)) return false;
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
