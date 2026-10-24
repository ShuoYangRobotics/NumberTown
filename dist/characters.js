/** Friendly, hand-drawn block characters. x/y is the ground point between the feet. */
export const CHARACTERS = [
  { number: 1, name: 'One', color: '#ef5352', dark: '#ae292f', description: 'Small, brave, and ready to explore.' },
  { number: 2, name: 'Two', color: '#ffb349', dark: '#dc7928', description: 'Two blocks, twice the adventure.' },
  { number: 3, name: 'Three', color: '#f6d649', dark: '#d3a624', description: 'A little crown and a big imagination.' },
  { number: 4, name: 'Four', color: '#61c981', dark: '#278b52', description: 'A cheerful green friend.' },
  { number: 5, name: 'Five', color: '#4dc5df', dark: '#187fb1', description: 'A star with a friendly high five.' },
];

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

function star(ctx, x, y, outer, inner, color, rotation = -Math.PI / 2) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = rotation + k * Math.PI / 5;
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

function eye(ctx, x, y, size, look, blink = false) {
  if (blink) {
    tube(ctx, x - size * .8, y, x, y + size * .5, x + size * .8, y, '#253b43', size * .26);
    return;
  }
  ellipse(ctx, x, y + size * .1, size * 1.03, size * 1.16, '#00000019');
  ellipse(ctx, x, y, size, size * 1.08, '#fffef8');
  ellipse(ctx, x + look * size * .16, y + size * .07, size * .55, size * .73, '#344753');
  ellipse(ctx, x + look * size * .16, y + size * .07, size * .36, size * .55, '#142c36');
  ellipse(ctx, x - size * .12 + look * size * .16, y - size * .2, size * .19, size * .24, '#ffffff');
}

function smile(ctx, x, y, s, number) {
  ctx.beginPath();
  ctx.moveTo(x - s * .19, y);
  ctx.quadraticCurveTo(x, y + s * .07, x + s * .2, y - s * .025);
  ctx.quadraticCurveTo(x + s * .12, y + s * .235, x - s * .02, y + s * .17);
  ctx.quadraticCurveTo(x - s * .16, y + s * .14, x - s * .19, y);
  ctx.fillStyle = number === 1 ? '#71222e' : '#893845';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ellipse(ctx, x + s * .045, y + s * .177, s * .12, s * .055, '#ff9b9e');
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

function glove(ctx, x, y, s, swing) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-.25 + swing * .2);
  const blue = '#137bb7';
  ellipse(ctx, 0, 0, s * .155, s * .19, blue, -.2);
  // Five clearly separated, rounded fingers.
  tube(ctx, -s * .08, -s * .02, -s * .26, -s * .08, -s * .26, -s * .18, blue, s * .095);
  tube(ctx, -s * .06, s * .05, -s * .10, s * .28, -s * .12, s * .3, blue, s * .085);
  tube(ctx, s * .015, s * .07, s * .025, s * .32, s * .035, s * .33, blue, s * .085);
  tube(ctx, s * .09, s * .045, s * .17, s * .27, s * .18, s * .27, blue, s * .082);
  tube(ctx, s * .12, -s * .015, s * .28, s * .15, s * .28, s * .15, blue, s * .075);
  tube(ctx, -s * .07, -s * .1, 0, -s * .16, s * .07, -s * .1, '#68c9ed', s * .035);
  ctx.restore();
}

/**
 * options: blockSize=22, time=0, moving=false, facing=1, jump=0,
 * selected=false, showNumber=true, preview=false. Height, including numeral,
 * is approximately (number + 1.1) * blockSize; maximum width is 2.1 * blockSize.
 */
