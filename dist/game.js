import { CHARACTERS, drawCharacter, getCharacterMetrics } from './characters.js';
import { WORLD, project, obstacles, townObjects, drawGround, LANDMARKS, FRIEND_STARTS } from './town.js';
import { movementVector, moveWithCollisions, nearestOpenPosition } from './physics.js';
import { EMOTIONS, chooseRemark } from './personalities.js';

const $ = selector => document.querySelector(selector);
const canvas = $('#world'), ctx = canvas.getContext('2d');
const helpDialog = $('#help-dialog');
const keys = new Set(), touches = new Set();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const BLOCK_SIZE = 32;
let width = innerWidth, height = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
let zoom = 1, baseScale = 1, time = 0, lastTime = 0;
let muted = true, audioContext, hopCooldown = 0, nextFootstep = 0, nextNeighborTalk = 7;
let camera = { x: 0, y: 0 }, currentPlace = null;
let lastArrival = -10, blockedTime = 0, nextOops = 0;
const particles = [], friendButtons = [], previewCanvases = [];
const players = CHARACTERS.map((character, index) => ({
  ...character, ...nearestOpenPosition(FRIEND_STARTS[index], obstacles, WORLD, 14 + (character.cols - 1) * 9),
  radius: 14 + (character.cols - 1) * 9,
  facing: 1, moving: false, jump: 0, jumpVelocity: 0, phase: index * 1.8,
  emotion: 'happy', emotionUntil: 8 + index * 2.3, nextTalk: 10 + index * 1.7, lastText: ''
}));
let active = players[0];
const bubbles = [
  { element: $('#speech'), player: active, until: 5 },
  { element: $('#neighbor-speech'), player: null, until: 0 }
];

for (const friend of CHARACTERS) {
  const button = document.createElement('button');
  button.className = 'friend'; button.type = 'button';
  button.setAttribute('aria-label', `Play as ${friend.name}, ${friend.number} ${friend.number === 1 ? 'block' : 'blocks'}`);
  button.setAttribute('aria-pressed', String(friend.number === active.number));
  button.title = `${friend.name} · press ${friend.number % 10}`;
  const accent = friend.number === 10 ? '#dc5265' : friend.color;
  button.style.setProperty('--friend-color', accent);
  button.style.setProperty('--friend-dark', friend.number === 10 ? '#a32d43' : friend.dark);
  button.style.setProperty('--friend-bg', `${accent}17`);
  button.style.setProperty('--friend-shadow', `${accent}2b`);
  const preview = document.createElement('canvas'); preview.width = 144; preview.height = 156;
  const image = document.createElement('img'); image.alt = ''; image.setAttribute('aria-hidden', 'true');
  const key = document.createElement('span'); key.className = 'friend-key'; key.textContent = friend.number === 10 ? '0' : friend.number;
  const name = document.createElement('span'); name.className = 'friend-name'; name.textContent = friend.name;
  const chosen = document.createElement('span'); chosen.className = 'chosen'; chosen.textContent = '✓'; chosen.setAttribute('aria-hidden', 'true');
  button.append(key, image, name, chosen);
  button.addEventListener('click', () => { selectFriend(friend.number); focusGame(); });
  $('#friends').append(button);
  friendButtons.push(button); previewCanvases.push({ canvas: preview, image });
}

function redrawPreviews() {
  previewCanvases.forEach(({ canvas: preview, image }, index) => {
    const pctx = preview.getContext('2d'), metrics = getCharacterMetrics(index + 1, 1);
    const size = Math.min(23, 62 / metrics.visualHeight, 60 / metrics.visualWidth);
    pctx.clearRect(0, 0, preview.width, preview.height);
    pctx.save(); pctx.scale(2, 2);
    drawCharacter(pctx, index + 1, 36, 73, { blockSize: size, time: 0, preview: true, selected: false, showNumber: false, emotion: 'happy' });
    pctx.restore(); image.src = preview.toDataURL('image/png');
  });
}

