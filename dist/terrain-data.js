/** Rendering and walking share the immutable geographic plan. */
import { WORLD, HILL, DECK, HILL_TRAIL, RIVER, BRIDGES, COAST, MOUNTAINS, riverX, riverWidth } from './geography.js';
export { HILL, DECK, HILL_TRAIL, RIVER, BRIDGES, COAST, MOUNTAINS, riverX, riverWidth } from './geography.js';

const smoothstep = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
export function hillHeight(x, z) {
  const radius = Math.hypot(x - HILL.x, z - HILL.z);
  if (radius >= HILL.radius) return 0;
  if (radius <= HILL.plateau) return HILL.height;
  return HILL.height * (1 - smoothstep((radius - HILL.plateau) / (HILL.radius - HILL.plateau)));
}
export function bridgeHeight(bridge, x) {
  const distanceToEnd = bridge.span / 2 - Math.abs(x - bridge.x);
  return bridge.height * smoothstep(distanceToEnd / 6);
}
export function groundHeight(x, z) {
  let height = hillHeight(x, z);
  if (Math.abs(x - DECK.x) <= DECK.width / 2 && Math.abs(z - DECK.z) <= DECK.depth / 2) height = DECK.height;
  for (const bridge of BRIDGES) {
    if (Math.abs(z - bridge.z) <= bridge.width / 2 && Math.abs(x - bridge.x) < bridge.span / 2) height = Math.max(height, bridgeHeight(bridge, x));
  }
  return height;
}

export const HILL_LANDMARK = Object.freeze({ id: 'hill', name: 'Hill trail', description: 'Follow the winding path up to the seaside lookout.', x: HILL.x, z: HILL.z - 7, radius: 37, arrival: Object.freeze({ x: HILL_TRAIL[0][0], z: HILL_TRAIL[0][1] }) });
export const LOOKOUT_LANDMARK = Object.freeze({ id: 'lookout', name: 'Scenic deck', description: 'Look south over the sandy beach and the open sea.', x: DECK.x, z: DECK.z, radius: 8, arrival: Object.freeze({ x: DECK.x, z: DECK.z - 1 }) });
export const BRIDGE_LANDMARKS = Object.freeze(BRIDGES.map((bridge, index) => Object.freeze({
  id: index === 1 ? 'river' : bridge.id, name: bridge.name,
  description: ['Cross the river below the mountain gorge.', 'Watch the river flow through town from the market crossing.', 'Take the southern crossing on your way to the coast.'][index],
  x: bridge.x, z: bridge.z, radius: 34,
  arrival: Object.freeze({ x: bridge.x - bridge.span / 2 - 7, z: bridge.z }),
})));
export const RIVER_LANDMARK = BRIDGE_LANDMARKS[1];
export const BEACH_LANDMARK = Object.freeze({ id: 'beach', name: 'Seaside beach', description: 'Walk along the sand and watch the rolling waves.', x: 160, z: 385, radius: 36, arrival: Object.freeze({ x: 160, z: 385 }) });
export const MOUNTAIN_LANDMARK = Object.freeze({ id: 'mountains', name: 'Mountain view', description: 'Look up at the rugged peaks and the river gorge.', x: 130, z: 79, radius: 34, arrival: Object.freeze({ x: 130, z: 79 }) });
export const HILL_TREES = Object.freeze([.12, .75, 1.24, 1.98, 2.65, 3.35, 4.55, 5.5].map((angle, index) => Object.freeze({ x: HILL.x + Math.cos(angle) * (25 + index % 3), z: HILL.z + Math.sin(angle) * (25 + index % 3), height: 4.5 + index % 3 * .6, radius: 1.8 })));
export const BEACH_UMBRELLAS = Object.freeze([[54, 384], [104, 386], [189, 384], [294, 385], [350, 384], [405, 386]].map(([x, z], index) => Object.freeze({ x, z, index, radius: 2.9 })));

const water = [];
for (let z = Math.floor(RIVER.startZ); z < RIVER.endZ; z++) {
  if (BRIDGES.some(bridge => z >= bridge.z - bridge.width / 2 && z < bridge.z + bridge.width / 2)) continue;
  // End-point envelopes cover the flowing, widening channel without tiny gaps.
  const left = Math.min(riverX(z) - riverWidth(z) / 2, riverX(z + 1) - riverWidth(z + 1) / 2);
  const right = Math.max(riverX(z) + riverWidth(z) / 2, riverX(z + 1) + riverWidth(z + 1) / 2);
  water.push({ id: `river-${z}`, kind: 'water', x: left, z, w: right - left, d: 1 });
}
const west = DECK.x - DECK.width / 2, east = DECK.x + DECK.width / 2;
const north = DECK.z - DECK.depth / 2, south = DECK.z + DECK.depth / 2;
export const TERRAIN_OBSTACLES = Object.freeze([
  ...water,
  { id: 'mountain-range', kind: 'mountain', x: -100, z: RIVER.startZ - 40, w: WORLD.width + 200, d: MOUNTAINS.maxZ - RIVER.startZ + 40 },
  { id: 'open-sea', kind: 'sea', x: -500, z: COAST.seaStart, w: WORLD.width + 1000, d: COAST.seaEnd - COAST.seaStart + 100 },
  { id: 'deck-west', kind: 'rail', x: west - .1, z: north - .1, w: .2, d: DECK.depth + .2 },
  { id: 'deck-east', kind: 'rail', x: east - .1, z: north - .1, w: .2, d: DECK.depth + .2 },
  { id: 'deck-south', kind: 'rail', x: west - .1, z: south - .1, w: DECK.width + .2, d: .2 },
  { id: 'deck-north-west', kind: 'rail', x: west - .1, z: north - .1, w: DECK.width / 2 - 3.4, d: .2 },
  { id: 'deck-north-east', kind: 'rail', x: DECK.x + 3.4, z: north - .1, w: DECK.width / 2 - 3.3, d: .2 },
  { id: 'deck-telescope', kind: 'furniture', x: DECK.x + 4.8, z: DECK.z + 3.9, radius: .7 },
  ...BRIDGES.flatMap(bridge => [-1, 1].map(side => ({ id: `${bridge.id}-${side < 0 ? 'north' : 'south'}-rail`, kind: 'rail', x: bridge.x - (bridge.span - 14) / 2 - .1, z: bridge.z + side * (bridge.width / 2 + .2) - .1, w: bridge.span - 14 + .2, d: .2 }))),
  ...HILL_TREES.map((tree, index) => ({ ...tree, id: `hill-tree-${index}`, kind: 'tree' })),
  ...BEACH_UMBRELLAS.map(umbrella => ({ ...umbrella, id: `beach-umbrella-${umbrella.index}`, kind: 'umbrella' })),
].map(obstacle => Object.freeze(obstacle)));
