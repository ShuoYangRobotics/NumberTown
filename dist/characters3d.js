import * as THREE from './vendor/three.module.js';
import { CHARACTERS, getCharacterDefinition, getCharacterMetrics } from './character-data.js';
export { CHARACTERS, getCharacterMetrics } from './character-data.js';

const FEET = .35;
const MOODS = ['happy', 'excited', 'curious', 'surprised', 'sleepy', 'sad'];
const materials = new Map();
const lines = new Map();
const CUBE = new THREE.BoxGeometry(1, 1, 1);
const SPHERE = new THREE.SphereGeometry(1, 16, 12);
const EDGES = new THREE.EdgesGeometry(CUBE).getAttribute('position').array;
const RAINBOW = ['#ee3d49', '#ff9f31', '#ffe03d', '#55bd38', '#32cce1', '#8053d4', '#b44ecc'];
const Z = .56;

function material(color) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .54, metalness: 0 }));
  return materials.get(color);
}
function mesh(geometry, color, name) {
  const object = new THREE.Mesh(geometry, material(color));
  object.castShadow = true;
  object.receiveShadow = true;
  if (name) object.name = name;
  return object;
}
function ball(parent, x, y, z, rx, ry, rz, color, name) {
  const object = mesh(SPHERE, color, name);
  object.position.set(x, y, z); object.scale.set(rx, ry, rz); parent.add(object);
  return object;
}
function box(parent, x, y, z, w, h, d, color, name) {
  const object = mesh(CUBE, color, name);
  object.position.set(x, y, z); object.scale.set(w, h, d); parent.add(object);
  return object;
}
function tube(parent, points, radius, color, closed = false, name) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), closed, 'centripetal');
  const object = mesh(new THREE.TubeGeometry(curve, Math.max(12, points.length * 5), radius, 7, closed), color, name);
  parent.add(object);
  return object;
}
function polygon(parent, points, depth, color, x = 0, y = 0, z = Z, name) {
  const shape = new THREE.Shape();
  points.forEach(([px, py], i) => i ? shape.lineTo(px, py) : shape.moveTo(px, py));
  shape.closePath();
  const object = mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), color, name);
  object.position.set(x, y, z); parent.add(object);
  return object;
}
function star(parent, x, y, z, outer, inner, color, points = 5, angle = Math.PI / 2) {
  const path = Array.from({ length: points * 2 }, (_, i) => {
    const a = angle + i * Math.PI / points, r = i % 2 ? inner : outer;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  return polygon(parent, path, .035, color, x, y, z, 'star decoration');
}
function ring(parent, x, y, z, rx, ry, radius, color) {
  return tube(parent, Array.from({ length: 24 }, (_, i) => {
    const a = i / 24 * Math.PI * 2; return [x + rx * Math.cos(a), y + ry * Math.sin(a), z];
  }), radius, color, true, 'eye rim');
}
function rectangleRing(parent, x, y, z, w, h, radius, color) {
  const r = Math.min(w, h) * .17;
  const points = [];
  for (const [cx, cy, start] of [[x + w / 2 - r, y + h / 2 - r, 0], [x - w / 2 + r, y + h / 2 - r, 90], [x - w / 2 + r, y - h / 2 + r, 180], [x + w / 2 - r, y - h / 2 + r, 270]]) {
    for (let i = 0; i <= 4; i++) {
      const a = (start + i * 22.5) * Math.PI / 180;
      points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]);
    }
  }
  return tube(parent, points, radius, color, true, 'square glasses');
}
function outlineBody(body, data) {
  const grouped = new Map();
  for (const cell of data.cells) {
    const color = cell.outline || '#36515a';
    if (!grouped.has(color)) grouped.set(color, []);
    const vertices = grouped.get(color);
    for (let index = 0; index < EDGES.length; index += 3) {
      vertices.push(EDGES[index] + cell.x + .5 - data.width / 2, EDGES[index + 1] + cell.y + .5 + FEET, EDGES[index + 2]);
    }
  }
  for (const [color, vertices] of grouped) {
    if (!lines.has(color)) lines.set(color, new THREE.LineBasicMaterial({ color, transparent: true, opacity: color === '#36515a' ? .35 : .62 }));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const outline = new THREE.LineSegments(geometry, lines.get(color)); outline.name = 'unit cube seams'; body.add(outline);
  }
  if (data.number >= 10) {
    // A raised red outer frame makes the ten-part unmistakable from any angle.
    const w = data.number === 12 ? 3 : data.number === 15 ? 4 : 2;
    const h = data.number === 12 ? 4 : 5;
    const offset = -data.width / 2;
    const perimeter = data.number === 15
      ? [[0, 0], [4, 0], [4, 4], [3, 4], [3, 3], [2, 3], [2, 2], [1, 2], [1, 1], [0, 1]]
      : [[0, 0], [w, 0], [w, h], [0, h]];
    for (const z of [-.508, .508]) {
      const curve = new THREE.CurvePath();
      perimeter.forEach(([x, y], i) => {
        const next = perimeter[(i + 1) % perimeter.length];
        curve.add(new THREE.LineCurve3(new THREE.Vector3(offset + x, FEET + y, z), new THREE.Vector3(offset + next[0], FEET + next[1], z)));
      });
      body.add(mesh(new THREE.TubeGeometry(curve, perimeter.length * 6, .022, 6, true), '#da3247', 'red ten frame'));
    }
  }
}