function focusGame() { canvas.focus({ preventScroll: true }); }
function placeAt(player) {
  return LANDMARKS.filter(place => Math.hypot(player.x - place.x, player.y - place.y) < place.radius)
    .sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y))[0] || null;
}
function updateMoodControl() {
  const emotion = EMOTIONS.find(item => item.id === active.emotion) || EMOTIONS[0];
  $('#mood-icon').textContent = emotion.icon;
  $('#mood-name').textContent = `${active.name} feels ${emotion.label.toLowerCase()}`;
  $('#mood-toggle').setAttribute('aria-label', `${active.name} feels ${emotion.label.toLowerCase()}. Change emotion`);
  document.querySelectorAll('[data-emotion]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.emotion === active.emotion)));
}
function setEmotion(player, emotion, duration = 14) {
  if (!EMOTIONS.some(item => item.id === emotion)) return;
  player.emotion = emotion; player.emotionUntil = time + duration;
  if (player === active) updateMoodControl();
}
function speak(text, player) {
  if (muted || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;
  try {
    if (speechSynthesis.speaking) return;
    const voice = new SpeechSynthesisUtterance(text);
    voice.lang = 'en-US'; voice.rate = .96; voice.pitch = 1.05 + (player.number % 4) * .1; voice.volume = .7;
    const available = speechSynthesis.getVoices();
    const english = available.find(item => item.lang.startsWith('en') && item.localService) || available.find(item => item.lang.startsWith('en'));
    if (english) voice.voice = english;
    speechSynthesis.speak(voice);
  } catch { /* Speech bubbles remain available when the browser has no voice. */ }
}
function say(player, text, subtext = '', options = {}) {
  if (player === active) bubbles[1].until = 0;
  const bubble = bubbles[player === active ? 0 : 1];
  bubble.player = player; bubble.until = time + (options.duration || 4.8);
  bubble.element.replaceChildren(document.createTextNode(text));
  const subtitle = subtext || `${player.name} · ${player.emotion}`;
  const sub = document.createElement('span'); sub.textContent = subtitle; bubble.element.append(sub);
  bubble.element.classList.remove('hidden'); player.lastText = text;
  player.nextTalk = time + 11 + Math.random() * 7;
  if (player === active && options.voice !== false) speak(text, player);
}
function remark(player, context = {}) {
  const nearby = players.find(friend => friend !== player && Math.hypot(friend.x - player.x, friend.y - player.y) < 120);
  const line = chooseRemark(player.number, {
    place: placeAt(player)?.id, moving: player.moving, emotion: player.emotion,
    nearbyName: nearby?.name, lastText: player.lastText, ...context
  });
  setEmotion(player, line.emotion, 12 + Math.random() * 7);
  say(player, line.text);
}
function selectFriend(number) {
  const friend = players.find(player => player.number === number);
  if (!friend) return;
  active.moving = false; active = friend; blockedTime = 0;
  bubbles[1].until = 0;
  friendButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(index + 1 === number)));
  updateMoodControl(); currentPlace = placeAt(active);
  remark(active);
  playTone(300 + number * 55, .12, .04);
}

for (const emotion of EMOTIONS) {
  const button = document.createElement('button'); button.type = 'button'; button.dataset.emotion = emotion.id;
  const icon = document.createElement('span'); icon.textContent = emotion.icon;
  button.append(icon, document.createTextNode(emotion.label));
  button.setAttribute('aria-pressed', String(emotion.id === active.emotion));
  button.addEventListener('click', () => {
    setEmotion(active, emotion.id, 24); remark(active, { emotion: emotion.id });
    active.emotionUntil = time + 24; closeMood(); focusGame();
  });
  $('#emotion-options').append(button);
}
$('#mood-toggle').addEventListener('click', () => {
  const open = $('#mood-menu').hidden;
  $('#mood-menu').hidden = !open; $('#mood-toggle').setAttribute('aria-expanded', String(open));
});
function closeMood() { $('#mood-menu').hidden = true; $('#mood-toggle').setAttribute('aria-expanded', 'false'); }
$('#game').addEventListener('pointerdown', event => { if (!event.target.closest('.mood-control')) closeMood(); });

