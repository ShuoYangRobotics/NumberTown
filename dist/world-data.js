import { WORLD, BRIDGES } from './geography.js';
export { WORLD } from './geography.js';

export const SQUARE = Object.freeze({ x: 90, z: 125, w: 64, d: 56, width: 64, depth: 56 });
export const STATUE = Object.freeze({ x: 90, z: 125, pedestalWidth: 16, pedestalDepth: 16, baseHeight: 1.5, cubieSize: 3, gap: .12 });
export const POND = Object.freeze({ x: 44, z: 269, rx: 17, rz: 12, radius: 17.7 });
export const FOUNTAIN = Object.freeze({ x: 112, z: 142, radius: 2.45 });
export const BUNTING = Object.freeze({ x1: 74, x2: 106, z: 97, height: 10 });
const HOUSE_PALETTES = [
  ['#ffe6d9', '#dc8887', '#7a9ca7'], ['#e5eee0', '#7aa69a', '#d19c69'],
  ['#f0e6ed', '#b398c7', '#8fa5b2'], ['#e7edda', '#88a589', '#c49574'],
  ['#e2edf4', '#819fb9', '#c4a475'], ['#faf0d8', '#bf9472', '#86a0a2'],
  ['#f8e3cd', '#d49982', '#8dafa4'],
];
const SPECIAL_BUILDINGS = new Map([
  ['94,86', { id: 'library', name: 'NUMBER LIBRARY', kind: 'library', x: 90, w: 18, d: 12, h: 6.9, wall: '#fff1d2', roof: '#758ab9', door: '#657d9c', street: 102 }],
  ['166,86', { id: 'school', name: 'LITTLE SCHOOL', kind: 'school', w: 16, d: 12, h: 5.8, wall: '#f9dfa6', roof: '#db806f', door: '#7c9d88' }],
  ['142,158', { id: 'town-hall', name: 'TOWN HALL', kind: 'hall', w: 14, d: 10, h: 5.5, wall: '#f5e9cd', roof: '#94a8a4', door: '#7e9c98' }],
  ['46,110', { id: 'bakery', name: 'SUNSHINE BAKERY', kind: 'bakery', wall: '#ffedce', roof: '#dba06f', door: '#ba8a73' }],
  ['142,110', { id: 'cafe', name: 'HELLO CAFÉ', kind: 'cafe', wall: '#e6f0e7', roof: '#779b91', door: '#859ca0' }],
  ['46,134', { id: 'flowers', name: 'BLOOM', kind: 'shop', wall: '#f7e4e2', roof: '#c58a9b', door: '#9aaf91' }],
  ['142,134', { id: 'toys', name: 'TOY BOX', kind: 'shop', wall: '#e3eaf4', roof: '#8d9ebd', door: '#c8a66f' }],
  ['46,158', { id: 'music', name: 'MUSIC HOUSE', kind: 'shop', wall: '#efe2ea', roof: '#af8ba7', door: '#8098ad' }],
  ['166,158', { id: 'pet-shop', name: 'LITTLE PAWS', kind: 'shop', wall: '#f1e5d8', roof: '#b496af', door: '#8caaa3' }],
  ['118,182', { id: 'rainbow-market', name: 'RAINBOW MARKET', kind: 'shop', wall: '#ffedce', roof: '#dba06f', door: '#ba8a73' }],
  ['142,182', { id: 'ice-cream', name: 'SCOOPS & SMILES', kind: 'shop', wall: '#f7e4e2', roof: '#c58a9b', door: '#9aaf91' }],
  ['166,182', { id: 'craft-shop', name: 'CRAFT CORNER', kind: 'shop', wall: '#e3eaf4', roof: '#8d9ebd', door: '#c8a66f' }],
  ['190,182', { id: 'puzzle-shop', name: 'PUZZLE POST', kind: 'shop', wall: '#e6f0e7', roof: '#779b91', door: '#859ca0' }],
]);
export const BUILDINGS = [];
let houseNumber = 0;
function addHouse(x, z, bank) {
  const number = ++houseNumber;
  const [wall, roof, door] = HOUSE_PALETTES[(number - 1) % HOUSE_PALETTES.length];
  const house = { id: `house-${number}`, name: String(number), kind: 'house', bank,
    neighborhood: bank === 'east' ? 'Eastbank Village' : z < 200 ? 'Rainbow Neighborhood' : 'Sunny Lanes',
    x, z, w: 8.8 + (number % 3) * .4, d: 8.4 + (number % 2) * .4,
    h: 4.1 + (number % 4) * .16, wall, roof, door, street: z + 12 };
  BUILDINGS.push(house); return house;
}
for (const z of [86, 110, 134, 158, 182, 206, 230, 254, 278, 294]) {
  for (const x of [22, 46, 70, 94, 118, 142, 166, 190]) {
    // Leave an actual open plaza and a large pond garden between neighborhoods.
    if ([110, 134].includes(z) && [70, 94, 118].includes(x)) continue;
    if (z === 254 && [22, 46].includes(x)) continue;
    if (z === 278 && [22, 46, 70].includes(x)) continue;
    if (z === 294 && ![22, 46].includes(x)) continue;
    const special = SPECIAL_BUILDINGS.get(`${x},${z}`);
    if (special) BUILDINGS.push({ x, z, w: 10.4, d: 9, h: 4.7, street: z + 12, bank: 'west', neighborhood: 'Town Center', ...special });
    else {
      const house = addHouse(x, z, 'west');
      if (z === 158 && [70, 94, 118].includes(x)) { house.facing = 'north'; house.street = 146; }
    }
  }
}
for (const z of [86, 110, 134, 158, 182, 206, 230, 254, 278, 302]) {
  for (const x of [282, 306]) {
    const house = addHouse(x, z, 'east');
    if (x === 282 && z === 206) house.z = 202;
  }
}