function glove(parent, color, starGlove = false) {
  ball(parent, 0, 0, .02, .15, .19, .115, color, 'palm');
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * .082;
    tube(parent, [[x, .06, .02], [x * 1.35, .2 + (i === 1 || i === 2 ? .04 : 0), .035], [x * 1.5, .29 + (i === 1 || i === 2 ? .04 : 0), .025]], .043, color);
  }
  tube(parent, [[-.1, -.02, .03], [-.23, .03, .04], [-.26, .13, .025]], .047, color);
  if (starGlove) {
    star(parent, 0, .005, .132, .115, .048, '#df334a');
    box(parent, 0, -.16, 0, .22, .065, .19, '#df334a');
  }
}
function soccerBall(parent) {
  ball(parent, 0, 0, 0, .34, .34, .34, '#fffdf5', 'football');
  for (const direction of [[0, 0, 1], [.8, .4, .45], [-.8, .4, .45], [.3, -.83, .45], [-.45, -.76, .45], [0, 1, -.1], [0, 0, -1]]) {
    const normal = new THREE.Vector3(...direction).normalize();
    const patch = mesh(new THREE.CircleGeometry(.105, 5), '#283238');
    patch.position.copy(normal).multiplyScalar(.339);
    patch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    parent.add(patch);
  }
}
function skateboard(parent) {
  const board = new THREE.Group();
  board.rotation.z = -.09; parent.add(board);
  const shape = new THREE.Shape();
  shape.moveTo(-.23, -.67); shape.lineTo(-.23, .67); shape.absarc(0, .67, .23, Math.PI, 0, true);
  shape.lineTo(.23, -.67); shape.absarc(0, -.67, .23, 0, -Math.PI, true); shape.closePath();
  const deck = mesh(new THREE.ExtrudeGeometry(shape, { depth: .09, bevelEnabled: true, bevelSize: .025, bevelThickness: .02, bevelSegments: 2 }), '#8945b9', 'rainbow skateboard');
  board.add(deck);
  for (let i = 0; i < 7; i++) box(board, 0, -.66 + i * .22, .105, .43, .219, .018, RAINBOW[i]);
  box(board, 0, 0, .121, .045, 1.72, .018, '#fffdf5');
  for (const side of [-1, 1]) {
    for (const y of [-.56, .56]) {
      const wheel = mesh(new THREE.CylinderGeometry(.11, .11, .13, 12), '#e89629');
      wheel.rotation.z = Math.PI / 2; wheel.position.set(side * .27, y, -.03); board.add(wheel);
    }
  }
  return board;
}

