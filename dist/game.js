import * as THREE from './vendor/three.module.js';
import { CHARACTERS, getCharacterMetrics } from './character-data.js';
import { createCharacter } from './characters3d.js';
import { createTown } from './world3d.js';
import { WORLD, OBSTACLES, LANDMARKS, FRIEND_STARTS } from './world-data.js';
import { movementVector, moveWithCollisions, nearestOpenPosition, angleLerp } from './navigation.js';
import { EMOTIONS, chooseRemark } from './personalities.js';

const $ = selector => document.querySelector(selector);
const canvas = $('#world');
const help = $('#help-dialog');
const debug = new URLSearchParams(location.search).has('debug');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const errors = [];
addEventListener('error', e => errors.push(e.message));
addEventListener('unhandledrejection', e => errors.push(String(e.reason)));

let renderer;
try {
  renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:false, powerPreference:'high-performance'});
} catch (error) {
  $('#loading').hidden = true; $('#error').hidden = false; $('#error-message').textContent = `Please enable hardware acceleration and try again. ${error.message}`;
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#dcebe4');
scene.fog = new THREE.Fog('#dcebe4', 85, 180);
scene.add(new THREE.HemisphereLight('#fff8de', '#8fbd9a', 2.0));
const sunlight = new THREE.DirectionalLight('#fff1d4', 2.5);
sunlight.position.set(24, 63, 40);
sunlight.target.position.set(48, 0, 42);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(2048, 2048);
Object.assign(sunlight.shadow.camera, {left:-65,right:65,top:65,bottom:-65,near:1,far:140});
sunlight.shadow.bias = -.0003;
sunlight.shadow.normalBias = .035;
scene.add(sunlight, sunlight.target);
const fillLight = new THREE.DirectionalLight('#d8eaf5', .8); fillLight.position.set(85,25,10); scene.add(fillLight);
const town = createTown(); scene.add(town.root);

const players = CHARACTERS.map((definition,index) => {
  const model = createCharacter(definition.number);
  const metrics = getCharacterMetrics(definition.number);
  const radius = metrics.radius ?? Math.hypot(metrics.width / 2, .5) + .12;
  const start = nearestOpenPosition(FRIEND_STARTS[index], OBSTACLES, WORLD, radius);
  const player = {...definition, model, ...start, radius, jump:0, jumpVelocity:0, moving:false, emotion:'happy', moodUntil:0, lastText:'', yaw:0};
  model.root.position.set(player.x,0,player.z);
  model.root.userData.playerNumber = definition.number;
  scene.add(model.root);
  return player;
});
let active = players[10];
const camera = new THREE.PerspectiveCamera(42, 1, .1, 240);
const orbit = {yaw:.26, elevation:.64, distance:46, targetDistance:46};
const target = new THREE.Vector3(active.x, 2.1, active.z);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const projection = new THREE.Vector3();
const selectedRing = new THREE.Mesh(new THREE.RingGeometry(.88,1.02,48),new THREE.MeshBasicMaterial({color:'#fff8d0',transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false}));
selectedRing.rotation.x = -Math.PI/2; selectedRing.position.y = .16; scene.add(selectedRing);
const selectionShadow = new THREE.Mesh(new THREE.CircleGeometry(1,40),new THREE.MeshBasicMaterial({color:'#54734e',transparent:true,opacity:.12,depthWrite:false}));
selectionShadow.rotation.x=-Math.PI/2;selectionShadow.position.y=.13;scene.add(selectionShadow);

let time=0, lastTime=0, muted=true, nextRemark=9, nextNeighbor=15, currentPlace=null, audioContext;
let frameCount=0, fps=60, statsAt=0, lastJumpAt=-1, hopCount=0;
const keys = new Set(), touches = new Set(), tapUntil = new Map(), pointerPositions = new Map();
let drag=null, pinchDistance=0, suppressClick=false;
const bubbles = [{element:$('#speech'),player:active,until:0},{element:$('#neighbor-speech'),player:players[0],until:0}];

function miniSVG(definition) {
  const w=definition.width, h=definition.height;
  const cubes=definition.cells.map(cell=>`<rect x="${cell.x}" y="${h-1-cell.y}" width="1" height="1" rx=".035" fill="${cell.color}" stroke="${definition.number>=10?'#dd6d70':definition.dark}" stroke-width=".04"/>`).join('');
  const cx = definition.number===15?3.95:w/2;
  const eyeY = definition.number>=11?h-1.0:Math.min(1,h*.44);
  const eyeSize = w>1?.24:.22;
  const face=definition.number===1?`<circle cx="${cx}" cy="${eyeY-.12}" r=".29" fill="white"/><circle cx="${cx}" cy="${eyeY-.12}" r=".15" fill="#283b36"/>`:[-.31,.31].map(offset=>`<circle cx="${cx+offset}" cy="${eyeY}" r="${eyeSize}" fill="white"/><circle cx="${cx+offset+.035}" cy="${eyeY+.02}" r="${eyeSize*.52}" fill="#283b36"/>`).join('');
  return `<svg viewBox="-.2 -.1 ${w+.4} ${h+.4}" aria-hidden="true">${cubes}${face}<path d="M ${cx-.22} ${eyeY+.4} q .22 .2 .44 0" fill="none" stroke="#854352" stroke-width=".07" stroke-linecap="round"/></svg>`;
}
for(const definition of CHARACTERS){
  const button=document.createElement('button');button.type='button';button.className='friend-card';button.dataset.number=definition.number;
  button.setAttribute('aria-label',`Play as ${definition.name}, ${definition.number} blocks`);button.setAttribute('aria-pressed','false');
  button.innerHTML=`<span class="friend-number">${definition.number}</span>${definition.number>10?'<span class="new-dot" aria-hidden="true"></span>':''}<span class="mini">${miniSVG(definition)}</span><span class="friend-label">${definition.name}</span>`;
  button.addEventListener('click',()=>selectFriend(definition.number));$('#friends').append(button);
}
function focusGame(){canvas.focus({preventScroll:true});}
function selectFriend(number, initial=false){
  active=players.find(p=>p.number===number)||players[0];clearInput();
  document.querySelectorAll('.friend-card').forEach(button=>button.setAttribute('aria-pressed',String(+button.dataset.number===active.number)));
  $('#friend-name').textContent=active.name;$('#friend-description').textContent=active.description;
  $('#block-count').textContent=`${active.number} ${active.number===1?'cube':'cubes'}`;
  $('#shape-size').textContent=`${active.width} wide · ${active.height} tall`;
  // A broad character needs a slightly wider view; all cubes retain the same world size.
  orbit.targetDistance=Math.max(orbit.targetDistance,active.width>3?30:26);zoom(0);
  updateMood();currentPlace=null;updateLocation();
  bubbles[0].until=0;bubbles[1].until=0;
  if(!initial){remark(active);focusGame();}
  keepSelectedCardVisible();
}
function keepSelectedCardVisible(){
  const card=$(`.friend-card[data-number="${active.number}"]`),strip=$('#friends');if(!card)return;
  const item=card.getBoundingClientRect(),row=strip.getBoundingClientRect();
  if(item.left<row.left||item.right>row.right)strip.scrollTo({left:strip.scrollLeft+item.left-row.left-(row.width-item.width)/2,behavior:reducedMotion?'instant':'smooth'});
}
$('#previous-friend').addEventListener('click',()=>selectFriend(active.number===1?15:active.number-1));
$('#next-friend').addEventListener('click',()=>selectFriend(active.number===15?1:active.number+1));

for(const emotion of EMOTIONS){
  const button=document.createElement('button');button.type='button';button.dataset.emotion=emotion.id;
  button.setAttribute('aria-label',`Feel ${emotion.label.toLowerCase()}`);
  button.innerHTML=`<span>${emotion.icon}</span>${emotion.label}`;
  button.addEventListener('click',()=>{setEmotion(active,emotion.id,25);remark(active);closeMood();focusGame();});
  $('#emotion-options').append(button);
}
function updateMood(){
  const mood=EMOTIONS.find(m=>m.id===active.emotion)||EMOTIONS[0];$('#mood-icon').textContent=mood.icon;$('#mood-name').textContent=`Feeling ${mood.label.toLowerCase()}`;
  document.querySelectorAll('[data-emotion]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.emotion===mood.id)));
}
function setEmotion(player,emotion,seconds=16){player.emotion=emotion;player.moodUntil=time+seconds;player.model.setEmotion(emotion);if(player===active)updateMood();}
function closeMood(){$('#mood-menu').hidden=true;$('#mood-toggle').setAttribute('aria-expanded','false');}
$('#mood-toggle').addEventListener('click',()=>{const open=$('#mood-menu').hidden;$('#mood-menu').hidden=!open;$('#mood-toggle').setAttribute('aria-expanded',String(open));clearInput();});
const placeIcons={'town-square':'⌘',library:'▤',garden:'❀',pond:'≈',school:'✎'};
for(const id of ['town-square','library','garden','pond']){
  const place=LANDMARKS.find(item=>item.id===id);if(!place)continue;
  const button=document.createElement('button');button.type='button';button.dataset.place=id;button.innerHTML=`<span aria-hidden="true">${placeIcons[id]}</span>${id==='garden'?'Gardens':place.name}`;
  button.addEventListener('click',()=>visit(place));$('#destinations').append(button);
}
function walkingObstacles(player){return [...OBSTACLES,...players.filter(p=>p!==player).map(p=>({x:p.x,z:p.z,radius:p.radius+.08}))];}
function visit(place){
  clearInput();closeMood();Object.assign(active,nearestOpenPosition(place.arrival,walkingObstacles(active),WORLD,active.radius));
  active.jump=0;active.jumpVelocity=0;active.yaw=orbit.yaw;currentPlace=place;
  // Fast travel should feel immediate, without flying through buildings.
  target.set(active.x,Math.max(1.4,active.height*.45),active.z);
  setEmotion(active,place.id==='library'?'curious':'excited',14);remark(active,{place:place.id});updateLocation();focusGame();
}
function findPlace(player){return LANDMARKS.filter(place=>Math.hypot(player.x-place.x,player.z-place.z)<place.radius).sort((a,b)=>Math.hypot(player.x-a.x,player.z-a.z)-Math.hypot(player.x-b.x,player.z-b.z))[0]||null;}
function updateLocation(){
  const place=findPlace(active);
  if(place?.id!==currentPlace?.id){currentPlace=place;}
  $('#location-name').textContent=place?.name||'Neighborhood lanes';
  document.querySelectorAll('[data-place]').forEach(button=>button.classList.toggle('active',button.dataset.place===place?.id));
}
function remark(player,context={}){
  const place=findPlace(player);
  const next=chooseRemark(player.number,{emotion:player.emotion,moving:player.moving,place:place?.id,lastText:player.lastText,...context});player.lastText=next.text;
  const bubble=bubbles[player===active?0:1];bubble.player=player;bubble.until=time+5.7;
  bubble.element.replaceChildren();const name=document.createElement('span');name.className='speaker';name.textContent=player.name;bubble.element.append(name,document.createTextNode(next.text));
  if(player===active){nextRemark=time+11+Math.random()*6;speak(next.text,player);}
}
function speak(text,player){if(muted||!('speechSynthesis'in window))return;speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.rate=.95;utterance.pitch=1.05+(player.number%4)*.09;utterance.volume=.55;speechSynthesis.speak(utterance);}
function tone(){if(muted)return;try{audioContext ||= new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.frequency.setValueAtTime(490,audioContext.currentTime);oscillator.frequency.exponentialRampToValueAtTime(780,audioContext.currentTime+.13);gain.gain.setValueAtTime(.025,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.2);oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start();oscillator.stop(audioContext.currentTime+.2);}catch{}}
function jump(){if(help.open||active.jump>.01||time-lastJumpAt<.4)return;active.jumpVelocity=7.4;hopCount++;lastJumpAt=time;setEmotion(active,'excited',6);tone();}
$('#sound').addEventListener('click',()=>{muted=!muted;$('#sound').setAttribute('aria-pressed',String(!muted));$('#sound').setAttribute('aria-label',muted?'Turn voices on':'Turn voices off');$('#sound-wave').setAttribute('d',muted?'m16 9 6 6m0-6-6 6':'M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14');if(muted&&'speechSynthesis'in window)speechSynthesis.cancel();else speak(`Hello, I'm ${active.name}! Welcome to NumberTown.`,active);focusGame();});

const moves=['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'];
function clearInput(){keys.clear();touches.clear();tapUntil.clear();players.forEach(p=>p.moving=false);document.querySelectorAll('[data-move]').forEach(button=>button.classList.remove('active'));}
addEventListener('keydown',event=>{
  if(event.metaKey||event.ctrlKey||event.altKey||help.open)return;
  if(['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;
  const key=event.key.toLowerCase();
  if(moves.includes(key)){event.preventDefault();keys.add(key);if(!event.repeat)tapUntil.set(key,time+.075);closeMood();}
  if(key==='shift')keys.add('shift');
  if(event.code==='Space'&&event.target.tagName!=='BUTTON'){event.preventDefault();if(!event.repeat)jump();}
  if(!event.repeat&&/^Digit[0-9]$/.test(event.code)){
    const digit=+event.code.slice(-1);const number=event.shiftKey&&digit>=1&&digit<=5?digit+10:digit===0?10:digit;selectFriend(number);
  }
  if(!event.repeat&&key==='e'){const index=EMOTIONS.findIndex(m=>m.id===active.emotion);setEmotion(active,EMOTIONS[(index+1)%EMOTIONS.length].id,25);remark(active);}
  if(key==='q'||key==='r'){event.preventDefault();keys.add(key);if(!event.repeat)orbit.yaw+=(key==='q'?-.12:.12);}
  if(!event.repeat&&key==='c')resetCamera();
  if(!event.repeat&&(key==='+'||key==='='))zoom(-3);
  if(!event.repeat&&(key==='-'||key==='_'))zoom(3);
  if(!event.repeat&&key==='[')selectFriend(active.number===1?15:active.number-1);
  if(!event.repeat&&key===']')selectFriend(active.number===15?1:active.number+1);
  if(key==='escape')closeMood();
});
addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
addEventListener('blur',()=>{clearInput();pointerPositions.clear();drag=null;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();lastTime=0;if('speechSynthesis'in window)speechSynthesis.cancel();}});
for(const button of document.querySelectorAll('[data-move]')){
  button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);touches.add(button.dataset.move);tapUntil.set(button.dataset.move,time+.12);button.classList.add('active');});
  const release=()=>{touches.delete(button.dataset.move);button.classList.remove('active');};
  for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,release);
}
$('#touch-jump').addEventListener('pointerdown',event=>{event.preventDefault();jump();});
function isDown(...names){return names.some(name=>keys.has(name)||touches.has(name)||(tapUntil.get(name)||0)>time);}

