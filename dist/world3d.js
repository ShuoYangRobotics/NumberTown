import * as THREE from './vendor/three.module.js';
import { WORLD, BUILDINGS, TREES, BENCHES, LAMPS, POND, FOUNTAIN, ROAD_SEGMENTS } from './world-data.js';

const COLORS = {
  grass: '#b7cda4', soil: '#dfd0ad', path: '#f3e6cc', edge: '#fff5df',
  trim: '#fff6e5', glass: '#b9dce0', darkGlass: '#92bec6', wood: '#b28a66',
  darkWood: '#7d7568', leaves: ['#91b18b', '#a1bd91', '#7fa68a'],
  flowers: ['#eeb6ae', '#edd18c', '#bfaed7', '#fff1c5'], water: '#83c8d4',
};

function gableGeometry() {
  const p = [
    -.5, 0, .5, .5, 0, .5, 0, 1, .5,
    .5, 0, -.5, -.5, 0, -.5, 0, 1, -.5,
    -.5, 0, -.5, -.5, 0, .5, 0, 1, .5,
    -.5, 0, -.5, 0, 1, .5, 0, 1, -.5,
    .5, 0, .5, .5, 0, -.5, 0, 1, -.5,
    .5, 0, .5, 0, 1, -.5, 0, 1, .5,
    -.5, 0, -.5, .5, 0, -.5, .5, 0, .5,
    -.5, 0, -.5, .5, 0, .5, -.5, 0, .5,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function roundedRectangle(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function archGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-.5, 0); s.lineTo(.5, 0); s.lineTo(.5, .72);
  s.bezierCurveTo(.5, 1.1, -.5, 1.1, -.5, .72);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 12 });
}