function faceLayout(data) {
  const n = data.number, top = data.height + FEET;
  const result = { x: 0, eyeY: top - .37, mouthY: top - .76, gap: .235, size: .17, mouth: .52 };
  if (n === 1) Object.assign(result, { gap: 0, size: .25, mouth: .44, mouthY: top - .75 });
  if (n === 6) Object.assign(result, { eyeY: top - 1.02, mouthY: top - 1.88, gap: .9, size: .21, mouth: .8 });
  if (n === 7) Object.assign(result, { eyeY: top - .31, mouthY: top - .73 });
  if (n === 8) Object.assign(result, { eyeY: top - .59, mouthY: top - 1.25, gap: .46, size: .26, mouth: .87 });
  if (n === 9) Object.assign(result, { eyeY: top - 1.08, mouthY: top - 2.14, gap: .62, size: .31, mouth: 1.1 });
  if (n === 10) Object.assign(result, { eyeY: top - .6, mouthY: top - 1.29, gap: .49, size: .255, mouth: .89 });
  if (n === 11) Object.assign(result, { eyeY: FEET + .71, mouthY: FEET + .24, gap: .43, size: .24, mouth: .58 });
  if (n === 12) Object.assign(result, { eyeY: FEET + 1.48, mouthY: FEET + .78, gap: .42, size: .29, mouth: .75 });
  if (n === 13) Object.assign(result, { x: -.5, eyeY: FEET + .72, mouthY: FEET + .2, gap: .35, size: .23, mouth: .62 });
  if (n === 14) Object.assign(result, { eyeY: FEET + 1.02, mouthY: FEET + .43, gap: .42, size: .265, mouth: .79 });
  if (n === 15) Object.assign(result, { x: 1.5, eyeY: FEET + .73, mouthY: FEET + .22, gap: .3, size: .225, mouth: .58 });
  return result;
}
function eyeDecorations(parent, data, f) {
  const n = data.number;
  const positions = n === 1 ? [f.x] : [f.x - f.gap, f.x + f.gap];
  for (let index = 0; index < positions.length; index++) {
    const x = positions[index];
    if ([1, 2, 6, 11, 13, 14, 15].includes(n)) {
      const color = { 1: '#b52e36', 2: '#8c3a96', 6: '#e73480', 11: '#bb3b4d', 13: '#793c7d', 14: '#397927', 15: '#213f79' }[n];
      ring(parent, x, f.eyeY, Z + .015, f.size * 1.12, f.size * 1.2, n === 15 ? .052 : .038, color);
    }
    if (n === 5 && index === 0) star(parent, x, f.eyeY, .515, .36, .21, '#176eaa');
    if (n === 7) rectangleRing(parent, x, f.eyeY, Z + .03, .44, .4, .035, '#f4dd31');
    if (n === 8) {
      star(parent, x, f.eyeY, .513, .47, .29, '#653827', 8, .1);
      ball(parent, x, f.eyeY, .55, .33, .33, .055, '#955d41');
    }
    if (n === 9 || n === 12) rectangleRing(parent, x, f.eyeY, Z + .02, f.size * 2.45, f.size * (n === 12 ? 2.9 : 2.5), n === 9 ? .075 : .055, n === 9 ? '#3d5461' : '#be394e');
    if (n === 10) star(parent, x, f.eyeY, .515, .48, .28, '#e7334b');
    if ([6, 11, 12, 15].includes(n)) {
      const side = index ? 1 : -1;
      const color = n === 6 ? '#ee377d' : '#263342';
      for (let lash = 0; lash < (n === 6 ? 3 : 2); lash++) {
        const ex = x + side * (f.size * .8 + lash * .05);
        tube(parent, [[ex, f.eyeY + f.size * .45, .585], [ex + side * .09, f.eyeY + f.size * .65 + lash * .04, .59], [ex + side * .105, f.eyeY + f.size * 1.06 + lash * .035, .58]], .028, color);
      }
    }
  }
  if (n === 2 || n === 7 || n === 15) tube(parent, [[f.x - .07, f.eyeY, .59], [f.x, f.eyeY + .06, .6], [f.x + .07, f.eyeY, .59]], .027, n === 2 ? '#8c3a96' : n === 7 ? '#f4dd31' : '#213f79');
  if (n === 15) {
    for (const side of [-1, 1]) polygon(parent, [[0, 0], [side * .65, .05], [side * .65, .85], [side * .51, .85], [side * .51, .69], [side * .38, .69], [side * .38, .54], [side * .25, .54], [side * .25, .39], [side * .12, .39], [side * .12, .23]], .055, '#244583', f.x, f.eyeY + .04, .505, 'stepped superhero mask');
  }
}
function eye(parent, x, y, size, emotion, color) {
  if (emotion === 'excited') {
    tube(parent, [[x - size * .78, y, .68], [x, y + size * .5, .7], [x + size * .78, y, .68]], .032, '#253844');
    return;
  }
  const wide = emotion === 'surprised' ? 1.09 : 1;
  ball(parent, x, y, .595, size * wide, size * 1.08 * wide, .08, '#fffef8', 'eye white');
  const pupilScale = emotion === 'surprised' ? .68 : 1;
  const glance = emotion === 'curious' ? size * .25 : size * .08;
  ball(parent, x + glance, y - .015, .669, size * .53 * pupilScale, size * .68 * pupilScale, .035, '#24333f', 'pupil');
  ball(parent, x - size * .12 + glance, y + size * .22, .7, size * .18, size * .2, .018, '#ffffff', 'eye glint');
  if (emotion === 'sleepy') {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, size * 1.04, 0, Math.PI, false); shape.closePath();
    const lid = mesh(new THREE.ExtrudeGeometry(shape, { depth: .025, bevelEnabled: false }), color, 'sleepy eyelid');
    lid.position.set(x, y + .005, .71); parent.add(lid);
    tube(parent, [[x - size, y, .74], [x, y - .025, .75], [x + size, y, .74]], .022, '#344956');
  }
}
function mouth(parent, x, y, width, emotion, number) {
  const lip = number === 6 || number === 10 || number === 15 ? '#d7318b' : number === 7 ? '#f2d529' : number === 13 ? '#793c7d' : number === 14 ? '#36802b' : '#713549';
  if (emotion === 'surprised' || emotion === 'sleepy') {
    const scale = emotion === 'sleepy' ? .65 : 1;
    ball(parent, x, y, .585, width * .17 * scale, width * .22 * scale, .04, lip, 'round mouth rim');
    ball(parent, x, y, .624, width * .115 * scale, width * .165 * scale, .018, '#4d2d3b', 'round mouth');
    return;
  }
  if (emotion === 'sad' || emotion === 'curious') {
    const sad = emotion === 'sad';
    tube(parent, [[x - width * .28, y - .035, .6], [x, y + (sad ? width * .13 : -width * .08), .63], [x + width * .28, y + (sad ? -.035 : width * .08), .6]], .027, lip);
    return;
  }
  const h = width * (emotion === 'excited' ? .43 : .28);
  const shape = new THREE.Shape();
  shape.moveTo(-width * .34, .05);
  shape.quadraticCurveTo(0, -.04, width * .34, .065);
  shape.quadraticCurveTo(width * .23, -h, 0, -h);
  shape.quadraticCurveTo(-width * .26, -h * .9, -width * .34, .05);
  const inner = mesh(new THREE.ExtrudeGeometry(shape, { depth: .03, bevelEnabled: false }), '#51303e', 'smiling mouth');
  inner.position.set(x, y, .58); parent.add(inner);
  tube(parent, [[x - width * .34, y + .05, .62], [x, y - h, .62], [x + width * .34, y + .065, .62]], .028, lip);
  tube(parent, [[x - width * .26, y + .026, .628], [x, y - .011, .636], [x + width * .26, y + .039, .628]], .027, '#fffaf0');
  ball(parent, x + width * .045, y - h * .83, .619, width * .15, h * .15, .012, '#f37d9c', 'tongue');
}
function expression(data, f, emotion) {
  const group = new THREE.Group(); group.name = `expression ${emotion}`;
  const positions = data.number === 1 ? [f.x] : [f.x - f.gap, f.x + f.gap];
  for (let i = 0; i < positions.length; i++) {
    const x = positions[i], side = positions.length === 1 ? 0 : i ? 1 : -1;
    eye(group, x, f.eyeY, f.size, emotion, data.number === 8 ? '#955d41' : data.number >= 10 ? '#fffaf1' : data.color);
    if (emotion === 'happy' && ![4, 9, 12, 13, 14].includes(data.number)) continue;
    const y = f.eyeY + f.size * (emotion === 'surprised' ? 1.65 : 1.4);
    const tilt = emotion === 'sad' ? side * f.size * .45 : emotion === 'curious' ? f.size * .3 : 0;
    const lift = emotion === 'curious' && i === 1 ? f.size * .4 : 0;
    const points = [[x - f.size * .83, y + tilt + lift, .635], [x, y + f.size * .12 + lift, .65], [x + f.size * .83, y - tilt + lift, .635]];
    if (data.number === 14) {
      const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
      for (let j = 0; j < 7; j++) {
        const interval = [j / 7, (j + .5) / 7, (j + 1) / 7].map(t => curve.getPoint(t).toArray());
        tube(group, interval, .065, RAINBOW[i ? 6 - j : j]);
      }
    } else tube(group, points, [4, 9].includes(data.number) ? .055 : .034, data.number >= 11 ? data.dark : '#344d56');
  }
  mouth(group, f.x + (data.number === 11 ? .24 : 0), f.mouthY, f.mouth, emotion, data.number);
  return group;
}