function zoom(delta){orbit.targetDistance=THREE.MathUtils.clamp(orbit.targetDistance+delta,17,100);$('#zoom-label').textContent=`${Math.round(46/orbit.targetDistance*100)}%`;$('#zoom-in').disabled=orbit.targetDistance<=17;$('#zoom-out').disabled=orbit.targetDistance>=100;}
function resetCamera(){orbit.yaw=.26;orbit.elevation=.64;orbit.targetDistance=46;zoom(0);focusGame();}
$('#zoom-in').addEventListener('click',()=>{zoom(-4);focusGame();});$('#zoom-out').addEventListener('click',()=>{zoom(4);focusGame();});
$('#rotate-left').addEventListener('click',()=>{orbit.yaw-=Math.PI/4;focusGame();});$('#rotate-right').addEventListener('click',()=>{orbit.yaw+=Math.PI/4;focusGame();});$('#reset-camera').addEventListener('click',resetCamera);
canvas.addEventListener('wheel',event=>{event.preventDefault();zoom(Math.sign(event.deltaY)*2);},{passive:false});
canvas.addEventListener('contextmenu',event=>event.preventDefault());
canvas.addEventListener('pointerdown',event=>{
  focusGame();closeMood();canvas.setPointerCapture(event.pointerId);pointerPositions.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pointerPositions.size===1){drag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY};suppressClick=false;}
  else{const p=[...pointerPositions.values()];pinchDistance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);suppressClick=true;drag=null;}
});
canvas.addEventListener('pointermove',event=>{
  if(!pointerPositions.has(event.pointerId))return;
  pointerPositions.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pointerPositions.size===2){const p=[...pointerPositions.values()];const distance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);zoom((pinchDistance-distance)*.07);pinchDistance=distance;return;}
  if(!drag||drag.id!==event.pointerId)return;
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
  if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>4)suppressClick=true;
  orbit.yaw-=dx*.007;orbit.elevation=THREE.MathUtils.clamp(orbit.elevation+dy*.005,.26,1.25);drag.x=event.clientX;drag.y=event.clientY;
});
function pointerEnd(event){
  if(event.type==='pointerup'&&!suppressClick&&drag){
    const rect=canvas.getBoundingClientRect();ndc.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(ndc,camera);
    const hits=raycaster.intersectObjects(players.map(p=>p.model.root),true);
    if(hits.length){let object=hits[0].object;while(object&&!object.userData.playerNumber)object=object.parent;if(object)selectFriend(object.userData.playerNumber);}
  }
  pointerPositions.delete(event.pointerId);drag=null;
}
canvas.addEventListener('pointerup',pointerEnd);canvas.addEventListener('pointercancel',pointerEnd);canvas.addEventListener('lostpointercapture',pointerEnd);
$('#help').addEventListener('click',()=>{clearInput();closeMood();help.showModal();});
function closeHelp(){help.close();focusGame();}
$('#close-help').addEventListener('click',closeHelp);$('#lets-play').addEventListener('click',closeHelp);help.addEventListener('close',()=>{clearInput();focusGame();});
help.addEventListener('click',event=>{if(event.target===help){const r=help.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeHelp();}});

