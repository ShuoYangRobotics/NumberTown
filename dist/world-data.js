// Coordinates are measured in block units. Buildings and obstacles share the
// same footprints as the rendered village so a wide friend can explore it too.
export const WORLD = Object.freeze({ width: 300, depth: 250, margin: 2 });

export const BUILDINGS = [
  { id: 'library', name: 'NUMBER LIBRARY', kind: 'library', x: 48, z: 18, w: 18, d: 12, h: 6.9, wall: '#fff1d2', roof: '#758ab9', door: '#657d9c' },
  { id: 'school', name: 'LITTLE SCHOOL', kind: 'school', x: 74, z: 16, w: 16, d: 12, h: 5.8, wall: '#f9dfa6', roof: '#db806f', door: '#7c9d88' },
  { id: 'rose-cottage', name: '1', kind: 'house', x: 10, z: 15, w: 10, d: 10, h: 4.4, wall: '#ffe6d9', roof: '#dc8887', door: '#7a9ca7' },
  { id: 'mint-cottage', name: '2', kind: 'house', x: 30, z: 15, w: 9, d: 10, h: 4.1, wall: '#e5eee0', roof: '#7aa69a', door: '#d19c69' },
  { id: 'lilac-cottage', name: '3', kind: 'house', x: 89, z: 16, w: 7, d: 9, h: 4.2, wall: '#f0e6ed', roof: '#b398c7', door: '#8fa5b2' },
  { id: 'bakery', name: 'SUNSHINE BAKERY', kind: 'bakery', x: 10, z: 37, w: 11, d: 8, h: 4.7, wall: '#ffedce', roof: '#dba06f', door: '#ba8a73' },
  { id: 'cafe', name: 'HELLO CAFÉ', kind: 'cafe', x: 86, z: 37, w: 11, d: 8, h: 4.8, wall: '#e6f0e7', roof: '#779b91', door: '#859ca0' },
  { id: 'flowers', name: 'BLOOM', kind: 'shop', x: 31, z: 37, w: 8, d: 7, h: 4.1, wall: '#f7e4e2', roof: '#c58a9b', door: '#9aaf91' },
  { id: 'toys', name: 'TOY BOX', kind: 'shop', x: 65, z: 37, w: 8, d: 7, h: 4.1, wall: '#e3eaf4', roof: '#8d9ebd', door: '#c8a66f' },
  { id: 'music', name: 'MUSIC HOUSE', kind: 'shop', x: 31, z: 57, w: 8, d: 8, h: 4.3, wall: '#efe2ea', roof: '#af8ba7', door: '#8098ad' },
  { id: 'green-cottage', name: '4', kind: 'house', x: 65, z: 57, w: 8, d: 8, h: 4.2, wall: '#e7edda', roof: '#88a589', door: '#c49574' },
  { id: 'blue-cottage', name: '5', kind: 'house', x: 86, z: 57, w: 11, d: 9, h: 4.5, wall: '#e2edf4', roof: '#819fb9', door: '#c4a475' },
  { id: 'cream-cottage', name: '6', kind: 'house', facing: 'north', x: 10, z: 76, w: 10, d: 8, h: 4.2, wall: '#faf0d8', roof: '#bf9472', door: '#86a0a2', approach: { x: 22, z: 70 } },
  { id: 'apricot-cottage', name: '7', kind: 'house', facing: 'north', x: 34, z: 76, w: 12, d: 8, h: 4.4, wall: '#f8e3cd', roof: '#d49982', door: '#8dafa4' },
  { id: 'town-hall', name: 'TOWN HALL', kind: 'hall', facing: 'north', x: 57, z: 76, w: 12, d: 8, h: 5.5, wall: '#f5e9cd', roof: '#94a8a4', door: '#7e9c98' },
  { id: 'pet-shop', name: 'LITTLE PAWS', kind: 'shop', facing: 'north', x: 86, z: 76, w: 11, d: 8, h: 4.4, wall: '#f1e5d8', roof: '#b496af', door: '#8caaa3' },
];