for (const id of ['town-square', 'library', 'garden']) {
  const place = LANDMARKS.find(item => item.id === id); if (!place) continue;
  const button = document.createElement('button'); button.type = 'button'; button.dataset.place = id;
  button.textContent = `${id === 'library' ? '▤' : id === 'town-square' ? '⌘' : '❀'}  ${id === 'garden' ? 'Gardens' : place.name}`;
  button.title = `Visit ${place.name}`;
  button.addEventListener('click', () => visit(place)); $('#destinations').append(button);
}
function visit(place) {
  clearInput();
  Object.assign(active, nearestOpenPosition(place.arrival, obstacles, WORLD, active.radius), { jump: 0, jumpVelocity: 0, moving: false });
  currentPlace = place; lastArrival = time; bubbles[1].until = 0;
  setEmotion(active, place.id === 'library' ? 'curious' : 'excited');
  remark(active, { place: place.id }); focusGame();
}

function resize() {
  width = innerWidth; height = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  baseScale = Math.max(.5, Math.min(width / 1850, (height - 180) / 1000));
  redrawPreviews();
}
addEventListener('resize', resize); resize();
const initialPosition = project(active.x, active.y);
camera = { x: initialPosition.x, y: initialPosition.y - 100 };
updateMoodControl();

function playTone(frequency, duration = .12, gain = .035, type = 'sine') {
  if (muted) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const oscillator = audioContext.createOscillator(), envelope = audioContext.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * .75, audioContext.currentTime + duration);
    envelope.gain.setValueAtTime(gain, audioContext.currentTime); envelope.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(envelope); envelope.connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
  } catch { /* Audio is optional. */ }
}
function jump() {
  if (helpDialog.open || active.jump > 0 || time < hopCooldown) return;
  active.jumpVelocity = 260; hopCooldown = time + .5; setEmotion(active, 'excited', 5);
  playTone(480, .22, .04);
  if (!reducedMotion) for (let i = 0; i < 5; i++) particles.push({ x: active.x, y: active.y, age: 0, life: .6, angle: i * Math.PI * 2 / 5, kind: 'spark' });
}
const movementKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'];
addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey || helpDialog.open) return;
  const key = event.key.toLowerCase();
  if (key === 'escape') { closeMood(); return; }
  if (movementKeys.includes(key) || event.code === 'Space') {
    if (event.code === 'Space' && document.activeElement?.tagName === 'BUTTON') return;
    event.preventDefault(); closeMood();
    if (event.code === 'Space') { if (!event.repeat) jump(); } else keys.add(key);
  }
  if (/^[0-9]$/.test(key) && !event.repeat) { selectFriend(key === '0' ? 10 : Number(key)); focusGame(); }
  if (key === 'e' && !event.repeat) {
    const index = EMOTIONS.findIndex(item => item.id === active.emotion);
    const emotion = EMOTIONS[(index + 1) % EMOTIONS.length].id;
    setEmotion(active, emotion, 24); remark(active, { emotion }); active.emotionUntil = time + 24;
  }
});
addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
function clearInput() { keys.clear(); touches.clear(); players.forEach(player => player.moving = false); document.querySelectorAll('.dpad .active').forEach(button => button.classList.remove('active')); }
addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearInput(); lastTime = 0; if ('speechSynthesis' in window) speechSynthesis.cancel(); }
});
document.querySelectorAll('[data-move]').forEach(button => {
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); touches.add(button.dataset.move); button.classList.add('active'); });
  const release = () => { touches.delete(button.dataset.move); button.classList.remove('active'); };
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
});
$('#touch-jump').addEventListener('pointerdown', event => { event.preventDefault(); jump(); });
$('#sound').addEventListener('click', event => {
  muted = !muted; const button = event.currentTarget;
  button.setAttribute('aria-pressed', String(!muted));
  button.setAttribute('aria-label', muted ? 'Turn voices and sounds on' : 'Turn voices and sounds off');
  button.title = muted ? 'Turn voices and sounds on' : 'Turn voices and sounds off';
  if (muted && 'speechSynthesis' in window) speechSynthesis.cancel();
  playTone(660, .18, .045); if (!muted) speak(`Hello! I'm ${active.name}. Let's explore!`, active); focusGame();
});
$('#help').addEventListener('click', () => { clearInput(); closeMood(); if ('speechSynthesis' in window) speechSynthesis.cancel(); helpDialog.showModal(); });
function closeHelp() { helpDialog.close(); focusGame(); }
$('#close-help').addEventListener('click', closeHelp); $('#lets-play').addEventListener('click', closeHelp);
helpDialog.addEventListener('click', event => { if (event.target === helpDialog) { const rect = helpDialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeHelp(); } });
helpDialog.addEventListener('close', () => { clearInput(); focusGame(); });
function changeZoom(amount) {
  zoom = Math.round(Math.max(.5, Math.min(1.7, zoom + amount)) * 10) / 10;
  $('#zoom-label').textContent = `${Math.round(zoom * 100)}%`;
  $('#zoom-out').disabled = zoom <= .5; $('#zoom-in').disabled = zoom >= 1.7; focusGame();
}
$('#zoom-in').addEventListener('click', () => changeZoom(.1)); $('#zoom-out').addEventListener('click', () => changeZoom(-.1));
$('#recenter').addEventListener('click', () => visit(LANDMARKS.find(item => item.id === 'town-square')));
canvas.addEventListener('pointerdown', event => {
  focusGame(); const scale = baseScale * zoom;
  const sx = (event.clientX - width / 2) / scale + camera.x, sy = (event.clientY - height * .46) / scale + camera.y;
  const clicked = [...players].sort((a, b) => b.x + b.y - a.x - a.y).find(player => {
    const p = project(player.x, player.y), m = getCharacterMetrics(player.number, BLOCK_SIZE);
    return Math.abs(sx - p.x) < m.visualWidth / 2 && sy < p.y + 12 - player.jump && sy > p.y - m.visualHeight - player.jump;
  });
  if (clicked && clicked !== active) selectFriend(clicked.number);
});

