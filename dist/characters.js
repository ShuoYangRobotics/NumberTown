/** Friendly block characters. x/y is the ground point between the feet. */
export const CHARACTERS = [
  { number: 1, name: 'One', color: '#ef5352', dark: '#ae292f', cols: 1, rows: 1, description: 'Small, brave, and ready to explore.' },
  { number: 2, name: 'Two', color: '#ffb349', dark: '#dc7928', cols: 1, rows: 2, description: 'Two blocks, twice the adventure.' },
  { number: 3, name: 'Three', color: '#f6d649', dark: '#d3a624', cols: 1, rows: 3, description: 'A little crown and a big imagination.' },
  { number: 4, name: 'Four', color: '#61c981', dark: '#278b52', cols: 1, rows: 4, description: 'A cheerful green friend.' },
  { number: 5, name: 'Five', color: '#4dc5df', dark: '#187fb1', cols: 1, rows: 5, description: 'A star with a friendly high five.' },
  { number: 6, name: 'Six', color: '#9460d1', dark: '#63409b', cols: 2, rows: 3, description: 'Six spots and a playful purple smile.' },
  { number: 7, name: 'Seven', color: '#9d59d2', dark: '#72409d', cols: 1, rows: 7, description: 'Seven rainbow blocks, full of wonder.' },
  { number: 8, name: 'Eight', color: '#f93e9b', dark: '#c51f73', cols: 2, rows: 4, description: 'An eight-limbed, pink superhero.' },
  { number: 9, name: 'Nine', color: '#a5adae', dark: '#727e82', cols: 3, rows: 3, description: 'A thoughtful friend, three by three.' },
  { number: 10, name: 'Ten', color: '#fffdf7', dark: '#e4e3dd', cols: 2, rows: 5, description: 'Ten bright blocks and two starry eyes.' },
];

const RAINBOW = ['#be59c6', '#8d46ca', '#19c7df', '#25b760', '#ffe145', '#ffad32', '#f94b50'];
const RAINBOW_DARK = ['#a338aa', '#7132a7', '#08a8c1', '#109548', '#d9b729', '#e08420', '#cd303e'];
const EMOTIONS = new Set(['happy', 'excited', 'curious', 'surprised', 'sleepy', 'sad']);

function characterNumber(number) {
  const n = Number(number);
  return Number.isFinite(n) ? Math.max(1, Math.min(10, Math.round(n))) : 1;
}

/** Body dimensions plus a conservative envelope for art (excluding jump).
 * The anchor is the ground center; visualHeight includes numeral and feet.
 */
export function getCharacterMetrics(number, blockSize = 32) {
  const n = characterNumber(number);
  const { cols, rows } = CHARACTERS[n - 1];
  const s = Math.max(1, Number(blockSize) || 32);
  const widths = [2.15, 2.15, 2.15, 2.15, 2.85, 3.2, 2.3, 4.3, 4.2, 3.95];
  const headroom = n === 7 ? 1.85 : n === 3 ? 1.65 : 1.25;
  return { columns: cols, rows, width: cols * s, height: rows * s, visualWidth: widths[n - 1] * s, visualHeight: (rows + headroom) * s };
}