const DIGITS = {
  0: [[[.12, 0], [0, .12], [-.02, .44], [.1, .6], [.27, .52], [.3, .18], [.2, 0], [.12, 0]]],
  1: [[[.05, .45], [.16, .6], [.16, 0]]],
  2: [[[0, .46], [.1, .6], [.28, .51], [.26, .35], [.02, .04], [.3, .04]]],
  3: [[[0, .54], [.18, .59], [.29, .47], [.18, .32], [.29, .18], [.2, .02], [0, .05]]],
  4: [[[.22, 0], [.22, .6]], [[.2, .59], [-.01, .22], [.33, .22]]],
  5: [[[.3, .58], [.03, .58], [.02, .33], [.2, .33], [.3, .19], [.22, .03], [0, .04]]],
  6: [[[.27, .58], [.11, .55], [.01, .32], [.02, .1], [.15, 0], [.29, .12], [.24, .3], [.02, .29]]],
  7: [[[0, .58], [.32, .58], [.12, 0]]],
  8: [[[.14, .3], [.02, .43], [.08, .58], [.23, .58], [.3, .43], [.14, .3], [0, .15], [.09, 0], [.24, .02], [.31, .17], [.14, .3]]],
  9: [[[.28, .31], [.08, .31], [0, .44], [.08, .59], [.24, .56], [.3, .38], [.2, .04], [.05, 0]]],
};
function numberPlaque(root, data) {
  const label = new THREE.Group(); label.name = `number ${data.number}`;
  const extra = data.number === 7 ? .6 : data.number === 3 || data.number === 14 ? .46 : 0;
  label.position.set(0, data.height + FEET + .47 + extra, .03);
  const digits = String(data.number), width = digits.length === 2 ? .65 : .43;
  ball(label, 0, 0, 0, width, .43, .055, '#fffcf1', 'number plaque');
  for (let i = 0; i < digits.length; i++) {
    const offset = (i - (digits.length - 1) / 2) * .43 - .145;
    for (const stroke of DIGITS[digits[i]]) tube(label, stroke.map(([x, y]) => [x + offset, y - .29, .07]), .027, '#263c46');
  }
  root.add(label);
}
function decorations(root, data) {
  const n = data.number, top = data.height + FEET;
  if (n === 3) {
    polygon(root, [[-.46, 0], [-.49, .33], [-.24, .15], [0, .45], [.24, .15], [.49, .33], [.46, 0]], .75, '#e64c43', 0, top, -.36, 'three-point crown');
    for (const [x, y] of [[-.49, .33], [0, .45], [.49, .33]]) ball(root, x, top + y, .025, .06, .06, .06, '#ffdf51');
    for (let i = 0; i < 3; i++) ball(root, 0, top - 1.18 - i * .36, .535, .09, .12, .06, '#d8463b', 'red button');
  }
  if (n === 6) {
    for (const cell of data.cells) ball(root, cell.x + .5 - data.width / 2, cell.y + .5 + FEET, .516, .18, .18, .024, '#c1edf1', 'six spot');
  }
  if (n === 7) {
    for (let i = 0; i < 7; i++) {
      const spike = box(root, (i - 3) * .12, top + .22, 0, .115, .53 - Math.abs(i - 3) * .03, .22, RAINBOW[i], 'rainbow hair');
      spike.rotation.z = -(i - 3) * .13;
    }
  }
  if (n === 14) {
    const helmet = mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), '#397e0a', 'green helmet');
    helmet.position.set(0, top - .02, 0); helmet.scale.set(1.08, .45, .64); root.add(helmet);
    box(root, 0, top + .015, .57, 2.08, .12, .1, '#245d0d', 'helmet brim');
    for (const side of [-1, 1]) {
      ball(root, side * 1.015, top - .08, 0, .1, .29, .51, '#306c0d');
      ball(root, side * .39, top + .22, .56, .065, .035, .016, '#1a490b', 'helmet vent');
    }
    const prop = new THREE.Group(); prop.position.set(1.6, 1.15, .15); skateboard(prop); root.add(prop);
  }
}