// Keep the original village intact, then fill two compact neighborhoods using
// shared palettes. The reserved activity areas east/south remain entirely open.
const HOUSE_PALETTES = [
  ['#ffe6d9', '#dc8887', '#7a9ca7'], ['#e5eee0', '#7aa69a', '#d19c69'],
  ['#f0e6ed', '#b398c7', '#8fa5b2'], ['#e7edda', '#88a589', '#c49574'],
  ['#e2edf4', '#819fb9', '#c4a475'], ['#faf0d8', '#bf9472', '#86a0a2'],
  ['#f8e3cd', '#d49982', '#8dafa4'],
];
const RETAIL = [
  { id: 'rainbow-market', name: 'RAINBOW MARKET', wall: '#ffedce', roof: '#dba06f', door: '#ba8a73' },
  { id: 'ice-cream', name: 'SCOOPS & SMILES', wall: '#f7e4e2', roof: '#c58a9b', door: '#9aaf91' },
  { id: 'craft-shop', name: 'CRAFT CORNER', wall: '#e3eaf4', roof: '#8d9ebd', door: '#c8a66f' },
  { id: 'puzzle-shop', name: 'PUZZLE POST', wall: '#e6f0e7', roof: '#779b91', door: '#859ca0' },
];
const newBuildings = [];
let houseNumber = 8;
function addHouse(x, z, street, neighborhood) {
  const number = houseNumber++;
  const [wall, roof, door] = HOUSE_PALETTES[(number - 1) % HOUSE_PALETTES.length];
  newBuildings.push({
    id: `house-${number}`, name: String(number), kind: 'house', neighborhood,
    x, z, w: 8.8 + (number % 3) * .4, d: 8.4 + (number % 2) * .4,
    h: 4.1 + (number % 4) * .16, wall, roof, door, street,
  });
}
for (const z of [96, 116, 136, 156]) {
  for (const x of [10, 34, 58, 82]) addHouse(x, z, z + 10, 'Sunny Lanes');
}
for (const z of [16, 40, 64, 88, 112, 136]) {
  for (const [column, x] of [108, 128, 148, 168, 188].entries()) {
    if (z === 88 && column > 0) {
      newBuildings.push({ ...RETAIL[column - 1], kind: 'shop', neighborhood: 'Market Street', x, z, w: 9.4, d: 9, h: 4.7, street: 101 });
    } else addHouse(x, z, z + 13, 'Rainbow Neighborhood');
  }
}
addHouse(188, 160, 173, 'Rainbow Neighborhood');
BUILDINGS.push(...newBuildings);

// Center-line segments are also useful for the map and route checks. All major
// streets are 10–12 units wide; the external connectors end at activity entries.
export const ROAD_SEGMENTS = [
  ...[29, 47, 66].map(z => ({ id: `old-east-west-${z}`, x1: 3.5, z1: z, x2: 98, z2: z, width: z === 47 ? 12 : 10 })),
  { id: 'old-west-avenue', x1: 22, z1: 6.5, x2: 22, z2: 174, width: 10 },
  { id: 'old-east-avenue', x1: 74, z1: 22.5, x2: 74, z2: 86, width: 10 },
  { id: 'old-center-avenue', x1: 48, z1: 23.5, x2: 48, z2: 72.5, width: 12 },
  ...[46, 70].map(x => ({ id: `sunny-avenue-${x}`, x1: x, z1: 86, x2: x, z2: 174, width: 10 })),
  ...[86, 106, 126, 146, 166].map(z => ({ id: `sunny-street-${z}`, x1: 4, z1: z, x2: 98, z2: z, width: 10 })),
  ...[98, 118, 138, 158, 178, 198].map(x => ({ id: `rainbow-avenue-${x}`, x1: x, z1: 5, x2: x, z2: 178, width: x === 98 || x === 158 ? 12 : 10 })),
  ...[29, 53, 77, 101, 125, 149, 173].map(z => ({ id: `rainbow-street-${z}`, x1: 98, z1: z, x2: z === 77 ? 214 : z === 149 ? 210 : 204, z2: z, width: z === 101 ? 12 : 10 })),
  { id: 'park-approach-turn', x1: 214, z1: 77, x2: 214, z2: 80, width: 10 },
  { id: 'park-entry', x1: 214, z1: 80, x2: 220, z2: 80, width: 10 },
  { id: 'hill-entry', x1: 100, z1: 166, x2: 100, z2: 178, width: 10 },
  { id: 'river-approach', x1: 146, z1: 173, x2: 146, z2: 190, width: 10 },
  { id: 'bridge-entry', x1: 146, z1: 190, x2: 170, z2: 190, width: 10 },
];

export const BUILDING_APPROACHES = BUILDINGS.map(b => ({
  id: b.id, name: b.kind === 'house' ? `House ${b.name}` : b.name,
  ...(b.approach ?? { x: b.x, z: b.street ?? (b.facing === 'north' ? 66 : b.z < 25 ? 29 : b.z < 45 ? 47 : 66) }),
}));

export const EXPANSION_CONNECTIONS = [
  { id: 'park', x: 220, z: 80 }, { id: 'football', x: 210, z: 149 },
  { id: 'hill', x: 100, z: 178 }, { id: 'river-bridge', x: 170, z: 190 },
];

export const TREES = [
  [4, 5, 5.2], [18, 5, 4.7], [38, 5, 5.7], [60, 5, 5.1], [84, 5, 4.9], [92, 5, 5.5],
  [17, 16, 4.8], [61, 15, 5.3], [4, 24, 4.7], [90, 7, 5.4], [3, 37, 4.8],
  [38, 35, 5.2], [58, 35, 4.9], [3, 50, 5.7], [17, 53, 4.8], [42, 8, 5.3],
  [39, 60, 4.9], [57, 60, 5.1], [3, 66, 5.3], [54, 8, 5.5], [18, 77, 4.9],
  [43, 79, 5.2], [68, 79, 5.3], [93, 80, 5.0], [4, 81, 4.8],
].map(([x, z, h], i) => ({ id: `tree-${i}`, x, z, h, radius: 2.1, tint: i % 3 }));
newBuildings.forEach((b, i) => {
  if (i % 2 || b.z >= 160) return;
  const compact = b.neighborhood === 'Sunny Lanes';
  TREES.push({
    id: `neighborhood-tree-${i}`, x: b.x + 3.4, z: b.z + (compact ? 5.6 : 8),
    h: compact ? 4.3 : 5.2 + (i % 3) * .25,
    radius: compact ? 1.5 : 2.1, crownScale: compact ? .7 : 1, tint: i % 3,
  });
});