function update(dt) {
  const horizontal = Number(keys.has('d') || keys.has('arrowright') || touches.has('right')) - Number(keys.has('a') || keys.has('arrowleft') || touches.has('left'));
  const vertical = Number(keys.has('s') || keys.has('arrowdown') || touches.has('down')) - Number(keys.has('w') || keys.has('arrowup') || touches.has('up'));
  const movement = movementVector(horizontal, vertical, 165), before = { x: active.x, y: active.y };
  moveWithCollisions(active, movement.x * dt, movement.y * dt, obstacles, WORLD);
  active.moving = Math.hypot(active.x - before.x, active.y - before.y) > .01;
  if (horizontal) active.facing = horizontal;
  if (active.moving && time > nextFootstep) {
    nextFootstep = time + .27;
    if (!reducedMotion) particles.push({ x: active.x, y: active.y, age: 0, life: .45, kind: 'dust', angle: Math.random() * Math.PI * 2 });
    playTone(140 + active.number * 15, .045, .008, 'triangle');
  }
  blockedTime = (horizontal || vertical) && !active.moving ? blockedTime + dt : 0;
  if (blockedTime > .6 && time > nextOops) {
    nextOops = time + 10; setEmotion(active, 'surprised', 4); say(active, 'Oops! Let’s try going around.');
  }
  for (const player of players) {
    if (player.jumpVelocity || player.jump) { player.jump += player.jumpVelocity * dt; player.jumpVelocity -= 700 * dt; if (player.jump <= 0) { player.jump = 0; player.jumpVelocity = 0; } }
    if (time > player.emotionUntil) {
      const moods = ['happy', 'happy', 'curious', 'excited', 'surprised', 'sleepy'];
      setEmotion(player, moods[Math.floor(Math.random() * moods.length)], 12 + Math.random() * 13);
    }
  }
  for (let i = particles.length - 1; i >= 0; i--) { particles[i].age += dt; if (particles[i].age > particles[i].life) particles.splice(i, 1); }
  const p = project(active.x, active.y), smoothing = reducedMotion ? 1 : 1 - Math.exp(-dt * 4.5);
  camera.x += (p.x - camera.x) * smoothing; camera.y += (p.y - 100 - camera.y) * smoothing;
  const place = placeAt(active);
  $('#location-name').textContent = place?.name || (active.x > 1100 ? 'East neighborhood' : active.y > 1000 ? 'South lane' : 'Cottage lane');
  if (place?.id !== currentPlace?.id) {
    currentPlace = place;
    if (place && time - lastArrival > 10 && time > bubbles[0].until + 1) { lastArrival = time; setEmotion(active, place.id === 'library' ? 'curious' : 'happy'); remark(active, { place: place.id }); }
  }
  document.querySelectorAll('[data-place]').forEach(button => button.classList.toggle('current', button.dataset.place === place?.id));
  if (time > active.nextTalk && time > bubbles[0].until + 2) remark(active);
  if (time > nextNeighborTalk && time > bubbles[0].until + 1) {
    nextNeighborTalk = time + 9 + Math.random() * 5;
    const candidates = players.filter(player => {
      if (player === active) return false;
      const point = project(player.x, player.y), scale = baseScale * zoom;
      const x = width / 2 + (point.x - camera.x) * scale, y = height * .46 + (point.y - camera.y) * scale;
      return x > 100 && x < width - 100 && y > 210 && y < height - 210;
    });
    if (candidates.length) remark(candidates[Math.floor(Math.random() * candidates.length)]);
  }
}
function drawParticles() {
  for (const particle of particles) {
    const p = project(particle.x, particle.y), progress = particle.age / particle.life;
    ctx.save(); ctx.globalAlpha = (1 - progress) * .55;
    if (particle.kind === 'spark') {
      const x = p.x + Math.cos(particle.angle) * progress * 35, y = p.y + Math.sin(particle.angle) * progress * 15 - 6;
      ctx.strokeStyle = '#fffdf2'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y); ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 3); ctx.stroke();
    } else { ctx.fillStyle = '#faf4d5'; ctx.beginPath(); ctx.ellipse(p.x + Math.cos(particle.angle) * progress * 18, p.y - 4 - progress * 6, 3 + progress * 5, 2 + progress * 2, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
}
function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
  const scale = baseScale * zoom;
  ctx.save(); ctx.translate(width / 2, height * .46); ctx.scale(scale, scale); ctx.translate(-camera.x, -camera.y);
  drawGround(ctx, reducedMotion ? 0 : time); drawParticles();
  const renderables = townObjects.map(object => ({ depth: object.x + object.y, draw: () => object.draw(ctx, reducedMotion ? 0 : time) }));
  for (const player of players) renderables.push({ depth: player.x + player.y, draw: () => {
    const p = project(player.x, player.y);
    drawCharacter(ctx, player.number, p.x, p.y, { blockSize: BLOCK_SIZE, time: reducedMotion ? 0 : time + player.phase, moving: player.moving, facing: player.facing, jump: player.jump, selected: player === active, showNumber: true, emotion: player.emotion });
  }});
  renderables.sort((a, b) => a.depth - b.depth); for (const item of renderables) item.draw(); ctx.restore();
  for (const bubble of bubbles) {
    const player = bubble.player;
    let visible = !!player && time < bubble.until && !helpDialog.open;
    if (player && visible) {
      const p = project(player.x, player.y), m = getCharacterMetrics(player.number, BLOCK_SIZE);
      const x = width / 2 + (p.x - camera.x) * scale;
      const y = height * .46 + (p.y - camera.y - m.visualHeight - 16 - player.jump) * scale;
      visible = x > -30 && x < width + 30 && y > 85 && y < height - 180;
      const padding = Math.min(145, width / 2);
      bubble.element.style.left = `${Math.max(padding, Math.min(width - padding, x))}px`;
      bubble.element.style.top = `${Math.max(175, y)}px`;
    }
    bubble.element.classList.toggle('hidden', !visible);
  }
}
function frame(timestamp) {
  const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, .04) : 0; lastTime = timestamp;
  if (!helpDialog.open && !document.hidden) { time += dt; update(dt); }
  draw(); requestAnimationFrame(frame);
}
$('#loading').hidden = true;
requestAnimationFrame(redrawPreviews); document.fonts?.ready.then(redrawPreviews); requestAnimationFrame(frame);