/** Build true unit-cube geometry. Front is +Z; root y=0 is the shoe sole.
 * Calling update never changes root position/rotation: the game owns movement.
 * Expressions and labels use prebuilt meshes, with no DOM or canvas dependency.
 */
export function createCharacter(number) {
  const data = getCharacterDefinition(number);
  const metrics = getCharacterMetrics(data.number);
  const root = new THREE.Group(); root.name = `${data.name} character`;
  root.userData.number = data.number;
  root.userData.visualHeight = data.height + 1.25 + (data.number === 7 ? .6 : data.number === 3 || data.number === 14 ? .46 : 0);
  const body = new THREE.Group(); body.name = 'unit block body'; root.add(body);
  for (const cell of data.cells) {
    const cube = mesh(CUBE, cell.color, `${data.name} block ${cell.x},${cell.y}`);
    cube.position.set(cell.x + .5 - data.width / 2, cell.y + .5 + FEET, 0);
    cube.userData.unitBlock = true;
    cube.userData.cell = { x: cell.x, y: cell.y };
    body.add(cube);
  }
  outlineBody(body, data);
  const feet = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    const fx = data.number === 15 ? 1.5 + side * .3 : side * Math.min(.65, data.width * .26);
    pivot.position.set(fx, .38, 0); root.add(pivot); feet.push(pivot);
    const footColor = data.number === 15 ? side < 0 ? '#f8efe8' : '#40c9de' : data.dark;
    tube(pivot, [[0, .03, 0], [0, -.13, 0], [0, -.22, .04]], .075, data.dark);
    ball(pivot, side * .015, -.24, .1, data.number === 8 ? .32 : .205, .14, .3, footColor, 'walking shoe');
    if (data.number === 11 || data.number === 15) box(pivot, 0, -.2, .345, .26, .065, .025, data.number === 11 ? '#fffdf5' : side < 0 ? '#cc3548' : '#188ab0', 'shoe stripe');
  }
  const arms = [];
  const lowFace = data.number >= 11;
  const armY = lowFace ? (data.number === 12 ? 1.02 : 1.0) : data.height + FEET - (data.number === 6 ? 1.12 : data.number === 9 ? 1.5 : data.number === 10 ? 1.6 : .8);
  for (const side of [-1, 1]) {
    const count = data.number === 8 ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const pivot = new THREE.Group();
      pivot.position.set(side * data.width / 2, data.number === 8 ? data.height + FEET - 1.28 - i : armY, 0);
      root.add(pivot);
      const lifted = data.number === 6 && side < 0 || [7, 10].includes(data.number) && side > 0;
      const handY = lifted ? .48 : data.number === 8 ? .33 : data.number === 1 ? -.32 : -.49;
      const handX = side * (data.number === 8 ? .88 : .39);
      const points = data.number === 8
        ? [[0, 0, 0], [side * .44, -.25, .05], [side * .84, -.14, .07], [handX, handY, .06]]
        : [[0, 0, 0], [side * .3, lifted ? -.05 : -.18, .03], [handX, handY, .055]];
      const arm = tube(pivot, points, data.number === 8 ? .09 : .085, data.dark, false, data.number === 8 ? 'tentacle' : 'arm');
      if (data.number === 8) {
        const curve = arm.geometry.parameters.path;
        for (const t of [.26, .44, .62, .8, .97]) {
          const p = curve.getPoint(t); ball(pivot, p.x, p.y, p.z + .072, .053, .06, .025, '#ffa6be', 'tentacle spot');
        }
      } else {
        const hand = new THREE.Group(); hand.position.set(handX, handY, .055); pivot.add(hand);
        if (data.number === 5 && side > 0 || data.number === 10) {
          hand.rotation.z = side * -.25; glove(hand, data.number === 10 ? '#fffaf1' : data.dark, data.number === 10);
        } else ball(hand, 0, 0, 0, .105, .14, .1, data.dark, 'hand');
        if (data.number === 11 && side < 0) { const prop = new THREE.Group(); prop.position.set(-.04, .25, .2); soccerBall(prop); hand.add(prop); }
        if (data.number === 12 && side > 0) box(hand, -.07, -.035, .01, .065, .22, .2, '#fff6d9', 'wrist band');
      }
      arms.push({ pivot, side, phase: i * .9, tentacle: data.number === 8 });
    }
  }
  decorations(root, data);
  const face = faceLayout(data);
  eyeDecorations(root, data, face);
  const expressions = Object.fromEntries(MOODS.map(emotion => {
    const group = expression(data, face, emotion); group.visible = false; root.add(group); return [emotion, group];
  }));
  numberPlaque(root, data);
  let currentEmotion;
  let elapsed = 0;
  function setEmotion(emotion = 'happy') {
    const next = MOODS.includes(emotion) ? emotion : 'happy';
    if (next !== currentEmotion) {
      if (currentEmotion) expressions[currentEmotion].visible = false;
      expressions[next].visible = true;
      currentEmotion = next; root.userData.emotion = next;
    }
    return next;
  }
  function update(dt = 0, state = {}) {
    elapsed = Number.isFinite(state.time) ? state.time : elapsed + (Number.isFinite(dt) ? dt : 0);
    if (state.emotion !== undefined) setEmotion(state.emotion);
    const moving = Boolean(state.moving), stride = Math.sin(elapsed * 10);
    feet.forEach((foot, index) => {
      const side = index ? 1 : -1;
      foot.rotation.x = moving ? stride * side * .38 : 0;
      foot.position.y = .38 + (moving ? Math.max(0, stride * side) * .08 : 0);
    });
    for (const { pivot, side, phase, tentacle } of arms) {
      pivot.rotation.x = moving ? -stride * side * .3 : Math.sin(elapsed * 1.6 + phase) * .045;
      pivot.rotation.z = tentacle ? Math.sin(elapsed * 2.6 + phase + side) * .09 : Math.sin(elapsed * 1.7 + side) * (moving ? .09 : .035);
    }
  }
  setEmotion('happy');
  return { root, body, setEmotion, update, height: metrics.height, width: metrics.width, radius: metrics.radius };
}