export function drawCharacter(ctx, number, x, y, options = {}) {
  number = Math.max(1, Math.min(5, Math.round(number || 1)));
  const char = CHARACTERS[number - 1];
  const s = options.blockSize ?? 22;
  const time = options.time ?? 0;
  const moving = Boolean(options.moving);
  const facing = options.facing === -1 ? -1 : 1;
  const jump = Math.max(0, options.jump ?? 0);
  const phase = time * 11;
  const stride = moving ? Math.sin(phase) : Math.sin(time * 2 + number) * .09;
  const bob = moving ? Math.abs(Math.cos(phase)) * s * .055 : Math.sin(time * 2 + number) * s * .017;
  const footH = s * .27;
  const top = -number * s - footH;
  const depth = s * .145;
  const left = -s / 2 - depth / 2;
  const right = left + s;
  const armY = top + s * (number === 1 ? .63 : .82);
  const limb = number === 2 ? '#a7337e' : number === 3 ? '#d9483e' : char.dark;
  const blink = Math.sin(time * .71 + number * 1.7) > .9985;

  ctx.save();
  ctx.translate(x, y);
  if (!options.preview) {
    if (options.selected) {
      ellipse(ctx, 0, -s * .01, s * .91, s * .34, '#fff6b052');
      ctx.beginPath();
      ctx.ellipse(0, -s * .01, s * .9, s * .33, 0, 0, Math.PI * 2);
      ctx.lineWidth = s * .055;
      ctx.strokeStyle = '#fff9d8';
      ctx.stroke();
    }
    const shrink = Math.max(.6, 1 - jump / (s * 6));
    ellipse(ctx, s * .04, 0, s * .65 * shrink, s * .19 * shrink, '#35514226');
    ellipse(ctx, s * .04, 0, s * .45 * shrink, s * .12 * shrink, '#35514212');
  }
  ctx.translate(0, -jump - bob);

  // Arms sit behind the stack, with a soft highlight along each sleeve.
  const leftHand = { x: left - s * .38, y: armY + s * .48 + stride * s * .13 };
  const rightHand = { x: right + s * .38, y: armY + s * .43 - stride * s * .13 };
  tube(ctx, left + s * .06, armY, left - s * .3, armY + s * .12, leftHand.x, leftHand.y, limb, s * .18);
  tube(ctx, right - s * .01, armY, right + s * .3, armY + s * .1, rightHand.x, rightHand.y, limb, s * .18);
  tube(ctx, left - s * .08, armY + s * .04, left - s * .25, armY + s * .15, leftHand.x + s * .045, leftHand.y - s * .075, '#ffffff25', s * .045);
  if (number !== 5) ellipse(ctx, rightHand.x, rightHand.y, s * .105, s * .14, limb, -.35);
  ellipse(ctx, leftHand.x, leftHand.y, s * .105, s * .14, limb, .35);

  // Squishy shoes lift alternately while walking.
  for (const side of [-1, 1]) {
    const step = moving ? Math.max(0, stride * side) * s * .12 : 0;
    const fx = side * s * .25 + (moving ? stride * side * s * .045 : 0);
    tube(ctx, fx, -footH - s * .035, fx, -s * .16 - step, fx + side * s * .025, -s * .115 - step, limb, s * .17);
    ellipse(ctx, fx + side * s * .025, -s * .075 - step, s * .205, s * .125, limb, side * -.14);
    ellipse(ctx, fx - s * .025, -s * .12 - step, s * .1, s * .035, '#ffffff50', -.15);
  }

  // Every friend contains exactly its number of visible square blocks.
  for (let row = number - 1; row >= 0; row--) {
    const by = top + row * s;
    ctx.beginPath();
    ctx.moveTo(right - s * .03, by + s * .03);
    ctx.lineTo(right + depth, by - depth * .55);
    ctx.lineTo(right + depth, by + s - depth * .55 - s * .035);
    ctx.quadraticCurveTo(right + depth, by + s - depth * .35, right, by + s);
    ctx.lineTo(right - s * .03, by + s);
    ctx.closePath();
    ctx.fillStyle = char.dark;
    ctx.fill();

    const gradient = ctx.createLinearGradient(left, by, right, by + s);
    gradient.addColorStop(0, char.color);
    gradient.addColorStop(.48, char.color);
    gradient.addColorStop(1, char.dark);
    rounded(ctx, left, by, s, s, s * .065);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = '#143d3c16';
    ctx.lineWidth = s * .028;
    ctx.stroke();

    rounded(ctx, left + s * .04, by + s * .045, s * .91, s * .91, s * .045);
    ctx.lineWidth = s * .025;
    ctx.strokeStyle = '#ffffff3d';
    ctx.stroke();
    const shine = ctx.createLinearGradient(left, by, left + s * .3, by + s * .74);
    shine.addColorStop(0, '#ffffff48');
    shine.addColorStop(1, '#ffffff00');
    rounded(ctx, left + s * .055, by + s * .055, s * .89, s * .87, s * .045);
    ctx.fillStyle = shine;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.moveTo(left + s * .04, top);
  ctx.lineTo(left + depth, top - depth * .6);
  ctx.lineTo(right + depth - s * .02, top - depth * .6);
  ctx.lineTo(right - s * .015, top);
  ctx.closePath();
  ctx.fillStyle = char.color;
  ctx.fill();
  ctx.fillStyle = '#ffffff45';
  ctx.fill();

  // A red three-point crown and exactly three red jacket buttons.
  if (number === 3) {
    ctx.beginPath();
    ctx.moveTo(left + s * .1, top + s * .02);
    ctx.lineTo(left + s * .04, top - s * .34);
    ctx.lineTo(left + s * .3, top - s * .16);
    ctx.lineTo(left + s * .48, top - s * .44);
    ctx.lineTo(left + s * .67, top - s * .16);
    ctx.lineTo(left + s * .94, top - s * .34);
    ctx.lineTo(left + s * .86, top + s * .02);
    ctx.closePath();
    ctx.fillStyle = '#e85243';
    ctx.fill();
    ctx.strokeStyle = '#b83637';
    ctx.lineWidth = s * .025;
    ctx.stroke();
    for (const [px, py] of [[.04, -.34], [.48, -.44], [.94, -.34]]) {
      ellipse(ctx, left + s * px, top + s * py, s * .055, s * .055, '#ffdd61');
    }
    for (let i = 0; i < 3; i++) {
      const by = top + s * (1.13 + i * .36);
      ellipse(ctx, -depth / 2, by, s * .095, s * .13, '#d94a3c');
      ellipse(ctx, -depth / 2 - s * .022, by - s * .035, s * .027, s * .035, '#ff9d79');
    }
  }

  const faceX = -depth / 2 + facing * s * .025;
  const eyeY = top + s * .39;
  if (number === 1) {
    ellipse(ctx, faceX, eyeY, s * .285, s * .315, '#af2e39');
    eye(ctx, faceX, eyeY, s * .245, facing, blink);
    smile(ctx, faceX, top + s * .73, s * .85, number);
  } else {
    if (number === 5) {
      star(ctx, faceX - s * .24, eyeY, s * .36, s * .22, '#176eaa', -.45 * Math.PI);
      star(ctx, faceX - s * .24, eyeY, s * .29, s * .18, '#228ec2', -.45 * Math.PI);
    }
    if (number === 4) {
      for (const side of [-1, 1]) {
        rounded(ctx, faceX + side * s * .225 - s * .16, top + s * .11, s * .31, s * .095, s * .016);
        ctx.fillStyle = '#257743';
        ctx.fill();
      }
    }
    eye(ctx, faceX - s * .235, eyeY, s * .175, facing, blink);
    eye(ctx, faceX + s * .235, eyeY, s * .175, facing, blink);
    if (number === 2) {
      ctx.strokeStyle = '#8c3a96';
      ctx.lineWidth = s * .095;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(faceX + side * s * .235, eyeY, s * .215, s * .255, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      tube(ctx, faceX - s * .055, eyeY - s * .03, faceX, eyeY - s * .09, faceX + s * .055, eyeY - s * .03, '#8c3a96', s * .07);
      tube(ctx, left - s * .025, eyeY - s * .06, left + s * .02, eyeY - s * .08, left + s * .055, eyeY - s * .06, '#8c3a96', s * .075);
    }
    ellipse(ctx, faceX - s * .31, top + s * .66, s * .075, s * .04, '#f4777770');
    ellipse(ctx, faceX + s * .31, top + s * .66, s * .075, s * .04, '#f4777770');
    smile(ctx, faceX, top + s * .69, s, number);
  }
  if (number === 5) glove(ctx, rightHand.x, rightHand.y, s, stride);

  if (options.showNumber !== false) {
    const labelY = top - s * (number === 3 ? .62 : .24);
    ctx.font = `800 ${s * .58}px "Trebuchet MS", "Arial Rounded MT Bold", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineJoin = 'round';
    ctx.lineWidth = s * .19;
    ctx.strokeStyle = '#fffdf5';
    ctx.strokeText(String(number), 0, labelY);
    ctx.fillStyle = '#344343';
    ctx.fillText(String(number), 0, labelY);
  }
  ctx.restore();
}
