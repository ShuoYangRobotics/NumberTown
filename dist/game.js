import { CHARACTERS, drawCharacter } from './characters.js';
import { WORLD, project, obstacles, townObjects, drawGround } from './town.js';
import { movementVector, moveWithCollisions, nearestOpenPosition } from './physics.js';

const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d');
const speech = document.querySelector('#speech');
const helpDialog = document.querySelector('#help-dialog');
const keys = new Set();
const touches = new Set();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let width = innerWidth, height = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
let zoom = 1, baseScale = 1, time = 0, lastTime = 0;
let activeNumber = 1, speechUntil = 5, muted = true, audioContext;
let hopCooldown = 0, nextFootstep = 0;
let camera = { x: 0, y: 0 };
let walkingTime = 0;
const particles = [];
const starts = [WORLD.spawn, {x:460,y:565}, {x:670,y:565}, {x:380,y:715}, {x:730,y:725}];
const players = CHARACTERS.map((character, index) => ({
  ...character, ...nearestOpenPosition(starts[index], obstacles, WORLD),
  facing: 1, moving: false, jump: 0, jumpVelocity: 0, phase: index * 1.8
}));
let active = players[0];
const friendButtons = [];
const previewCanvases = [];

for (const friend of CHARACTERS) {
  const button = document.createElement('button');
  button.className = 'friend';
  button.type = 'button';
  button.setAttribute('aria-label', `Play as ${friend.name}, ${friend.number} ${friend.number === 1 ? 'block' : 'blocks'}`);
  button.setAttribute('aria-pressed', String(friend.number === activeNumber));
  button.title = `${friend.name} · press ${friend.number}`;
  button.style.setProperty('--friend-color', friend.color);
  button.style.setProperty('--friend-dark', friend.dark);
  button.style.setProperty('--friend-bg', `${friend.color}17`);
  button.style.setProperty('--friend-shadow', `${friend.color}2b`);
  const preview = document.createElement('canvas');
  preview.width = 128; preview.height = 146;
  const previewImage = document.createElement('img');
  previewImage.alt = '';
  previewImage.setAttribute('aria-hidden', 'true');
  const key = document.createElement('span'); key.className = 'friend-key'; key.textContent = friend.number;
  const name = document.createElement('span'); name.className = 'friend-name'; name.textContent = friend.name;
  const chosen = document.createElement('span'); chosen.className = 'chosen'; chosen.textContent = '✓'; chosen.setAttribute('aria-hidden', 'true');
  button.append(key, previewImage, name, chosen);
  button.addEventListener('click', () => { selectFriend(friend.number); canvas.focus({preventScroll:true}); });
  document.querySelector('#friends').append(button);
  friendButtons.push(button); previewCanvases.push({canvas:preview,image:previewImage});
}

function redrawPreviews() {
  previewCanvases.forEach(({canvas:preview,image}, index) => {
    const pctx = preview.getContext('2d');
    pctx.clearRect(0, 0, preview.width, preview.height);
    pctx.save(); pctx.scale(2,2);
    const n = index + 1;
    drawCharacter(pctx, n, 31, 67, {blockSize: Math.min(23, 53 / (n + .7)), time: 0, preview: true, selected:false, showNumber:false});
    pctx.restore();
    image.src = preview.toDataURL('image/png');
  });
}

function say(text, subtext = '') {
  speech.replaceChildren(document.createTextNode(text));
  if (subtext) { const sub = document.createElement('span'); sub.textContent = subtext; speech.append(sub); }
  speechUntil = time + 3.7;
  speech.classList.remove('hidden');
}

function selectFriend(number) {
  active.moving = false;
  activeNumber = number; active = players[number - 1];
  friendButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(index + 1 === number)));
  const messages = ["One little step at a time!", "Adventures are better with Two!", "Three cheers for exploring!", "Ready, steady… Four!", "High Five, neighbor!"];
  say(messages[number - 1], `You're playing as ${active.name}.`);
  playTone(300 + number * 85, .12, .055);
}

function resize() {
  width = innerWidth; height = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  baseScale = Math.max(.48, Math.min(width / 1850, (height - 180) / 1000));
  redrawPreviews();
}
addEventListener('resize', resize);
resize();
const initialPosition = project(active.x, active.y);
camera = {x: initialPosition.x, y: initialPosition.y - 100};