export const BENCHES = [
  { x: 37.8, z: 54, rotation: Math.PI / 2 },
  { x: 58.5, z: 54, rotation: -Math.PI / 2 },
  { x: 18, z: 54, rotation: Math.PI / 2 },
  { x: 17, z: 71, rotation: 0 },
  { x: 82, z: 68.8, rotation: 0 },
];

export const LAMPS = [
  [18, 43], [26, 43], [70, 43], [78, 43], [38, 33], [58, 33], [44, 63], [52, 63],
  [114, 49], [154, 49], [194, 49], [114, 97], [154, 97], [194, 97],
  [114, 145], [154, 145], [194, 145], [42, 102], [66, 122], [42, 142],
].map(([x, z]) => ({ x, z }));

export const POND = Object.freeze({ x: 10.5, z: 61.5, rx: 5.5, rz: 4.3, radius: 6.2 });
export const FOUNTAIN = Object.freeze({ x: 56, z: 45, radius: 2.45 });

export const OBSTACLES = [
  ...BUILDINGS.map(({ id, kind, facing, x, z, w, d }) => {
    // Include eaves and shop awnings: tall friends should not clip through them.
    const awning = ['bakery', 'cafe', 'shop'].includes(kind) ? .8 : 0;
    return {
      id, kind: 'building', x: x - w / 2 - .55,
      z: z - d / 2 - .55 - (facing === 'north' ? awning : 0),
      w: w + 1.1, d: d + 1.1 + awning,
    };
  }),
  ...TREES.map(({ id, x, z, radius }) => ({ id, kind: 'tree', x, z, radius })),
  ...BENCHES.map(({ x, z, rotation }, i) => {
    const sideways = Math.abs(Math.sin(rotation)) > 0.5;
    const w = sideways ? 1 : 2.8;
    const d = sideways ? 2.8 : 1;
    return { id: `bench-${i}`, kind: 'bench', x: x - w / 2, z: z - d / 2, w, d };
  }),
  ...LAMPS.map(({ x, z }, i) => ({ id: `lamp-${i}`, kind: 'lamp', x, z, radius: 0.25 })),
  { id: 'bunting-left', kind: 'pole', x: 37.5, z: 35, radius: .12 },
  { id: 'bunting-right', kind: 'pole', x: 59.3, z: 35, radius: .12 },
  { id: 'pond', kind: 'water', x: POND.x, z: POND.z, radius: POND.radius },
  { id: 'fountain', kind: 'fountain', ...FOUNTAIN },
];

export const LANDMARKS = [
  { id: 'town-square', name: 'Town square', description: 'Meet your friends by the little fountain.', x: 48, z: 47, radius: 12, arrival: { x: 48, z: 51 } },
  { id: 'library', name: 'Library', description: 'A whole world of stories is waiting here.', x: 48, z: 26, radius: 8, arrival: { x: 48, z: 30 } },
  { id: 'garden', name: 'Gardens', description: 'Flowers, shady trees, and a peaceful place to play.', x: 22, z: 66, radius: 8, arrival: { x: 22, z: 66 } },
  { id: 'pond', name: 'Duck pond', description: 'Say hello to the ducks in their blue pond.', x: 17, z: 61, radius: 7, arrival: { x: 22, z: 60 } },
  { id: 'school', name: 'Little school', description: 'Learn something new with your friends.', x: 74, z: 25, radius: 8, arrival: { x: 74, z: 29 } },
  { id: 'bakery', name: 'Bakery', description: 'Something sweet is baking in the neighborhood.', x: 10, z: 43, radius: 7, arrival: { x: 10, z: 47 } },
  { id: 'cafe', name: 'Café', description: 'Stop by for a friendly hello.', x: 86, z: 43, radius: 7, arrival: { x: 86, z: 47 } },
  { id: 'neighborhoods', name: 'Rainbow neighborhood', description: 'Follow the colorful rooftops and meet the neighbors.', x: 138, z: 53, radius: 18, arrival: { x: 138, z: 53 } },
  { id: 'sunny-lanes', name: 'Sunny Lanes', description: 'Little homes and leafy lanes, with plenty of room to explore.', x: 46, z: 126, radius: 18, arrival: { x: 46, z: 126 } },
  { id: 'market', name: 'Market Street', description: 'Browse rainbow groceries, ice cream, crafts, and puzzles.', x: 158, z: 101, radius: 20, arrival: { x: 158, z: 101 } },
];

export const FRIEND_STARTS = [
  [56, 29], [42, 47], [48, 40], [42, 40], [48, 54], [42, 54], [54, 54], [53, 36],
  [48, 33], [40, 29], [48, 47], [22, 47], [74, 47], [22, 66], [74, 66],
].map(([x, z]) => ({ x, z }));