// Center-line road segments never extend past their declared end points.
export const ROAD_SEGMENTS = [];
const road = (id, x1, z1, x2, z2, width = 12) => ROAD_SEGMENTS.push({ id, x1, z1, x2, z2, width });
for (const z of [98, 122, 146, 170, 194, 218, 242, 266, 290, 306]) {
  if ([98, 122, 146].includes(z)) {
    road(`west-street-${z}-west`, 10, z, 58, z);
    road(`west-street-${z}-east`, 122, z, 218, z);
  } else if (z === 266) {
    road('pond-street-west', 10, z, 20, z); road('pond-street-east', 70, z, 218, z);
  } else road(`west-street-${z}`, z === 290 ? 82 : 10, z, 218, z);
}
for (const x of [10, 34, 58, 82, 106, 130, 154, 178, 202]) {
  if ([34, 58].includes(x)) {
    road(`west-avenue-${x}-north`, x, 78, x, 246, 10);
    road(`west-avenue-${x}-south`, x, 292, x, 306, 10);
  } else if ([82, 106].includes(x)) {
    if (x === 106) road(`plaza-avenue-${x}-north`, x, 78, x, 97, 10);
    road(`plaza-avenue-${x}-south`, x, 153, x, 306, 10);
  } else road(`west-avenue-${x}`, x, 78, x, 306, 10);
}
road('west-river-promenade', 218, 78, 218, 365);
road('east-river-promenade', 266, 78, 266, 365);
for (const z of [98, 122, 146, 170, 194, 218, 242, 266, 290, 314]) road(`east-street-${z}`, 266, z, 316, z);
for (const x of [294, 316]) road(`east-avenue-${x}`, x, 78, x, 320, 10);
for (const bridge of BRIDGES) {
  road(`${bridge.id}-west-approach`, 218, bridge.z, bridge.x - bridge.span / 2, bridge.z, bridge.width);
  road(`${bridge.id}-east-approach`, 266, bridge.z, bridge.x + bridge.span / 2, bridge.z, bridge.width);
}
road('park-approach', 316, 147, 326, 147, 10);
road('park-approach-turn', 326, 147, 326, 150, 10);
road('park-entry', 326, 150, 332, 150, 10);
road('football-entry', 316, 219, 322, 219);
road('hill-entry', 130, 306, 130, 307, 10);
road('west-beach-turn', 218, 365, 160, 365, 10);
road('west-beach-entry', 160, 365, 160, 385, 10);
road('east-beach-turn', 266, 365, 278, 365, 10);
road('east-beach-entry', 278, 365, 278, 382, 10);

export const BUILDING_APPROACHES = BUILDINGS.map(b => ({ id: b.id, name: b.kind === 'house' ? `House ${b.name}` : b.name, x: b.x, z: b.street }));
export const EXPANSION_CONNECTIONS = [
  { id: 'park', x: 332, z: 150 }, { id: 'football', x: 322, z: 219 }, { id: 'hill', x: 130, z: 307 },
  ...BRIDGES.flatMap(bridge => [{ id: `${bridge.id}-west`, x: 218, z: bridge.z }, { id: `${bridge.id}-east`, x: 266, z: bridge.z }]),
  { id: 'beach-west', x: 160, z: 385 }, { id: 'beach-east', x: 278, z: 382 },
];