function playTone(frequency, duration = .12, gain = .035, type = 'sine') {
  if (muted) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * .75, audioContext.currentTime + duration);
    envelope.gain.setValueAtTime(gain, audioContext.currentTime);
    envelope.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(envelope); envelope.connect(audioContext.destination);
    oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
  } catch { /* Audio is optional; movement always remains available. */ }
}

function jump() {
  if (helpDialog.open || active.jump > 0 || time < hopCooldown) return;
  active.jumpVelocity = 260; hopCooldown = time + .5;
  playTone(480, .22, .04, 'sine');
  for (let i=0;i<5;i++) particles.push({x:active.x,y:active.y,age:0,life:.6,angle:i * Math.PI * 2/5,kind:'spark'});
}

const movementKeys = ['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'];
addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (helpDialog.open) return;
  if (movementKeys.includes(key) || event.code === 'Space') {
    if (event.code === 'Space' && document.activeElement?.tagName === 'BUTTON') return;
    event.preventDefault();
    if (event.code === 'Space') { if (!event.repeat) jump(); }
    else keys.add(key);
  }
  if (/^[1-5]$/.test(key) && !event.repeat) selectFriend(Number(key));
});
addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
function clearInput() { keys.clear(); touches.clear(); document.querySelectorAll('.dpad .active').forEach(button => button.classList.remove('active')); }
addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); lastTime = 0; } });

document.querySelectorAll('[data-move]').forEach(button => {
  button.addEventListener('pointerdown', event => {
    event.preventDefault(); button.setPointerCapture(event.pointerId);
    touches.add(button.dataset.move); button.classList.add('active');
  });
  const release = () => { touches.delete(button.dataset.move); button.classList.remove('active'); };
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
});
document.querySelector('#touch-jump').addEventListener('pointerdown', event => { event.preventDefault(); jump(); });
document.querySelector('#sound').addEventListener('click', event => {
  muted = !muted;
  const button = event.currentTarget;
  button.setAttribute('aria-pressed', String(!muted));
  button.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
  button.title = muted ? 'Turn sound on' : 'Turn sound off';
  playTone(660,.18,.045);
  canvas.focus({preventScroll:true});
});
document.querySelector('#help').addEventListener('click', () => { clearInput(); helpDialog.showModal(); });
function closeHelp() { helpDialog.close(); canvas.focus({preventScroll:true}); }
document.querySelector('#close-help').addEventListener('click', closeHelp);
document.querySelector('#lets-play').addEventListener('click', closeHelp);
helpDialog.addEventListener('click', event => { if (event.target === helpDialog) { const rect = helpDialog.getBoundingClientRect(); if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) closeHelp(); } });
helpDialog.addEventListener('close', () => { clearInput(); canvas.focus({preventScroll:true}); });

function changeZoom(amount) {
  zoom = Math.round(Math.max(.7, Math.min(1.7, zoom + amount)) * 10) / 10;
  document.querySelector('#zoom-label').textContent = `${Math.round(zoom*100)}%`;
  document.querySelector('#zoom-out').disabled = zoom <= .7;
  document.querySelector('#zoom-in').disabled = zoom >= 1.7;
  canvas.focus({preventScroll:true});
}
document.querySelector('#zoom-in').addEventListener('click', () => changeZoom(.1));
document.querySelector('#zoom-out').addEventListener('click', () => changeZoom(-.1));
document.querySelector('#recenter').addEventListener('click', () => {
  Object.assign(active, nearestOpenPosition(WORLD.spawn, obstacles, WORLD), {jump:0,jumpVelocity:0});
  changeZoom(1-zoom); clearInput(); say('Home sweet town.', 'A new adventure starts here.');
});

canvas.addEventListener('pointerdown', event => {
  canvas.focus({preventScroll:true});
  const scale = baseScale * zoom;
  const sx = (event.clientX-width/2)/scale+camera.x;
  const sy = (event.clientY-height*.46)/scale+camera.y;
  const clicked = [...players].reverse().find(player => {
    const p = project(player.x,player.y);
    return Math.abs(sx-p.x)<32 && sy<p.y+12 && sy>p.y-player.number*32-35;
  });
  if (clicked && clicked.number !== activeNumber) selectFriend(clicked.number);
});