function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();requestAnimationFrame(keepSelectedCardVisible);}
addEventListener('resize',resize);resize();selectFriend(11,true);
function updateCamera(dt){
  if(keys.has('q'))orbit.yaw-=dt*1.25;if(keys.has('r'))orbit.yaw+=dt*1.25;
  const desired=new THREE.Vector3(active.x,Math.max(1.4,active.height*.45),active.z);
  target.lerp(desired,1-Math.exp(-dt*5));
  orbit.distance=THREE.MathUtils.lerp(orbit.distance,orbit.targetDistance,1-Math.exp(-dt*7));
  // Keep the character in the open space above the card tray, also on portrait screens.
  const distance=orbit.distance*(innerWidth<700?1.23:1);
  const horizontal=Math.cos(orbit.elevation)*distance;
  camera.position.set(target.x+Math.sin(orbit.yaw)*horizontal,target.y+Math.sin(orbit.elevation)*distance,target.z+Math.cos(orbit.yaw)*horizontal);
  camera.lookAt(target);camera.updateMatrixWorld();
  $('#compass').style.transform=`rotate(${-orbit.yaw}rad)`;
}
function updateBubbles(){
  for(const bubble of bubbles){
    const visible=time<bubble.until;
    if(visible){projection.set(bubble.player.x,bubble.player.model.root.position.y+bubble.player.height+1.7,bubble.player.z).project(camera);
      const x=(projection.x*.5+.5)*innerWidth,y=(-projection.y*.5+.5)*innerHeight;
      const inView=projection.z<1&&projection.z>-1&&x>90&&x<innerWidth-90&&y>120&&y<innerHeight-155;
      const minTop=innerHeight<520?118:innerWidth<700?285:145;
      const bubbleY=Math.max(y,minTop+bubble.element.offsetHeight);
      bubble.element.classList.toggle('hidden',!inView||bubbleY>innerHeight-145);bubble.element.style.left=`${x}px`;bubble.element.style.top=`${bubbleY}px`;
    }else bubble.element.classList.add('hidden');
  }
}
function animate(timestamp){
  requestAnimationFrame(animate);
  const dt=lastTime?Math.min((timestamp-lastTime)/1000,.05):1/60;lastTime=timestamp;if(document.hidden)return;time+=dt;
  if(!help.open){
    const horizontal=Number(isDown('d','arrowright','right'))-Number(isDown('a','arrowleft','left'));
    const vertical=Number(isDown('s','arrowdown','down'))-Number(isDown('w','arrowup','up'));
    const velocity=movementVector(horizontal,vertical,orbit.yaw,keys.has('shift')?9:6);
    const travelled=moveWithCollisions(active,velocity.x*dt,velocity.z*dt,walkingObstacles(active),WORLD);
    active.moving=travelled>.001;
    if(active.moving)active.yaw=angleLerp(active.yaw,Math.atan2(velocity.x,velocity.z),1-Math.exp(-dt*13));
    for(const player of players){
      if(player.jump>0||player.jumpVelocity>0){player.jumpVelocity-=18*dt;player.jump=Math.max(0,player.jump+player.jumpVelocity*dt);if(!player.jump)player.jumpVelocity=0;}
      player.model.root.position.set(player.x,player.jump,player.z);player.model.root.rotation.y=player.yaw;
      player.model.update(dt,{time:reducedMotion?0:time,moving:player.moving,emotion:player.emotion});
      if(player.moodUntil<time){setEmotion(player,['happy','happy','curious','excited','surprised','sleepy'][Math.floor(Math.random()*6)],18+Math.random()*19);}
    }
    if(time>nextRemark)remark(active);
    if(time>nextNeighbor){const nearby=players.filter(p=>p!==active&&Math.hypot(p.x-active.x,p.z-active.z)<22);if(nearby.length)remark(nearby[Math.floor(Math.random()*nearby.length)]);nextNeighbor=time+16+Math.random()*9;}
    town.update(reducedMotion?0:time);
  }else active.moving=false;
  updateCamera(dt);
  const radius=Math.max(.9,active.width*.57);selectedRing.scale.set(radius,radius,1);selectedRing.position.x=active.x;selectedRing.position.z=active.z;
  selectionShadow.scale.set(radius*.9,.7,1);selectionShadow.position.x=active.x;selectionShadow.position.z=active.z;
  updateBubbles();renderer.render(scene,camera);
  frameCount++;
  if(timestamp-statsAt>500){
    fps=Math.round(frameCount*1000/(timestamp-statsAt));frameCount=0;statsAt=timestamp;updateLocation();
    canvas.dataset.selected=String(active.number);canvas.dataset.ready='true';
    if(debug){$('#diagnostics').hidden=false;$('#diagnostics').textContent=JSON.stringify({renderer:'WebGL 2 · Three.js r180',fps,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,characters:players.length,hopCount:hopCount,unitCubes:CHARACTERS.reduce((sum,p)=>sum+p.cells.length,0),selected:{number:active.number,x:+active.x.toFixed(2),z:+active.z.toFixed(2),width:active.width,height:active.height,cubes:active.cells.length,mood:active.emotion,jump:+active.jump.toFixed(2)},camera:{yaw:+orbit.yaw.toFixed(2),elevation:+orbit.elevation.toFixed(2),distance:+orbit.distance.toFixed(1)},place:currentPlace?.id,errors},null,2);}
  }
}
updateCamera(1);renderer.render(scene,camera);$('#loading').hidden=true;
requestAnimationFrame(animate);
setTimeout(()=>{remark(active,{place:undefined});focusGame();},900);