export const TREES = [
  [62, 101, 5.4], [124, 104, 5.2], [62, 149, 5.3], [124, 150, 5.1],
  [18, 250, 5.6], [18, 283, 5.2], [76, 250, 5.7], [75, 283, 5.3],
].map(([x, z, h], i) => ({ id: `garden-tree-${i}`, x, z, h, radius: 2.1, tint: i % 3 }));
BUILDINGS.forEach((b, i) => {
  if (i % 3 || b.kind !== 'house' || (b.bank === 'west' && b.z >= 294)) return;
  TREES.push({ id: `street-tree-${i}`, x: b.x + 3.4, z: b.z + 7, h: 5 + (i % 4) * .2, radius: 2.1, tint: i % 3 });
});
export const BENCHES = [
  { x: 66, z: 105, rotation: .2 }, { x: 114, z: 105, rotation: -.2 },
  { x: 66, z: 146, rotation: Math.PI / 2 }, { x: 114, z: 148, rotation: -Math.PI / 2 },
  { x: 70, z: 277, rotation: Math.PI / 2 }, { x: 21, z: 291, rotation: 0 },
];
export const LAMPS = [
  [62, 114], [118, 114], [62, 138], [118, 138], [76, 100], [104, 100],
  [150, 118], [174, 190], [150, 238], [198, 286],
  [214, 118], [214, 202], [214, 278], [270, 118], [270, 202], [270, 278],
].map(([x, z]) => ({ x, z }));

export const OBSTACLES = [
  ...BUILDINGS.map(({ id, kind, x, z, w, d }) => {
    const awning = ['bakery', 'cafe', 'shop'].includes(kind) ? .8 : 0;
    return { id, kind: 'building', x: x - w / 2 - .55, z: z - d / 2 - .55, w: w + 1.1, d: d + 1.1 + awning };
  }),
  ...TREES.map(({ id, x, z, radius }) => ({ id, kind: 'tree', x, z, radius })),
  ...BENCHES.map(({ x, z, rotation }, i) => {
    const sideways = Math.abs(Math.sin(rotation)) > .5, w = sideways ? 1 : 2.8, d = sideways ? 2.8 : 1;
    return { id: `bench-${i}`, kind: 'bench', x: x - w / 2, z: z - d / 2, w, d };
  }),
  ...LAMPS.map(({ x, z }, i) => ({ id: `lamp-${i}`, kind: 'lamp', x, z, radius: .25 })),
  { id: 'rubiks-cube-statue', kind: 'statue', x: STATUE.x - STATUE.pedestalWidth / 2, z: STATUE.z - STATUE.pedestalDepth / 2, w: STATUE.pedestalWidth, d: STATUE.pedestalDepth },
  { id: 'bunting-left', kind: 'pole', x: BUNTING.x1, z: BUNTING.z, radius: .12 },
  { id: 'bunting-right', kind: 'pole', x: BUNTING.x2, z: BUNTING.z, radius: .12 },
  { id: 'pond', kind: 'water', x: POND.x, z: POND.z, radius: POND.radius },
  { id: 'fountain', kind: 'fountain', ...FOUNTAIN },
];

export const LANDMARKS = [
  { id: 'town-square', name: 'Rubik’s Town Square', description: 'Meet beside the giant rainbow cube in the heart of town.', x: 90, z: 125, radius: 38, arrival: { x: 90, z: 145 } },
  { id: 'library', name: 'Library', description: 'A whole world of stories is waiting here.', x: 90, z: 96, radius: 10, arrival: { x: 90, z: 102 } },
  { id: 'garden', name: 'Pond gardens', description: 'Follow the flowers around the big duck pond.', x: 74, z: 269, radius: 18, arrival: { x: 82, z: 266 } },
  { id: 'pond', name: 'Duck pond', description: 'Watch the ducks paddle across their lovely big pond.', x: 62, z: 269, radius: 20, arrival: { x: 66, z: 269 } },
  { id: 'school', name: 'Little school', description: 'Learn something new with your friends.', x: 166, z: 96, radius: 9, arrival: { x: 166, z: 98 } },
  { id: 'bakery', name: 'Bakery', description: 'Something sweet is baking by the square.', x: 46, z: 117, radius: 9, arrival: { x: 46, z: 122 } },
  { id: 'cafe', name: 'Café', description: 'Stop by for a friendly hello.', x: 142, z: 117, radius: 9, arrival: { x: 142, z: 122 } },
  { id: 'neighborhoods', name: 'Rainbow neighborhood', description: 'Follow colorful rooftops through fifty westbank homes.', x: 154, z: 230, radius: 20, arrival: { x: 154, z: 242 } },
  { id: 'sunny-lanes', name: 'Sunny Lanes', description: 'Little homes and leafy streets lead toward the hill.', x: 130, z: 278, radius: 20, arrival: { x: 130, z: 290 } },
  { id: 'market', name: 'Market Street', description: 'Explore groceries, ice cream, crafts, and puzzles.', x: 154, z: 194, radius: 24, arrival: { x: 154, z: 194 } },
  { id: 'eastbank', name: 'Eastbank Village', description: 'Twenty more colorful homes across the river.', x: 294, z: 218, radius: 24, arrival: { x: 294, z: 218 } },
];
export const FRIEND_STARTS = [
  [72, 112], [81, 110], [90, 108], [99, 110], [108, 112], [70, 124], [110, 124],
  [72, 136], [87, 151], [99, 140], [90, 145], [108, 136], [78, 150], [60, 125], [102, 150],
  [81, 140], [66, 141], [114, 137], [66, 112], [114, 112],
].map(([x, z]) => ({ x, z }));