function update(dt) {
  if (helpDialog.open) return;
  const horizontal = Number(keys.has('d') || keys.has('arrowright') || touches.has('right')) - Number(keys.has('a') || keys.has('arrowleft') || touches.has('left'));
  const vertical = Number(keys.has('s') || keys.has('arrowdown') || touches.has('down')) - Number(keys.has('w') || keys.has('arrowup') || touches.has('up'));
  const movement = movementVector(horizontal, vertical, 150);
  const beforeX = active.x, beforeY = active.y;
  moveWithCollisions(active,movement.x*dt,movement.y*dt,obstacles,WORLD);
  active.moving = Math.hypot(active.x-beforeX,active.y-beforeY)>.01;
  if (horizontal) active.facing = horizontal;
  if (active.moving) {
    walkingTime += dt;
    if(time>nextFootstep) {
      nextFootstep=time+.27;
      if(!reducedMotion) particles.push({x:active.x,y:active.y,age:0,life:.45,kind:'dust',angle:Math.random()*Math.PI*2});
      playTone(140+active.number*15,.045,.012,'triangle');
    }
    if(walkingTime>3) speechUntil=Math.min(speechUntil,time);
  }
  for(const player of players) {
    if (player.jumpVelocity || player.jump) {
      player.jump += player.jumpVelocity*dt;
      player.jumpVelocity -= 700*dt;
      if(player.jump<=0){player.jump=0;player.jumpVelocity=0;}
    }
  }
  for(let i=particles.length-1;i>=0;i--){particles[i].age+=dt;if(particles[i].age>particles[i].life)particles.splice(i,1);}
  const p = project(active.x,active.y);
  const smoothing = reducedMotion ? 1 : 1-Math.exp(-dt*4.5);
  camera.x += (p.x-camera.x)*smoothing;
  camera.y += (p.y-100-camera.y)*smoothing;
  const location = active.y<350 ? 'Cottage lane' : active.x>780 ? 'The little park' : active.x<300 ? 'Garden corner' : 'Town square';
  document.querySelector('#location-name').textContent=location;
}

function drawParticles() {
  for(const particle of particles){
    const p=project(particle.x,particle.y), progress=particle.age/particle.life;
    ctx.save();ctx.globalAlpha=(1-progress)*.55;
    if(particle.kind==='spark'){
      const x=p.x+Math.cos(particle.angle)*progress*35,y=p.y+Math.sin(particle.angle)*progress*15-6;
      ctx.strokeStyle='#fffdf2';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(x-3,y);ctx.lineTo(x+3,y);ctx.moveTo(x,y-3);ctx.lineTo(x,y+3);ctx.stroke();
    }else{ctx.fillStyle='#faf4d5';ctx.beginPath();ctx.ellipse(p.x+Math.cos(particle.angle)*progress*18,p.y-4-progress*6,3+progress*5,2+progress*2,0,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
}

function draw() {
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  const scale=baseScale*zoom;
  ctx.save();ctx.translate(width/2,height*.46);ctx.scale(scale,scale);ctx.translate(-camera.x,-camera.y);
  drawGround(ctx,reducedMotion?0:time);
  drawParticles();
  const renderables=townObjects.map(object=>({depth:object.x+object.y,draw:()=>object.draw(ctx,reducedMotion?0:time)}));
  for(const player of players) {
    renderables.push({depth:player.x+player.y,draw:()=>{
      const p=project(player.x,player.y);
      drawCharacter(ctx,player.number,p.x,p.y,{blockSize:32,time:reducedMotion?0:time+player.phase,moving:player.moving,facing:player.facing,jump:player.jump,selected:player.number===activeNumber,showNumber:true});
    }});
  }
  renderables.sort((a,b)=>a.depth-b.depth);
  for(const item of renderables)item.draw();
  ctx.restore();
  const p=project(active.x,active.y);
  speech.style.left=`${Math.max(120,Math.min(width-120,width/2+(p.x-camera.x)*scale))}px`;
  speech.style.top=`${height*.46+(p.y-camera.y-active.number*32-52-active.jump)*scale}px`;
  speech.classList.toggle('hidden',time>speechUntil || helpDialog.open);
}

function frame(timestamp) {
  const dt=lastTime?Math.min((timestamp-lastTime)/1000,.04):0;
  lastTime=timestamp;time+=dt;
  update(dt);draw();requestAnimationFrame(frame);
}
document.querySelector('#loading').hidden=true;
requestAnimationFrame(redrawPreviews);
document.fonts?.ready.then(redrawPreviews);
requestAnimationFrame(frame);