/** A complete toy village. update() takes elapsed time in seconds. */
export function createTown() {
  const root = new THREE.Group();
  root.name = 'NumberTown';
  const geometry = {
    box: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(1, 12, 8),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
    cone: new THREE.ConeGeometry(1, 1, 12),
    circle: new THREE.CircleGeometry(1, 40),
    plane: new THREE.PlaneGeometry(1, 1),
    torus: new THREE.TorusGeometry(1, .1, 6, 32),
    roof: gableGeometry(), door: archGeometry(),
  };
  const materials = new Map(), batches = new Map();
  const dummy = new THREE.Object3D();
  const animated = { ducks: [], drops: [], flags: [] };
  const textureCache = new Map();
  let buildingTransform = null;

  function material(color, options = {}) {
    const key = `${color}:${JSON.stringify(options)}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .86, ...options }));
    return materials.get(key);
  }

  // One instanced draw per geometry/material pair, even for hundreds of window
  // frames and flowers. Matrices stay static after construction.
  function put(shape, color, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, cast = true) {
    const mat = typeof color === 'string' ? material(color) : color;
    const geo = geometry[shape];
    const key = `${shape}:${mat.uuid}:${cast}`;
    if (!batches.has(key)) batches.set(key, { geo, mat, cast, matrices: [] });
    dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, rz); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
    const matrix = dummy.matrix.clone();
    if (buildingTransform) matrix.premultiply(buildingTransform);
    batches.get(key).matrices.push(matrix);
  }

  const box = (x, y, z, w, h, d, color, ry = 0, rz = 0, cast = true) => put('box', color, x, y, z, w, h, d, 0, ry, rz, cast);
  const ball = (x, y, z, sx, sy, sz, color, cast = true) => put('sphere', color, x, y, z, sx, sy, sz, 0, 0, 0, cast);
  const cylinder = (x, y, z, radius, h, color) => put('cylinder', color, x, y, z, radius, h, radius);

  function path(x, z, w, d, color = COLORS.path, y = .028) {
    // Hundreds of street/door-path parts still need just two instanced draws.
    const r = Math.min(2, w / 3, d / 3);
    put('plane', color, x, y, z, w - 2 * r, d, 1, -Math.PI / 2, 0, 0, false);
    put('plane', color, x, y, z, w, d - 2 * r, 1, -Math.PI / 2, 0, 0, false);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
      put('circle', color, x + dx * (w / 2 - r), y, z + dz * (d / 2 - r), r, r, 1, -Math.PI / 2, 0, 0, false);
    }
  }

  // The rounded, layered island reads as a little model of a real place.
  const island = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRectangle(WORLD.width, WORLD.depth, 6), {
    depth: .8, bevelEnabled: true, bevelSize: .35, bevelThickness: .2, bevelSegments: 2, steps: 1,
  }), [material(COLORS.grass), material(COLORS.soil)]);
  island.rotation.x = -Math.PI / 2;
  island.position.set(WORLD.width / 2, -1, WORLD.depth / 2);
  island.receiveShadow = true; root.add(island);

  for (const road of ROAD_SEGMENTS) {
    path((road.x1 + road.x2) / 2, (road.z1 + road.z2) / 2,
      Math.abs(road.x2 - road.x1) || road.width, Math.abs(road.z2 - road.z1) || road.width);
  }
  path(48, 47, 28, 24, '#f6e9d0', .042);
  // Inlaid border and pale cobbles give the square its own identity.
  for (const x of [34.5, 61.5]) box(x, .052, 47, .28, .025, 22.5, '#ded1b5', 0, 0, false);
  for (const z of [35.5, 58.5]) box(48, .052, z, 26.8, .025, .28, '#ded1b5', 0, 0, false);
  for (let x = 37; x <= 59; x += 2.2) {
    for (const z of [37, 57]) box(x, .058, z, 1.7, .025, .65, '#ede0c5', 0, 0, false);
  }
  // Door paths join the broad street network. They are shallow and walkable.
  for (const b of BUILDINGS) {
    if (b.facing === 'north') {
      const front = b.z - b.d / 2;
      path(b.x, (front + 66) / 2, 3.7, front - 66 + .6, COLORS.path, .034);
      continue;
    }
    const front = b.z + b.d / 2;
    const street = b.street ?? (b.z < 25 ? 29 : b.z < 45 ? 47 : b.z < 65 ? 66 : 81);
    if (street > front) path(b.x, (front + street) / 2, b.kind === 'library' ? 9 : 3.7, street - front + .6, COLORS.path, .034);
  }

  function orientedBox(x, y, z, ox, oy, oz, w, h, d, color, ry) {
    box(x + ox * Math.cos(ry) + oz * Math.sin(ry), y + oy, z - ox * Math.sin(ry) + oz * Math.cos(ry), w, h, d, color, ry);
  }

  function windowAt(x, y, z, w = 1.5, h = 1.75, ry = 0) {
    const local = (ox, oy, oz, a, b, c, color) => orientedBox(x, y, z, ox, oy, oz, a, b, c, color, ry);
    local(0, 0, 0, w + .24, h + .24, .17, COLORS.trim);
    local(0, 0, .1, w, h, .13, COLORS.glass);
    local(0, 0, .19, .095, h, .065, COLORS.trim);
    local(0, .05, .19, w, .095, .065, COLORS.trim);
    local(0, -h / 2 - .15, .12, w + .45, .18, .44, COLORS.trim);
  }

  function makeSign(text, x, y, z, w, h = .9, bg = '#fff5df', ink = '#6f786d') {
    box(x, y, z, w + .14, h + .14, .18, COLORS.wood);
    if (typeof document === 'undefined') return;
    const cacheKey = `${text}|${bg}|${ink}`;
    let texture = textureCache.get(cacheKey);
    if (!texture) {
      const canvas = document.createElement('canvas'); canvas.width = text.length < 5 ? 128 : 1024; canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 ${text.length < 8 ? 72 : 61}px "Trebuchet MS", sans-serif`;
      ctx.fillText(text, canvas.width / 2, 68, canvas.width - 16);
      texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      textureCache.set(cacheKey, texture);
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }));
    sign.position.set(x, y, z + .1);
    if (buildingTransform) sign.applyMatrix4(buildingTransform);
    root.add(sign);
  }

  function flower(x, z, color, height = .5, scale = 1) {
    cylinder(x, height / 2 + .05, z, .035 * scale, height, '#839c70');
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
      ball(x + Math.cos(a) * .14 * scale, height, z + Math.sin(a) * .14 * scale, .17 * scale, .13 * scale, .17 * scale, color);
    }
    ball(x, height + .08, z, .1 * scale, .085 * scale, .1 * scale, '#f1d48a');
  }

  function planter(x, z, w, d, colorIndex = 0) {
    box(x, .23, z, w, .45, d, '#d8bfa0');
    box(x, .47, z, w - .14, .04, d - .14, '#a99f78');
    const count = Math.max(3, Math.round(w / .52));
    for (let i = 0; i < count; i++) flower(x - w * .38 + i * w * .76 / (count - 1), z, COLORS.flowers[(i + colorIndex) % 4], .76 + (i % 2) * .1, .8);
  }

  function makeBuilding(b, index) {
    buildingTransform = b.facing === 'north'
      ? new THREE.Matrix4().makeTranslation(b.x, 0, b.z)
        .multiply(new THREE.Matrix4().makeRotationY(Math.PI))
        .multiply(new THREE.Matrix4().makeTranslation(-b.x, 0, -b.z))
      : null;
    const front = b.z + b.d / 2, back = b.z - b.d / 2;
    const publicBuilding = ['library', 'school', 'hall'].includes(b.kind);
    const roofH = publicBuilding ? 3 : 2.3;
    box(b.x, .18, b.z, b.w + .35, .36, b.d + .35, '#e6d4b6');
    box(b.x, b.h / 2 + .17, b.z, b.w, b.h, b.d, b.wall);
    box(b.x, b.h - .05, b.z, b.w + .38, .25, b.d + .38, COLORS.trim);
    // The roof has front, back, and two sloped faces; it is never a billboard.
    put('roof', b.roof, b.x, b.h + .12, b.z, b.w + 1.1, roofH, b.d + 1.1);
    box(b.x, b.h + roofH + .12, b.z, .2, .15, b.d + 1.15, b.roof);
    // Soft corner trim carries around all four sides.
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
      box(b.x + dx * (b.w / 2 - .11), b.h / 2 + .15, b.z + dz * (b.d / 2 - .11), .22, b.h, .22, COLORS.trim);
    }
    const doorW = publicBuilding ? 2.9 : 1.6, doorH = publicBuilding ? 3.25 : 2.55;
    put('door', COLORS.trim, b.x, .22, front + .04, doorW + .28, doorH + .16, .18);
    put('door', b.door, b.x, .24, front + .23, doorW, doorH, .08);
    box(b.x, .18, front + .45, doorW + .65, .2, .9, '#e1d1b7');
    ball(b.x + doorW * .28, 1.4, front + .38, .08, .08, .08, '#d2b775');
    if (publicBuilding) box(b.x, 1.8, front + .34, .045, 2.9, .05, COLORS.trim);
    for (const dx of [-1, 1]) {
      windowAt(b.x + dx * b.w * .29, b.h * .49 + .25, front + .1, publicBuilding ? 2.1 : 1.55, publicBuilding ? 2.25 : 1.7);
      windowAt(b.x + dx * b.w * .26, b.h * .48 + .25, back - .1, 1.55, 1.8, Math.PI);
      for (const dz of [-1, 1]) windowAt(b.x + dx * (b.w / 2 + .1), b.h * .48 + .25, b.z + dz * b.d * .23, 1.45, 1.75, dx * Math.PI / 2);
    }
    put('circle', COLORS.trim, b.x, b.h + 1.0, front + .57, .67, .67, 1, 0, 0, 0, false);
    put('circle', COLORS.darkGlass, b.x, b.h + 1.0, front + .58, .48, .48, 1, 0, 0, 0, false);
    box(b.x, b.h + 1.0, front + .6, .08, .95, .05, COLORS.trim);
    box(b.x, b.h + 1.0, front + .6, .95, .08, .05, COLORS.trim);
    if (b.kind === 'house') {
      makeSign(b.name, b.x + doorW / 2 + .55, 2.2, front + .2, .5, .5);
      planter(b.x - b.w * .3, front + .45, 1.85, .65, index);
    } else {
      makeSign(b.name, b.x, b.h - .62, front + .29, Math.min(b.w - .7, b.kind === 'library' ? 12 : 8.8), .75);
    }
    if (b.kind === 'bakery' || b.kind === 'cafe' || b.kind === 'shop') {
      const awningW = b.w * .86, awningD = 1.3, awningY = b.h - 1.4;
      const stripe = b.kind === 'cafe' ? '#a6bba7' : b.kind === 'bakery' ? '#e7b186' : b.roof;
      const segments = 10;
      for (let i = 0; i < segments; i++) {
        const x = b.x - awningW / 2 + (i + .5) * awningW / segments;
        put('box', i % 2 ? COLORS.trim : stripe, x, awningY, front + .65, awningW / segments, .14, awningD, .12);
        box(x, awningY - .22, front + 1.25, awningW / segments, .32, .12, i % 2 ? COLORS.trim : stripe);
      }
    }
    if (index % 3 !== 1) {
      box(b.x + b.w * .27, b.h + roofH * .72, b.z - b.d * .2, .75, 1.5, .75, '#c4a38e');
      box(b.x + b.w * .27, b.h + roofH * .72 + .78, b.z - b.d * .2, .95, .2, .95, '#e1c7ae');
    }
    if (b.kind === 'library') {
      // A little book crest above the library's round window.
      box(b.x - .4, b.h + 1.75, front + .7, .75, .95, .13, '#f2d588', 0, -.13);
      box(b.x + .4, b.h + 1.75, front + .7, .75, .95, .13, '#fff1c9', 0, .13);
      box(b.x, b.h + 1.75, front + .79, .1, .95, .08, '#ba9270');
      for (const dx of [-1, 1]) {
        box(b.x + dx * (b.w / 2 - .6), b.h / 2, front + .18, .52, b.h, .45, '#f8e6bd');
        planter(b.x + dx * (b.w / 2 - 1.0), front + .6, 1.8, .9, 2);
      }
    }
    if (b.kind === 'school' || b.kind === 'hall') {
      const bellY = b.h + roofH + .7;
      box(b.x, bellY, b.z, 1.9, 1.4, 1.9, b.wall);
      put('roof', b.roof, b.x, bellY + .7, b.z, 2.4, 1.1, 2.4);
      put('circle', COLORS.trim, b.x, bellY, b.z + .97, .55, .55, 1, 0, 0, 0, false);
      box(b.x, bellY + .12, b.z + 1, .055, .32, .06, COLORS.darkWood);
      box(b.x + .1, bellY, b.z + 1, .24, .055, .06, COLORS.darkWood);
    }
    buildingTransform = null;
  }
  BUILDINGS.forEach(makeBuilding);

  for (const tree of TREES) {
    const { x, z, h, tint } = tree;
    const s = tree.crownScale ?? 1;
    cylinder(x, h * .29, z, .23, h * .58, '#a88d70');
    const green = COLORS.leaves[tint];
    ball(x, h * .75, z, 1.8 * s, h * .32, 1.75 * s, green);
    ball(x - .8 * s, h * .63, z + .3 * s, 1.25 * s, 1.25 * s, 1.25 * s, green);
    ball(x + .75 * s, h * .64, z - .25 * s, 1.25 * s, 1.2 * s, 1.25 * s, green);
    ball(x, h * .98, z, 1.05 * s, 1.1 * s, 1.05 * s, green);
  }

  function bench({ x, z, rotation }) {
    const local = (ox, oy, oz, w, h, d, color) => orientedBox(x, 0, z, ox, oy, oz, w, h, d, color, rotation);
    for (const dx of [-1, 1]) {
      local(dx * 1.02, .42, -.15, .14, .8, .16, COLORS.darkWood);
      local(dx * 1.02, .42, .27, .14, .8, .16, COLORS.darkWood);
      local(dx * 1.02, 1.02, -.32, .12, 1.2, .13, COLORS.darkWood);
    }
    for (const dz of [-.22, 0, .22]) local(0, .86, dz, 2.8, .13, .19, COLORS.wood);
    for (const y of [1.22, 1.49]) local(0, y, -.34, 2.8, .2, .13, COLORS.wood);
  }
  BENCHES.forEach(bench);
  for (const { x, z } of LAMPS) {
    cylinder(x, .2, z, .32, .35, '#a7a792');
    cylinder(x, 2, z, .1, 3.8, '#7d8e82');
    box(x, 4.0, z, .65, .9, .65, material('#ffedb8', { emissive: '#e7b76a', emissiveIntensity: .2 }));
    box(x, 3.54, z, .75, .12, .75, '#7d8e82');
    put('cone', '#7d8e82', x, 4.65, z, .61, .5, .61);
  }

  // Shallow water, individually modelled stones, lilies, and bobbing ducks.
  put('circle', '#e0d4b6', POND.x, .045, POND.z, POND.rx + .65, POND.rz + .65, 1, -Math.PI / 2, 0, 0, false);
  const waterMat = material(COLORS.water, { roughness: .24, metalness: .08 });
  put('circle', waterMat, POND.x, .07, POND.z, POND.rx, POND.rz, 1, -Math.PI / 2, 0, 0, false);
  for (let i = 0; i < 20; i++) {
    const a = i / 20 * Math.PI * 2;
    ball(POND.x + Math.cos(a) * (POND.rx + .15), .17, POND.z + Math.sin(a) * (POND.rz + .15), .47, .24, .36, i % 2 ? '#d2c7b2' : '#e0d5c0');
  }
  for (const [dx, dz] of [[-2.7, 1.4], [2.8, -1.4], [-1.8, -2]]) {
    put('circle', '#96b591', POND.x + dx, .085, POND.z + dz, .45, .35, 1, -Math.PI / 2, 0, 0, false);
    flower(POND.x + dx, POND.z + dz, '#f2c2ca', .18, .65);
  }

  function makeDuck(x, z, phase) {
    const duck = new THREE.Group();
    function part(shape, color, px, py, pz, sx, sy, sz) {
      const mesh = new THREE.Mesh(geometry[shape], material(color));
      mesh.position.set(px, py, pz); mesh.scale.set(sx, sy, sz); mesh.castShadow = true; duck.add(mesh); return mesh;
    }
    part('sphere', '#fff7d5', 0, .16, 0, .48, .28, .31);
    part('sphere', '#fff7d5', .33, .48, 0, .24, .25, .23);
    part('box', '#e2ad63', .55, .43, 0, .23, .1, .19);
    part('sphere', '#655f51', .42, .54, .19, .035, .035, .035);
    part('sphere', '#655f51', .42, .54, -.19, .035, .035, .035);
    part('sphere', '#eee6c5', -.08, .24, .27, .27, .15, .06);
    duck.position.set(x, .12, z); root.add(duck);
    animated.ducks.push({ duck, x, z, phase });
  }
  makeDuck(POND.x - 1, POND.z, 0); makeDuck(POND.x + 1.5, POND.z + 1, 2.1); makeDuck(POND.x + .7, POND.z - 1.5, 4);

  const fx = FOUNTAIN.x, fz = FOUNTAIN.z;
  cylinder(fx, .16, fz, 2.3, .32, '#d6c7ad');
  cylinder(fx, .35, fz, 2.08, .25, '#ecdfc5');
  cylinder(fx, .5, fz, 1.85, .08, waterMat);
  put('torus', '#eaddc3', fx, .5, fz, 2.05, 2.05, 2.05, Math.PI / 2);
  cylinder(fx, 1.1, fz, .39, 1.4, '#e2d3b9');
  cylinder(fx, 1.75, fz, 1.0, .2, '#eee1c7');
  cylinder(fx, 1.88, fz, .87, .055, waterMat);
  cylinder(fx, 2.2, fz, .08, .65, '#a3dce1');
  ball(fx, 2.52, fz, .13, .18, .13, '#a3dce1');
  const dropMaterial = material('#bce9eb', { roughness: .2 });
  for (let i = 0; i < 10; i++) {
    const drop = new THREE.Mesh(geometry.sphere, dropMaterial);
    drop.scale.set(.055, .12, .055); root.add(drop); animated.drops.push({ drop, phase: i / 10 });
  }

  // Garden beds sit beside the paths, leaving the broad routes open.
  for (const [x, z, w, d, tint] of [[27, 70, 3.2, 1.5, 0], [35, 68.5, 3.8, 1.2, 2], [18, 60, 1.8, 1.5, 1],
    [39, 25, 2, 1.2, 2], [58, 25, 2, 1.2, 0], [6, 27, 3.5, 1, 1], [88, 68.5, 3.5, 1, 2]]) planter(x, z, w, d, tint);
  for (let i = 0; i < 24; i++) {
    const x = 3.5 + ((i * 17.7) % 88), z = i % 2 ? 3.6 : 81.3;
    flower(x, z, COLORS.flowers[i % 4], .42 + (i % 3) * .08, .75);
  }

  // A welcoming line of little flags above the north entrance to the square.
  cylinder(37.5, 4.3, 35, .09, 8.6, '#b6a185');
  cylinder(59.3, 4.3, 35, .09, 8.6, '#b6a185');
  box(48.4, 8.45, 35, 21.8, .045, .045, '#b4aa92');
  const pennant = new THREE.BufferGeometry();
  pennant.setAttribute('position', new THREE.Float32BufferAttribute([-.42, 0, 0, .42, 0, 0, 0, -.85, 0], 3));
  pennant.computeVertexNormals();
  for (let i = 0; i < 15; i++) {
    const flag = new THREE.Mesh(pennant, material(['#dca6a0', '#f1d490', '#a8bfa7', '#a5bed0', '#bda7c9'][i % 5], { side: THREE.DoubleSide }));
    flag.position.set(38.5 + i * 1.42, 8.45, 35); flag.castShadow = true; root.add(flag); animated.flags.push(flag);
  }

  for (const { geo, mat, cast, matrices } of batches.values()) {
    const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = cast; mesh.receiveShadow = true;
    mesh.computeBoundingSphere(); root.add(mesh);
  }

  return {
    root,
    update(time) {
      for (const { duck, x, z, phase } of animated.ducks) {
        duck.position.set(x + Math.sin(time * .18 + phase) * .28, .12 + Math.sin(time * 1.8 + phase) * .035, z + Math.cos(time * .15 + phase) * .22);
        duck.rotation.y = phase + Math.sin(time * .22 + phase) * .3;
      }
      for (const { drop, phase } of animated.drops) {
        const t = (time * .65 + phase) % 1, a = phase * Math.PI * 10;
        drop.position.set(fx + Math.cos(a) * (.4 + t * .7), 1.95 - t * t * 1.4, fz + Math.sin(a) * (.4 + t * .7));
      }
      animated.flags.forEach((flag, i) => { flag.rotation.x = Math.sin(time * 1.5 + i * .6) * .11; });
    },
  };
}