function rounded(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function ellipse(ctx, x, y, rx, ry, fill, angle = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function star(ctx, x, y, outer, inner, color, rotation = -Math.PI / 2, points = 5) {
  ctx.beginPath();
  for (let k = 0; k < points * 2; k++) {
    const a = rotation + k * Math.PI / points;
    const r = k % 2 ? inner : outer;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function tube(ctx, x1, y1, cx, cy, x2, y2, color, width) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cx, cy, x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function eye(ctx, x, y, size, look, blink, emotion, lidColor) {
  if (blink || emotion === 'excited') {
    tube(ctx, x - size * .8, y + size * .05, x, y - size * (emotion === 'excited' ? .85 : -.4), x + size * .8, y + size * .05, '#253b43', size * .25);
    return;
  }
  const wide = emotion === 'surprised' ? 1.12 : 1;
  ellipse(ctx, x, y + size * .1, size * 1.03 * wide, size * 1.16 * wide, '#00000019');
  ellipse(ctx, x, y, size * wide, size * 1.08 * wide, '#fffef8');
  const pupilScale = emotion === 'surprised' ? .77 : 1;
  const lookX = look * size * (emotion === 'curious' ? .25 : .16);
  ellipse(ctx, x + lookX, y + size * .07, size * .55 * pupilScale, size * .73 * pupilScale, '#344753');
  ellipse(ctx, x + lookX, y + size * .07, size * .36 * pupilScale, size * .55 * pupilScale, '#142c36');
  ellipse(ctx, x - size * .12 + lookX, y - size * .2, size * .19, size * .24, '#ffffff');
  if (emotion === 'sleepy') {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, size * wide, size * 1.08 * wide, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = lidColor;
    ctx.fillRect(x - size * 1.2, y - size * 1.3, size * 2.4, size * 1.55);
    tube(ctx, x - size, y + size * .2, x, y + size * .35, x + size, y + size * .2, '#344753', size * .12);
    ctx.restore();
  }
}

function smile(ctx, x, y, s, number, emotion = 'happy') {
  const outline = number === 6 || number === 10 ? '#d72c80' : number === 7 ? '#f5d927' : number === 8 ? '#6d3527' : number === 9 ? '#3c5360' : null;
  const fill = number === 1 ? '#71222e' : '#643241';
  if (emotion === 'surprised' || emotion === 'sleepy') {
    ellipse(ctx, x, y + s * .085, s * (emotion === 'sleepy' ? .075 : .12), s * (emotion === 'sleepy' ? .09 : .155), outline || fill);
    ellipse(ctx, x, y + s * .08, s * (emotion === 'sleepy' ? .047 : .075), s * (emotion === 'sleepy' ? .06 : .11), '#503240');
    return;
  }
  if (emotion === 'sad') {
    tube(ctx, x - s * .17, y + s * .09, x, y - s * .12, x + s * .17, y + s * .09, outline || fill, s * .055);
    return;
  }
  if (emotion === 'curious') {
    tube(ctx, x - s * .12, y + s * .05, x + s * .03, y + s * .12, x + s * .16, y - s * .025, outline || fill, s * .045);
    return;
  }
  const open = emotion === 'excited' ? 1.5 : 1;
  ctx.beginPath();
  ctx.moveTo(x - s * .19, y);
  ctx.quadraticCurveTo(x, y + s * .07, x + s * .2, y - s * .025);
  ctx.quadraticCurveTo(x + s * .12, y + s * .235 * open, x - s * .02, y + s * .17 * open);
  ctx.quadraticCurveTo(x - s * .16, y + s * .14 * open, x - s * .19, y);
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = s * .055; ctx.stroke(); }
  ctx.save();
  ctx.clip();
  ellipse(ctx, x + s * .045, y + s * .177 * open, s * .12, s * .055, '#ff9b9e');
  ctx.beginPath();
  ctx.moveTo(x - s * .18, y);
  ctx.quadraticCurveTo(x, y + s * .07, x + s * .19, y - s * .02);
  ctx.lineTo(x + s * .15, y + s * .055);
  ctx.quadraticCurveTo(x, y + s * .095, x - s * .15, y + s * .04);
  ctx.closePath();
  ctx.fillStyle = '#fffdf2';
  ctx.fill();
  ctx.restore();
}

function glove(ctx, x, y, s, swing, starGlove = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(starGlove ? Math.PI * .92 + swing * .12 : -.25 + swing * .2);
  const color = starGlove ? '#fffdf5' : '#137bb7';
  // Each finger gets an outline on Ten's white gloves.
  const fingers = [
    [-.08, -.02, -.26, -.08, -.26, -.18, .095],
    [-.06, .05, -.10, .28, -.12, .3, .085],
    [.015, .07, .025, .32, .035, .33, .085],
    [.09, .045, .17, .27, .18, .27, .082],
    [.12, -.015, .28, .15, .28, .15, .075],
  ];
  if (starGlove) {
    for (const f of fingers) tube(ctx, f[0] * s, f[1] * s, f[2] * s, f[3] * s, f[4] * s, f[5] * s, '#b52c3c', (f[6] + .04) * s);
    ellipse(ctx, 0, 0, s * .178, s * .213, '#b52c3c', -.2);
  }
  ellipse(ctx, 0, 0, s * .155, s * .19, color, -.2);
  for (const f of fingers) tube(ctx, f[0] * s, f[1] * s, f[2] * s, f[3] * s, f[4] * s, f[5] * s, color, f[6] * s);
  if (starGlove) star(ctx, 0, 0, s * .13, s * .057, '#e7354c');
  else tube(ctx, -s * .07, -s * .1, 0, -s * .16, s * .07, -s * .1, '#68c9ed', s * .035);
  ctx.restore();
}

function tentacle(ctx, x, y, s, side, wave) {
  const p0 = [x, y];
  const p1 = [x + side * s * .48, y + s * (.42 + wave * .06)];
  const p2 = [x + side * s * 1.03, y + s * (.18 + wave * .12)];
  const p3 = [x + side * s * .88, y - s * (.4 - wave * .1)];
  ctx.beginPath(); ctx.moveTo(...p0); ctx.bezierCurveTo(...p1, ...p2, ...p3);
  ctx.lineCap = 'round'; ctx.lineWidth = s * .18; ctx.strokeStyle = '#713a2e'; ctx.stroke();
  for (const t of [.24, .45, .65, .84, .98]) {
    const q = 1 - t;
    const px = q ** 3 * p0[0] + 3 * q * q * t * p1[0] + 3 * q * t * t * p2[0] + t ** 3 * p3[0];
    const py = q ** 3 * p0[1] + 3 * q * q * t * p1[1] + 3 * q * t * t * p2[1] + t ** 3 * p3[1];
    ellipse(ctx, px, py, s * .055, s * .06, '#ff9cb8');
  }
}

function brows(ctx, positions, eyeY, eyeSize, emotion, color, heavy = false) {
  if (emotion === 'happy' && !heavy) return;
  positions.forEach((x, i) => {
    const side = positions.length === 1 ? 0 : i === 0 ? -1 : 1;
    const y = eyeY - eyeSize * (emotion === 'surprised' ? 1.8 : 1.48);
    const width = eyeSize * .83;
    const tilt = emotion === 'sad' ? side * eyeSize * .45 : emotion === 'curious' ? -eyeSize * .28 : 0;
    const lift = emotion === 'curious' && i === 1 ? -eyeSize * .4 : 0;
    tube(ctx, x - width, y + tilt + lift, x, y - eyeSize * .14 + lift, x + width, y - tilt + lift, color, eyeSize * (heavy ? .37 : .18));
  });
}

/** Draw an animated character, anchored at its feet.
 * options: blockSize=22, time=0, moving=false, facing=1, jump=0,
 * selected=false, showNumber=true, preview=false, emotion='happy'.
 */
export function drawCharacter(ctx, number, x, y, options = {}) {
  number = characterNumber(number);
  const char = CHARACTERS[number - 1];
  const s = Math.max(1, Number(options.blockSize ?? 22) || 22);
  const time = options.time ?? 0;
  const moving = Boolean(options.moving);
  const facing = options.facing === -1 ? -1 : 1;
  const jump = Math.max(0, options.jump ?? 0);
  const emotion = EMOTIONS.has(options.emotion) ? options.emotion : 'happy';
  const phase = time * 11;
  const stride = moving ? Math.sin(phase) : Math.sin(time * 2 + number) * .09;
  const bob = moving ? Math.abs(Math.cos(phase)) * s * .055 : Math.sin(time * 2 + number) * s * .017;
  const footH = s * .27;
  const top = -char.rows * s - footH;
  const depth = s * .145;
  const left = -char.cols * s / 2 - depth / 2;
  const right = left + char.cols * s;
  const armY = top + s * (number === 1 ? .63 : number === 6 ? 1.1 : number === 9 ? 1.5 : number === 10 ? 1.6 : .82);
  const limb = number === 2 ? '#a7337e' : number === 3 ? '#d9483e' : number === 6 ? '#ce278c' : number === 7 ? '#ae43ac' : number === 8 ? '#713a2e' : number === 9 ? '#344b58' : number === 10 ? '#c82c40' : char.dark;
  const blink = Math.sin(time * .71 + number * 1.7) > .9985;

  ctx.save();
  ctx.translate(x, y);
  if (!options.preview) {
    const radius = s * (.48 + char.cols * .4);
    if (options.selected) {
      ellipse(ctx, 0, -s * .01, radius, s * .34, '#fff6b052');
      ctx.beginPath(); ctx.ellipse(0, -s * .01, radius, s * .33, 0, 0, Math.PI * 2);
      ctx.lineWidth = s * .055; ctx.strokeStyle = '#fff9d8'; ctx.stroke();
    }
    const shrink = Math.max(.6, 1 - jump / (s * 6));
    ellipse(ctx, s * .04, 0, s * (.3 + char.cols * .35) * shrink, s * .19 * shrink, '#35514226');
    ellipse(ctx, s * .04, 0, s * (.2 + char.cols * .25) * shrink, s * .12 * shrink, '#35514212');
  }
  ctx.translate(0, -jump - bob);

  const leftHand = { x: left - s * .38, y: armY + s * .48 + stride * s * .13 };
  const rightHand = { x: right + s * .38, y: armY + s * .43 - stride * s * .13 };
  if (number === 6 || number === 7 || number === 10) {
    const hand = number === 6 ? leftHand : rightHand;
    hand.y = armY - s * .5 + stride * s * .1;
    hand.x += (number === 6 ? -1 : 1) * s * .04;
  }
  if (number === 8) {
    // Six waving tentacles and two feet make Eight's eight limbs.
    for (let row = 0; row < 3; row++) {
      for (const side of [-1, 1]) tentacle(ctx, side < 0 ? left : right, top + s * (1.3 + row), s, side, Math.sin(time * 2.5 + row + side) * (moving ? .9 : .35));
    }
  } else {
    tube(ctx, left + s * .06, armY, left - s * .4, armY + s * .12, leftHand.x, leftHand.y, limb, s * .18);
    tube(ctx, right - s * .01, armY, right + s * .4, armY + s * .1, rightHand.x, rightHand.y, limb, s * .18);
    tube(ctx, left - s * .08, armY + s * .04, left - s * .25, armY + s * .15, leftHand.x + s * .045, leftHand.y - s * .075, '#ffffff25', s * .045);
    if (number !== 5 && number !== 10) ellipse(ctx, rightHand.x, rightHand.y, s * .105, s * .14, limb, -.35);
    if (number !== 10) ellipse(ctx, leftHand.x, leftHand.y, s * .105, s * .14, limb, .35);
  }

  for (const side of [-1, 1]) {
    const step = moving ? Math.max(0, stride * side) * s * .12 : 0;
    const fx = side * s * (char.cols === 1 ? .25 : char.cols * .25) + (moving ? stride * side * s * .045 : 0);
    tube(ctx, fx, -footH - s * .035, fx, -s * .16 - step, fx + side * s * .025, -s * .115 - step, limb, s * .17);
    ellipse(ctx, fx + side * s * .025, -s * .075 - step, s * (number === 8 ? .34 : .205), s * .125, limb, side * -.14);
    ellipse(ctx, fx - s * .025, -s * .12 - step, s * .1, s * .035, '#ffffff50', -.15);
  }

  // Exactly cols × rows square fronts, with a visible seam around every block.
  for (let row = char.rows - 1; row >= 0; row--) {
    const by = top + row * s;
    const color = number === 7 ? RAINBOW[row] : number === 9 ? ['#969e9f', '#afb5b4', '#c3c8c6'][row] : char.color;
    const dark = number === 7 ? RAINBOW_DARK[row] : number === 9 ? ['#788387', '#929c9e', '#a8b0b0'][row] : char.dark;
    ctx.beginPath();
    ctx.moveTo(right - s * .03, by + s * .03);
    ctx.lineTo(right + depth, by - depth * .55);
    ctx.lineTo(right + depth, by + s - depth * .55 - s * .035);
    ctx.quadraticCurveTo(right + depth, by + s - depth * .35, right, by + s);
    ctx.lineTo(right - s * .03, by + s); ctx.closePath();
    ctx.fillStyle = number === 10 ? '#be2b3c' : dark; ctx.fill();
    for (let col = 0; col < char.cols; col++) {
      const bx = left + col * s;
      const gradient = ctx.createLinearGradient(bx, by, bx + s, by + s);
      gradient.addColorStop(0, color); gradient.addColorStop(.48, color); gradient.addColorStop(1, dark);
      rounded(ctx, bx, by, s, s, s * .055);
      ctx.fillStyle = gradient; ctx.fill();
      ctx.strokeStyle = number === 10 ? '#a171714d' : '#143d3c28'; ctx.lineWidth = s * .028; ctx.stroke();
      rounded(ctx, bx + s * .04, by + s * .045, s * .91, s * .91, s * .04);
      ctx.lineWidth = s * .025; ctx.strokeStyle = '#ffffff3d'; ctx.stroke();
      const shine = ctx.createLinearGradient(bx, by, bx + s * .3, by + s * .74);
      shine.addColorStop(0, '#ffffff48'); shine.addColorStop(1, '#ffffff00');
      rounded(ctx, bx + s * .055, by + s * .055, s * .89, s * .87, s * .045);
      ctx.fillStyle = shine; ctx.fill();
      if (number === 6) {
        ellipse(ctx, bx + s * .5, by + s * .51, s * .18, s * .18, '#c1edf1');
        ellipse(ctx, bx + s * .46, by + s * .46, s * .045, s * .045, '#ffffff80');
      }
    }
  }
  ctx.beginPath(); ctx.moveTo(left + s * .04, top);
  ctx.lineTo(left + depth, top - depth * .6);
  ctx.lineTo(right + depth - s * .02, top - depth * .6);
  ctx.lineTo(right - s * .015, top); ctx.closePath();
  ctx.fillStyle = number === 7 ? RAINBOW[0] : number === 10 ? '#ef6474' : char.color; ctx.fill();
  ctx.fillStyle = '#ffffff45'; ctx.fill();
  // Seams on the shallow top plane preserve the multi-column silhouette.
  for (let col = 1; col < char.cols; col++) {
    tube(ctx, left + col * s, top, left + col * s + depth * .5, top - depth * .3, left + col * s + depth, top - depth * .6, '#45616a35', s * .022);
  }
  if (number === 10) {
    rounded(ctx, left + s * .025, top + s * .025, 2 * s - s * .05, 5 * s - s * .05, s * .025);
    ctx.strokeStyle = '#df334a'; ctx.lineWidth = s * .072; ctx.stroke();
  }

  if (number === 3) {
    ctx.beginPath(); ctx.moveTo(left + s * .1, top + s * .02);
    ctx.lineTo(left + s * .04, top - s * .34); ctx.lineTo(left + s * .3, top - s * .16);
    ctx.lineTo(left + s * .48, top - s * .44); ctx.lineTo(left + s * .67, top - s * .16);
    ctx.lineTo(left + s * .94, top - s * .34); ctx.lineTo(left + s * .86, top + s * .02); ctx.closePath();
    ctx.fillStyle = '#e85243'; ctx.fill(); ctx.strokeStyle = '#b83637'; ctx.lineWidth = s * .025; ctx.stroke();
    for (const [px, py] of [[.04, -.34], [.48, -.44], [.94, -.34]]) ellipse(ctx, left + s * px, top + s * py, s * .055, s * .055, '#ffdd61');
    for (let i = 0; i < 3; i++) {
      const by = top + s * (1.13 + i * .36);
      ellipse(ctx, -depth / 2, by, s * .095, s * .13, '#d94a3c');
      ellipse(ctx, -depth / 2 - s * .022, by - s * .035, s * .027, s * .035, '#ff9d79');
    }
  }
  if (number === 7) {
    for (let i = 0; i < 7; i++) {
      const hx = -depth / 2 + (i - 3) * s * .105;
      tube(ctx, hx, top - s * .015, hx + (i - 3) * s * .03, top - s * .27, hx + (i - 3) * s * .06, top - s * (.46 + (3 - Math.abs(i - 3)) * .035), RAINBOW[6 - i], s * .125);
    }
  }

  const faceX = -depth / 2 + facing * s * .025;
  const eyeY = top + s * (number === 6 ? 1.08 : number === 7 ? .3 : number === 8 ? .58 : number === 9 ? 1.08 : number === 10 ? .57 : .39);
  const eyeSize = s * (number === 1 ? .245 : number === 6 ? .205 : number === 8 ? .265 : number === 9 ? .31 : number === 10 ? .255 : .175);
  const gap = s * (number === 6 ? .91 : number === 8 ? .47 : number === 9 ? .62 : number === 10 ? .49 : .235);
  const positions = number === 1 ? [faceX] : [faceX - gap, faceX + gap];
  if (number === 1) ellipse(ctx, faceX, eyeY, s * .285, s * .315, '#af2e39');
  if (number === 5) {
    star(ctx, faceX - gap, eyeY, s * .36, s * .22, '#176eaa', -.45 * Math.PI);
    star(ctx, faceX - gap, eyeY, s * .29, s * .18, '#228ec2', -.45 * Math.PI);
  }
  if (number === 6) {
    for (const ex of positions) {
      for (let lash = -1; lash <= 1; lash++) tube(ctx, ex + lash * s * .1, eyeY - s * .17, ex + lash * s * .145, eyeY - s * .28, ex + lash * s * .16, eyeY - s * .34, '#eb397a', s * .07);
      ellipse(ctx, ex, eyeY, s * .265, s * .275, '#f24b7d');
      ellipse(ctx, ex, eyeY, s * .228, s * .239, '#b12668');
    }
  }
  if (number === 8) {
    for (const ex of positions) {
      star(ctx, ex, eyeY, s * .49, s * .3, '#6a3628', -Math.PI / 8, 8);
      ellipse(ctx, ex, eyeY, s * .35, s * .35, '#955b3e');
      ellipse(ctx, ex - s * .045, eyeY - s * .08, s * .27, s * .21, '#b47c50');
    }
  }
  if (number === 9) {
    for (const ex of positions) {
      rounded(ctx, ex - s * .43, eyeY - s * .44, s * .86, s * .88, s * .16);
      ctx.fillStyle = '#3f5663'; ctx.fill();
      rounded(ctx, ex - s * .355, eyeY - s * .355, s * .71, s * .71, s * .12);
      ctx.strokeStyle = '#7b9299'; ctx.lineWidth = s * .025; ctx.stroke();
    }
  }
  if (number === 10) {
    for (const ex of positions) {
      star(ctx, ex, eyeY, s * .49, s * .285, '#b82639');
      star(ctx, ex, eyeY - s * .018, s * .445, s * .255, '#f23d55');
    }
  }
  for (const ex of positions) eye(ctx, ex, eyeY, eyeSize, facing, blink, emotion, number === 7 ? RAINBOW[0] : number === 8 ? '#955b3e' : char.color);
  if (number === 2 || number === 7) {
    const frameColor = number === 7 ? '#f6df39' : '#8c3a96';
    ctx.strokeStyle = frameColor; ctx.lineWidth = s * (number === 7 ? .062 : .095);
    for (const ex of positions) {
      if (number === 7) rounded(ctx, ex - s * .22, eyeY - s * .21, s * .44, s * .43, s * .14);
      else { ctx.beginPath(); ctx.ellipse(ex, eyeY, s * .215, s * .255, 0, 0, Math.PI * 2); }
      ctx.stroke();
    }
    tube(ctx, faceX - s * .055, eyeY - s * .03, faceX, eyeY - s * .09, faceX + s * .055, eyeY - s * .03, frameColor, s * .07);
  }
  brows(ctx, positions, eyeY, eyeSize, emotion, number === 4 ? '#257743' : number === 9 ? '#3b5260' : number === 6 ? '#b12668' : '#374b50', number === 4 || number === 9);

  const mouthY = top + s * (number === 1 ? .73 : number === 6 ? 1.88 : number === 7 ? .69 : number === 8 ? 1.22 : number === 9 ? 2.12 : number === 10 ? 1.24 : .69);
  const mouthScale = s * (number === 1 ? .85 : number === 6 ? 1.45 : number === 8 ? 1.6 : number === 9 ? 2.05 : number === 10 ? 1.65 : 1);
  if (number < 6 && number !== 1) {
    ellipse(ctx, faceX - s * .31, top + s * .66, s * .075, s * .04, '#f4777770');
    ellipse(ctx, faceX + s * .31, top + s * .66, s * .075, s * .04, '#f4777770');
  }
  smile(ctx, faceX, mouthY, mouthScale, number, emotion);
  if (number === 5) glove(ctx, rightHand.x, rightHand.y, s, stride);
  if (number === 10) {
    glove(ctx, leftHand.x, leftHand.y, s * 1.1, stride, true);
    glove(ctx, rightHand.x, rightHand.y, s * 1.1, -stride, true);
  }

  if (options.showNumber !== false) {
    const labelY = top - s * (number === 7 ? .84 : number === 3 ? .62 : .24);
    ctx.font = `800 ${s * .58}px "Trebuchet MS", "Arial Rounded MT Bold", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.lineJoin = 'round';
    ctx.lineWidth = s * .19; ctx.strokeStyle = '#fffdf5'; ctx.strokeText(String(number), 0, labelY);
    ctx.fillStyle = '#344343'; ctx.fillText(String(number), 0, labelY);
  }
  ctx.restore();
}
