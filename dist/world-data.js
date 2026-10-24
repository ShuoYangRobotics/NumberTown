// Coordinates are measured in block units. Buildings and obstacles share the
// same footprints as the rendered village so a wide friend can explore it too.
export const WORLD = Object.freeze({ width: 96, depth: 84, margin: 2 });

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
  { id: 'cream-cottage', name: '6', kind: 'house', facing: 'north', x: 10, z: 76, w: 10, d: 8, h: 4.2, wall: '#faf0d8', roof: '#bf9472', door: '#86a0a2' },
  { id: 'apricot-cottage', name: '7', kind: 'house', facing: 'north', x: 34, z: 76, w: 12, d: 8, h: 4.4, wall: '#f8e3cd', roof: '#d49982', door: '#8dafa4' },
  { id: 'town-hall', name: 'TOWN HALL', kind: 'hall', facing: 'north', x: 57, z: 76, w: 12, d: 8, h: 5.5, wall: '#f5e9cd', roof: '#94a8a4', door: '#7e9c98' },
  { id: 'pet-shop', name: 'LITTLE PAWS', kind: 'shop', facing: 'north', x: 86, z: 76, w: 11, d: 8, h: 4.4, wall: '#f1e5d8', roof: '#b496af', door: '#8caaa3' },
];

export const TREES = [
  [4, 5, 5.2], [18, 5, 4.7], [38, 5, 5.7], [60, 5, 5.1], [84, 5, 4.9], [92, 5, 5.5],
  [17, 16, 4.8], [61, 15, 5.3], [4, 24, 4.7], [91, 25, 5.4], [3, 37, 4.8],
  [38, 35, 5.2], [58, 35, 4.9], [3, 50, 5.7], [17, 53, 4.8], [92, 47, 5.3],
  [39, 60, 4.9], [57, 60, 5.1], [3, 66, 5.3], [92, 66, 5.5], [18, 77, 4.9],
  [43, 79, 5.2], [72, 78, 5.3], [93, 80, 5.0], [4, 81, 4.8],
].map(([x, z, h], i) => ({ id: `tree-${i}`, x, z, h, radius: 2.1, tint: i % 3 }));

export const BENCHES = [
  { x: 37.8, z: 54, rotation: Math.PI / 2 },
  { x: 58.5, z: 54, rotation: -Math.PI / 2 },
  { x: 18, z: 54, rotation: Math.PI / 2 },
  { x: 17, z: 71, rotation: 0 },
  { x: 82, z: 68.8, rotation: 0 },
];

export const LAMPS = [
  [18, 43], [26, 43], [70, 43], [78, 43], [38, 33], [58, 33], [44, 63], [52, 63],
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
];

export const FRIEND_STARTS = [
  [56, 29], [42, 47], [48, 40], [42, 40], [48, 54], [42, 54], [54, 54], [53, 36],
  [48, 33], [40, 29], [48, 47], [22, 47], [74, 47], [22, 66], [74, 66],
].map(([x, z]) => ({ x, z }));
