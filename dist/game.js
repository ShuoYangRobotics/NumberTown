import * as THREE from './vendor/three.module.js';
import { CHARACTERS, getCharacterMetrics } from './character-data.js';
import { createCharacter, getCharacterFaceLayout } from './characters3d.js';
import { createTown } from './world3d.js';
import { WORLD, OBSTACLES, LANDMARKS, FRIEND_STARTS, BUILDINGS } from './world-data.js';
import { movementVector, moveWithCollisions, nearestOpenPosition, angleLerp, collides } from './navigation.js';
import { EMOTIONS, chooseRemark } from './personalities.js';
import { createRoamingController } from './roaming.js';
import { toSpokenMath } from './speech.js';
import { mountCharacterShortcut } from './character-shortcut.js';

import { createLandscape } from './terrain.js';
import { groundHeight, HILL_LANDMARK, LOOKOUT_LANDMARK, BRIDGE_LANDMARKS, BEACH_LANDMARK, MOUNTAIN_LANDMARK, TERRAIN_OBSTACLES } from './terrain-data.js';
import { createPark, PARK_LANDMARK, PARK_OBSTACLES } from './park.js';
import { createFootball, createBallState, stepBall, kickBall, updateBallContact, resetBall, FOOTBALL_LANDMARK, FOOTBALL_OBSTACLES } from './football.js';
import { BRIDGES, RIVER, COAST, riverX } from './geography.js';
import { mountTownMap } from './town-map.js';
import { SUMMIT, SUMMIT_DECK, MOUNTAIN_TRAIL, MOUNTAIN_TRAIL_LANDMARK, SUMMIT_LANDMARK, mountainHeight, isOnMountainRoute, nearestTrailPoint, mountainProgress } from './mountain-route.js';

const ALL_OBSTACLES=[...OBSTACLES,...PARK_OBSTACLES,...FOOTBALL_OBSTACLES,...TERRAIN_OBSTACLES];
const ALL_PLACES=[...LANDMARKS,PARK_LANDMARK,FOOTBALL_LANDMARK,HILL_LANDMARK,LOOKOUT_LANDMARK,...BRIDGE_LANDMARKS,BEACH_LANDMARK,MOUNTAIN_LANDMARK,MOUNTAIN_TRAIL_LANDMARK,SUMMIT_LANDMARK];
const roaming=createRoamingController({obstacles:ALL_OBSTACLES,world:WORLD,destinations:ALL_PLACES.filter(p=>!['hill','lookout','summit','mountain-trail','mountains'].includes(p.id))});
const BRIDGE_IDS=new Set(BRIDGE_LANDMARKS.map(p=>p.id));
const townCounts={westHouses:BUILDINGS.filter(b=>b.kind==='house'&&b.bank==='west').length,eastHouses:BUILDINGS.filter(b=>b.kind==='house'&&b.bank==='east').length,houses:BUILDINGS.filter(b=>b.kind==='house').length,stores:BUILDINGS.filter(b=>['shop','bakery','cafe'].includes(b.kind)).length};
const $ = selector => document.querySelector(selector);
const canvas = $('#world');
const help = $('#help-dialog'), mapDialog=$('#map-dialog');
const modalOpen=()=>help.open||mapDialog.open;
const debug = new URLSearchParams(location.search).get('debug')==='1';
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
scene.background = new THREE.Color('#dcecf0');
scene.fog = new THREE.Fog('#dcecf0', 260, 800);
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
const town = createTown(), landscape=createLandscape(), park=createPark(), football=createFootball(), ballState=createBallState();
scene.add(town.root,landscape.root,park.root,football.root);
football.update(ballState,0);

const players = CHARACTERS.map((definition,index) => {
  const model = createCharacter(definition.number);
  const metrics = getCharacterMetrics(definition.number);
  const radius = metrics.radius ?? Math.hypot(metrics.width / 2, .5) + .12;
  const start = nearestOpenPosition(FRIEND_STARTS[index], ALL_OBSTACLES, WORLD, radius);
  const player = {...definition, model, ...start, radius, jump:0, jumpVelocity:0, moving:false, emotion:'happy', moodUntil:0, lastText:'', lastRemarkKind:'', yaw:0};
  model.root.position.set(player.x,groundHeight(player.x,player.z),player.z);
  model.root.userData.playerNumber = definition.number;
  scene.add(model.root);
  return player;
});
let active = players[20];
const camera = new THREE.PerspectiveCamera(42, 1, .3, 1300);
const orbit = {yaw:.26, elevation:.64, distance:76, targetDistance:76};
const target = new THREE.Vector3(active.x, 2.1, active.z);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const projection = new THREE.Vector3();
const selectedRing = new THREE.Mesh(new THREE.RingGeometry(.88,1.02,48),new THREE.MeshBasicMaterial({color:'#fff8d0',transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false}));
selectedRing.rotation.x = -Math.PI/2; selectedRing.position.y = .16; scene.add(selectedRing);
const selectionShadow = new THREE.Mesh(new THREE.CircleGeometry(1,40),new THREE.MeshBasicMaterial({color:'#54734e',transparent:true,opacity:.12,depthWrite:false}));
selectionShadow.rotation.x=-Math.PI/2;selectionShadow.position.y=.13;scene.add(selectionShadow);

let time=0, lastTime=0, muted=true, nextRemark=9, currentPlace=null, audioContext;
let frameCount=0, fps=60, statsAt=0, lastJumpAt=-1, hopCount=0, kickCount=0, activityUntil=0, activityMessage='';
let guidedWalk=null,trailNoticeUntil=0;
const keys = new Set(), touches = new Set(), tapUntil = new Map(), pointerPositions = new Map();
let drag=null, pinchDistance=0, suppressClick=false;
const bubbles = [{element:$('#speech'),player:active,until:0}];
let voiceUtterance=null;
const voiceState={text:'',number:null,playing:false};

function miniSVG(definition) {
  const w=definition.width, h=definition.height;
  const cubes=definition.cells.map(cell=>`<rect x="${cell.x}" y="${h-1-cell.y}" width="1" height="1" rx=".035" fill="${cell.color}" stroke="${cell.outline||definition.dark}" stroke-width=".04"/>`).join('');
  const faceLayout=getCharacterFaceLayout(definition.number),cx=w/2+faceLayout.x;
  const eyeY=h+.35-faceLayout.eyeY,mouthY=h+.35-faceLayout.mouthY,eyeSize=faceLayout.size*1.1;
  const eyes=definition.number===1?[0]:[-faceLayout.gap,faceLayout.gap];
  const face=eyes.map(offset=>`<circle cx="${cx+offset}" cy="${eyeY}" r="${eyeSize}" fill="white" stroke="${definition.dark}" stroke-width=".05"/><circle cx="${cx+offset+.035}" cy="${eyeY+.02}" r="${eyeSize*.52}" fill="#283b36"/>`).join('');
  return `<svg viewBox="-.2 -.1 ${w+.4} ${h+.4}" aria-hidden="true">${cubes}${face}<path d="M ${cx-.22} ${mouthY} q .22 .2 .44 0" fill="none" stroke="#854352" stroke-width=".07" stroke-linecap="round"/></svg>`;
}
for(const definition of CHARACTERS){
  const button=document.createElement('button');button.type='button';button.className=definition.number>20?'friend-card long-name':'friend-card';button.dataset.number=definition.number;
  button.title=`${definition.name} · ${definition.number} blocks`;
  button.setAttribute('aria-label',`Play as ${definition.name}, ${definition.number} blocks`);button.setAttribute('aria-pressed','false');
  button.innerHTML=`<span class="friend-number">${definition.number}</span>${definition.number>20?'<span class="new-dot" aria-hidden="true"></span>':''}<span class="mini">${miniSVG(definition)}</span><span class="friend-label">${definition.name}</span>`;
  button.addEventListener('click',()=>selectFriend(definition.number));$('#friends').append(button);
}
function focusGame(){canvas.focus({preventScroll:true});}
function selectFriend(number, initial=false){
  cancelVoice();active=players.find(p=>p.number===number)||players[0];clearInput();roaming.pause(active,time);active.yaw=orbit.yaw;
  document.querySelectorAll('.friend-card').forEach(button=>button.setAttribute('aria-pressed',String(+button.dataset.number===active.number)));
  $('#friend-name').textContent=active.name;$('#friend-description').textContent=active.description;
  $('#block-count').textContent=`${active.number} ${active.number===1?'cube':'cubes'}`;
  $('#shape-size').textContent=`${active.width} wide · ${active.height} tall`;
  // A broad character needs a slightly wider view; all cubes retain the same world size.
  orbit.targetDistance=Math.max(orbit.targetDistance,active.width>3?30:26);zoom(0);
  updateMood();currentPlace=null;updateLocation();
  bubbles[0].until=0;$('#inspect-backpack').hidden=active.number!==21;updateBackpackButton();
  if(!initial){remark(active,{math:true});focusGame();}
  keepSelectedCardVisible();
}
function keepSelectedCardVisible(){
  const card=$(`.friend-card[data-number="${active.number}"]`),strip=$('#friends');if(!card)return;
  const item=card.getBoundingClientRect(),row=strip.getBoundingClientRect();
  if(item.left<row.left||item.right>row.right||active.number>20)strip.scrollTo({left:strip.scrollLeft+item.left-row.left-(row.width-item.width)/2,behavior:reducedMotion?'instant':'smooth'});
}
$('#previous-friend').addEventListener('click',()=>selectFriend(active.number===1?players.length:active.number-1));
$('#next-friend').addEventListener('click',()=>selectFriend(active.number===players.length?1:active.number+1));

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
const placeIcons={'town-square':'⌘',pond:'≈',park:'☼',football:'⚽',hill:'△',river:'≋',beach:'☀','mountain-trail':'♧'};
for(const id of ['town-square','pond','park','football','hill','river','beach','mountain-trail']){
  const place=ALL_PLACES.find(item=>item.id===id);if(!place)continue;
  const button=document.createElement('button');button.type='button';button.dataset.place=id;button.innerHTML=`<span aria-hidden="true">${placeIcons[id]}</span>${id==='river'?'River':id==='mountains'?'Mountains':place.name}`;
  button.addEventListener('click',()=>visit(place));$('#destinations').append(button);
}
function walkingObstacles(player){return [...ALL_OBSTACLES,...players.filter(p=>p!==player).map(p=>({x:p.x,z:p.z,radius:p.radius+.08}))];}
function visit(place){
  clearInput();closeMood();
  const obstacles=walkingObstacles(active);
  const arrival=place.id==='mountain-trail'?(MOUNTAIN_TRAIL.find(p=>!collides(p.x,p.z,obstacles,WORLD,active.radius))||place.arrival):place.arrival;
  Object.assign(active,nearestOpenPosition({x:arrival.x,z:arrival.z},obstacles,WORLD,active.radius));
  roaming.pause(active,time);active.jump=0;active.jumpVelocity=0;currentPlace=place;
  const presets={
    'town-square':[.3,.64,76],pond:[.28,.68,90],park:[0,.48,115],football:[0,.64,70],
    hill:[Math.PI,.64,72],beach:[Math.PI,.45,100],mountains:[0,.43,180],
    'mountain-trail':[.25,.59,180],summit:[Math.PI,.5,100],
  };
  const preset=presets[place.id]||(BRIDGE_IDS.has(place.id)?[0,.64,100]:[.26,.64,55]);
  [orbit.yaw,orbit.elevation,orbit.targetDistance]=preset;zoom(0);
  active.yaw=place.id==='football'?Math.PI:orbit.yaw;
  active.model.root.position.set(active.x,groundHeight(active.x,active.z),active.z);
  // Fast travel should feel immediate, without flying through buildings.
  target.set(active.x,groundHeight(active.x,active.z)+Math.max(1.4,active.height*.45),active.z);
  setEmotion(active,place.id==='library'?'curious':'excited',14);remark(active,{place:BRIDGE_IDS.has(place.id)?'river':place.id});updateLocation();focusGame();
}
function findPlace(player){
  if(isOnMountainRoute(player.x,player.z)){
    if(Math.abs(player.x-SUMMIT_DECK.x)<=SUMMIT_DECK.width/2&&Math.abs(player.z-SUMMIT_DECK.z)<=SUMMIT_DECK.depth/2)return SUMMIT_LANDMARK;
    return MOUNTAIN_TRAIL_LANDMARK;
  }
  return ALL_PLACES.filter(place=>!['mountain-trail','summit'].includes(place.id)&&Math.hypot(player.x-place.x,player.z-place.z)<place.radius).sort((a,b)=>Math.hypot(player.x-a.x,player.z-a.z)-Math.hypot(player.x-b.x,player.z-b.z))[0]||null;
}
function updateLocation(){
  const place=findPlace(active);
  if(place?.id!==currentPlace?.id){currentPlace=place;}
  $('#location-name').textContent=place?.name||'Neighborhood lanes';
  $('#bank-name').textContent=['mountain-trail','summit'].includes(place?.id)?'Northern range':active.x<riverX(active.z)?'West bank':'East bank';
  document.querySelectorAll('[data-place]').forEach(button=>button.classList.toggle('active',button.dataset.place===place?.id||(button.dataset.place==='river'&&BRIDGE_IDS.has(place?.id))||(button.dataset.place==='mountain-trail'&&place?.id==='summit')));
  updateActivity(place);if(mapDialog.open)townMap.update(active);
}
function remark(player,context={}){
  // Only the friend under the user's control speaks; wandering friends stay quiet.
  if(player!==active)return;
  const next=chooseRemark(player.number,{emotion:player.emotion,lastText:player.lastText,...context,math:true});
  player.lastText=next.text;player.lastRemarkKind='math';
  const bubble=bubbles[0];bubble.player=player;bubble.until=time+6.5;
  bubble.element.replaceChildren();const name=document.createElement('span');name.className='speaker';name.textContent=`${player.name} · number facts`;
  bubble.element.append(name,document.createTextNode(next.text));bubble.element.dataset.spoken=toSpokenMath(next.text);
  nextRemark=time+12+Math.random()*6;speak(next.text,player);
}
$('#math-fact').addEventListener('click',()=>{remark(active);focusGame();});
function cancelVoice(){
  voiceUtterance=null;voiceState.playing=false;
  if('speechSynthesis'in window)speechSynthesis.cancel();
}
function speak(text,player){
  if(player!==active||muted||!('speechSynthesis'in window))return;
  cancelVoice();
  const utterance=new SpeechSynthesisUtterance(toSpokenMath(text));voiceUtterance=utterance;
  utterance.lang='en-US';utterance.rate=.95;utterance.pitch=1.05+(player.number%4)*.09;utterance.volume=.55;
  Object.assign(voiceState,{text:utterance.text,number:player.number,playing:false});
  utterance.onstart=()=>{if(voiceUtterance===utterance)voiceState.playing=true;};
  const finished=()=>{if(voiceUtterance===utterance){voiceUtterance=null;voiceState.playing=false;}};
  utterance.onend=finished;utterance.onerror=finished;speechSynthesis.speak(utterance);
}
function updateBackpackButton(){
  const rear=Math.cos(orbit.yaw-active.yaw)<0;
  $('#inspect-backpack').textContent=rear?'↶ View face':'↶ View backpack';
  $('#inspect-backpack').setAttribute('aria-label',rear?"View Twenty-One's face":"View Twenty-One's backpack");
}
$('#inspect-backpack').addEventListener('click',()=>{
  if(active.number!==21)return;
  if(guidedWalk)guidedWalk.autoCamera=false;
  const rear=Math.cos(orbit.yaw-active.yaw)<0;
  orbit.yaw=active.yaw+(rear?.3:Math.PI+.38);orbit.elevation=.34;orbit.targetDistance=25;
  zoom(0);updateBackpackButton();focusGame();
});
function tone(){if(muted)return;try{audioContext ||= new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.frequency.setValueAtTime(490,audioContext.currentTime);oscillator.frequency.exponentialRampToValueAtTime(780,audioContext.currentTime+.13);gain.gain.setValueAtTime(.025,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.2);oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start();oscillator.stop(audioContext.currentTime+.2);}catch{}}
function jump(){if(modalOpen()||active.jump>.01||time-lastJumpAt<.4)return;active.jumpVelocity=7.4;hopCount++;lastJumpAt=time;setEmotion(active,'excited',6);tone();}
$('#sound').addEventListener('click',()=>{muted=!muted;$('#sound').setAttribute('aria-pressed',String(!muted));$('#sound').setAttribute('aria-label',muted?'Turn voices on':'Turn voices off');$('#sound-wave').setAttribute('d',muted?'m16 9 6 6m0-6-6 6':'M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14');if(muted)cancelVoice();else remark(active);focusGame();});

const moves=['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'];
function clearInput(){guidedWalk=null;keys.clear();touches.clear();tapUntil.clear();players.forEach(p=>p.moving=false);document.querySelectorAll('[data-move]').forEach(button=>button.classList.remove('active'));}
addEventListener('keydown',event=>{
  if(event.metaKey||event.ctrlKey||event.altKey)return;
  if(['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)||event.target.isContentEditable)return;
  const key=event.key.toLowerCase();
  if(!event.repeat&&key==='m'&&!help.open){event.preventDefault();if(mapDialog.open)mapDialog.close();else openMap();return;}
  if(modalOpen())return;
  if(moves.includes(key)){event.preventDefault();keys.add(key);if(!event.repeat)tapUntil.set(key,time+.075);closeMood();}
  if(key==='shift')keys.add('shift');
  if(event.code==='Space'&&event.target.tagName!=='BUTTON'){event.preventDefault();if(!event.repeat)jump();}
  if(!event.repeat&&/^Digit[0-9]$/.test(event.code)){
    const digit=+event.code.slice(-1);const number=event.shiftKey?(digit===0?20:digit+10):(digit===0?10:digit);selectFriend(number);
  }
  if(!event.repeat&&key==='k'){remark(active,{math:true});}
  if(!event.repeat&&key==='e'){const index=EMOTIONS.findIndex(m=>m.id===active.emotion);setEmotion(active,EMOTIONS[(index+1)%EMOTIONS.length].id,25);remark(active);}
  if(key==='q'||key==='r'){event.preventDefault();if(guidedWalk)guidedWalk.autoCamera=false;keys.add(key);if(!event.repeat)orbit.yaw+=(key==='q'?-.12:.12);}
  if(!event.repeat&&key==='c')resetCamera();
  if(!event.repeat&&key==='f'){event.preventDefault();kick();}
  if(!event.repeat&&(key==='+'||key==='='))zoom(-3);
  if(!event.repeat&&(key==='-'||key==='_'))zoom(3);
  if(!event.repeat&&key==='[')selectFriend(active.number===1?players.length:active.number-1);
  if(!event.repeat&&key===']')selectFriend(active.number===players.length?1:active.number+1);
  if(key==='escape')closeMood();
});
mountCharacterShortcut({
  canvas,input:$('#jump-number'),button:$('#jump-to-friend'),status:$('#jump-status'),
  maxNumber:players.length,onSelect:selectFriend,
  onBegin:()=>{clearInput();closeMood();},isBlocked:modalOpen,focusGame,
});
addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
addEventListener('blur',()=>{clearInput();pointerPositions.clear();drag=null;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();lastTime=0;cancelVoice();}});
for(const button of document.querySelectorAll('[data-move]')){
  button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);touches.add(button.dataset.move);tapUntil.set(button.dataset.move,time+.12);button.classList.add('active');});
  const release=()=>{touches.delete(button.dataset.move);button.classList.remove('active');};
  for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,release);
}
$('#touch-jump').addEventListener('pointerdown',event=>{event.preventDefault();jump();});
function isDown(...names){return names.some(name=>keys.has(name)||touches.has(name)||(tapUntil.get(name)||0)>time);}

function zoom(delta){orbit.targetDistance=THREE.MathUtils.clamp(orbit.targetDistance+delta,17,330);$('#zoom-label').textContent=`${Math.round(46/orbit.targetDistance*100)}%`;$('#zoom-in').disabled=orbit.targetDistance<=17;$('#zoom-out').disabled=orbit.targetDistance>=330;}
function resetCamera(){if(guidedWalk)guidedWalk.autoCamera=false;orbit.yaw=.26;orbit.elevation=.64;orbit.targetDistance=76;zoom(0);focusGame();}
$('#zoom-in').addEventListener('click',()=>{zoom(-4);focusGame();});$('#zoom-out').addEventListener('click',()=>{zoom(4);focusGame();});
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
  if(guidedWalk)guidedWalk.autoCamera=false;
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

const townMap=mountTownMap($('#map-content'),ALL_PLACES,place=>{mapDialog.close();visit(place);});
function openMap(){clearInput();closeMood();townMap.update(active);mapDialog.showModal();}
$('#open-map').addEventListener('click',openMap);
$('#close-map').addEventListener('click',()=>mapDialog.close());
mapDialog.addEventListener('close',()=>{clearInput();focusGame();});
mapDialog.addEventListener('click',event=>{if(event.target===mapDialog){const r=mapDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)mapDialog.close();}});
function kick(){
  if(modalOpen()||active.jump>.3)return;
  if(kickBall(ballState,active)){kickCount++;tone();activityMessage='Nice kick! Follow the ball for another pass.';activityUntil=time+2.5;}
  else{activityMessage='Walk closer to the ball, then press F to kick.';activityUntil=time+2.5;}
  updateActivity(findPlace(active));focusGame();
}
$('#kick-ball').addEventListener('click',kick);
$('#reset-ball').addEventListener('click',()=>{resetBall(ballState);activityMessage='Ball back at the center. Ready to play!';activityUntil=time+3;updateActivity(findPlace(active));focusGame();});
$('#view-sea').addEventListener('click',()=>{if(guidedWalk)guidedWalk.autoCamera=false;orbit.yaw=Math.PI;orbit.elevation=.35;orbit.targetDistance=currentPlace?.id==='summit'?210:95;zoom(0);focusGame();});
$('#view-town').addEventListener('click',()=>{if(guidedWalk)guidedWalk.autoCamera=false;orbit.yaw=currentPlace?.id==='summit'?Math.PI:0;orbit.elevation=.44;orbit.targetDistance=currentPlace?.id==='summit'?140:100;zoom(0);focusGame();});
function followTrail(direction){
  if(guidedWalk){guidedWalk=null;updateActivity(findPlace(active));focusGame();return;}
  clearInput();
  const nearest=nearestTrailPoint(active.x,active.z);
  guidedWalk={direction,autoCamera:true,index:Math.max(0,Math.min(MOUNTAIN_TRAIL.length-1,nearest.index+(direction>0?1:0))),stalled:0};
  orbit.targetDistance=58;orbit.elevation=.57;zoom(0);updateActivity(findPlace(active));focusGame();
}
$('#follow-trail').addEventListener('click',()=>followTrail(1));
$('#descend-trail').addEventListener('click',()=>followTrail(-1));
function updateActivity(place){
  const id=place?.id,isFootball=id==='football',isLookout=id==='lookout'||id==='summit',isTrail=id==='mountain-trail'||id==='summit';
  $('#activity').hidden=!['park','football','hill','lookout','beach','mountains','town-square','pond','mountain-trail','summit'].includes(id)&&!BRIDGE_IDS.has(id);
  $('#football-actions').hidden=!isFootball;$('#lookout-actions').hidden=!isLookout;
  $('#trail-actions').hidden=!isTrail;$('#trail-progress').hidden=!isTrail;
  $('#trail-progress').value=isTrail?mountainProgress(active.x,active.z)*100:0;
  $('#follow-trail').hidden=id==='summit'&&!guidedWalk;$('#follow-trail').textContent=guidedWalk?'Pause walk':'Follow trail';
  $('#descend-trail').hidden=!!guidedWalk||!isTrail||mountainProgress(active.x,active.z)<.02;
  let title='',detail='';
  if(isFootball){title=`Football · ${ballState.goals} ${ballState.goals===1?'goal':'goals'}`;detail=time<activityUntil?activityMessage:'Walk into the ball to dribble · F to kick in your walking direction';}
  if(id==='park'){title='Wheel Park · 18 cabins';detail='Count the colorful cabins as they turn. Take a stroll through the park.';}
  if(id==='hill'){title=`Sunny Hill · ${Math.round(groundHeight(active.x,active.z))} / 12 m`;detail='Follow the cream trail up to the scenic deck. WASD to climb.';}
  if(isLookout){title='You made it! · Scenic deck';detail='A long beach and open sea to the south. Drag to enjoy the view.';}
  if(BRIDGE_IDS.has(id)){title=place.name;detail='Follow the river from the mountains to the sea. Three bridges join the banks.';}
  if(id==='beach'){title='Long Beach · Southern Sea';detail='Take a walk along the sand. The river meets the sea just along the shore.';}
  if(id==='mountains'){title='The northern mountains';detail='A paved path winds around one peak. Visit Mountain trail to begin the climb.';}
  if(id==='mountain-trail'){title=`Summit Walk · ${Math.round(groundHeight(active.x,active.z))} / ${SUMMIT_DECK.height} m`;detail=time<trailNoticeUntil?'A friend is on the path. Use WASD to walk around them.':guidedWalk?'Enjoy the climb. WASD takes over whenever you like.':'Follow the paved bends with WASD, or take a guided walk to the top.';}
  if(id==='summit'){title=`You made it! · ${SUMMIT_DECK.height} m summit deck`;detail='Look across NumberTown, the river, and the sea. Drag to enjoy the panorama.';}
  if(id==='town-square'){title="Cube Square · Rubik’s cube statue";detail='A big colorful cube, and a larger square for all twenty-five friends.';}
  if(id==='pond'){title='The big duck pond';detail='Follow the shore and say hello to the ducks.';}

  $('#activity-title').textContent=title;$('#activity-detail').textContent=detail;
}

function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();requestAnimationFrame(keepSelectedCardVisible);}
addEventListener('resize',resize);resize();selectFriend(21,true);
function updateCamera(dt){
  if(keys.has('q'))orbit.yaw-=dt*1.25;if(keys.has('r'))orbit.yaw+=dt*1.25;
  const desired=new THREE.Vector3(active.x,groundHeight(active.x,active.z)+Math.max(1.4,active.height*.45),active.z);
  // Lift scenic framing above the visitor so tall landmarks clear the toolbar.
  if(currentPlace?.id==='town-square'&&orbit.targetDistance>=55){desired.y+=4;desired.z-=4;}
  if(currentPlace?.id==='park'&&orbit.targetDistance>=80){desired.y+=11;desired.z-=15;}
  if(BRIDGE_IDS.has(currentPlace?.id)&&orbit.targetDistance>=80){desired.x+=14;desired.y+=2;}
  if(currentPlace?.id==='beach'&&orbit.targetDistance>=80){desired.z+=15;desired.y+=3;}
  if(currentPlace?.id==='mountains'&&orbit.targetDistance>=80){desired.z-=10;desired.y+=18;}
  if(currentPlace?.id==='mountain-trail'&&orbit.targetDistance>=90){desired.y+=20;desired.z-=13;}
  if(guidedWalk?.autoCamera)orbit.yaw=angleLerp(orbit.yaw,Math.atan2(active.x-SUMMIT.x,active.z-SUMMIT.z),1-Math.exp(-dt*2));

  target.lerp(desired,1-Math.exp(-dt*5));
  orbit.distance=THREE.MathUtils.lerp(orbit.distance,orbit.targetDistance,1-Math.exp(-dt*7));
  // Keep the character in the open space above the card tray, also on portrait screens.
  const distance=orbit.distance*(innerWidth<700?1.23:1);
  const horizontal=Math.cos(orbit.elevation)*distance;
  camera.position.set(target.x+Math.sin(orbit.yaw)*horizontal,target.y+Math.sin(orbit.elevation)*distance,target.z+Math.cos(orbit.yaw)*horizontal);
  if(camera.position.z<68&&camera.position.z>=-65)camera.position.y=Math.max(camera.position.y,mountainHeight(camera.position.x,camera.position.z)+5);
  camera.lookAt(target);camera.updateMatrixWorld();
}
function updateBubbles(){
  const pickerTop=$('.friends-panel').getBoundingClientRect().top;
  for(const bubble of bubbles){
    const visible=time<bubble.until;
    if(visible){projection.set(bubble.player.x,bubble.player.model.root.position.y+bubble.player.height+1.7,bubble.player.z).project(camera);
      const x=(projection.x*.5+.5)*innerWidth,y=(-projection.y*.5+.5)*innerHeight;
      const inView=projection.z<1&&projection.z>-1&&x>90&&x<innerWidth-90&&y>120&&y<pickerTop-12;
      const minTop=innerHeight<520?118:innerWidth<700?285:145;
      const bubbleY=Math.max(y,minTop+bubble.element.offsetHeight);
      // Tall friends need their top cubes visible beneath the destination bar.
      const sideOffset=innerWidth>700&&bubbleY>y+8?Math.min(150,bubble.element.offsetWidth*.65):0;
      const bubbleX=THREE.MathUtils.clamp(x+sideOffset,120,innerWidth-120);
      bubble.element.classList.toggle('hidden',!inView||bubbleY>pickerTop-8);bubble.element.style.left=`${bubbleX}px`;bubble.element.style.top=`${bubbleY}px`;
    }else bubble.element.classList.add('hidden');
  }
}
function animate(timestamp){
  requestAnimationFrame(animate);
  const dt=lastTime?Math.min((timestamp-lastTime)/1000,.05):1/60;lastTime=timestamp;if(document.hidden)return;time+=dt;
  if(!modalOpen()){
    const horizontal=Number(isDown('d','arrowright','right'))-Number(isDown('a','arrowleft','left'));
    const vertical=Number(isDown('s','arrowdown','down'))-Number(isDown('w','arrowup','up'));
    if(horizontal||vertical)guidedWalk=null;
    let velocity=movementVector(horizontal,vertical,orbit.yaw,keys.has('shift')?9:6);
    if(guidedWalk){
      let waypoint=MOUNTAIN_TRAIL[guidedWalk.index];
      while(waypoint&&Math.hypot(waypoint.x-active.x,waypoint.z-active.z)<.18){guidedWalk.index+=guidedWalk.direction;waypoint=MOUNTAIN_TRAIL[guidedWalk.index];}
      if(!waypoint){guidedWalk=null;setEmotion(active,'excited',12);remark(active);updateLocation();}
      else{const dx=waypoint.x-active.x,dz=waypoint.z-active.z,distance=Math.hypot(dx,dz),speed=Math.min(9,distance/Math.max(dt,.001));velocity={x:dx/distance*speed,z:dz/distance*speed};}
    }
    const travelled=moveWithCollisions(active,velocity.x*dt,velocity.z*dt,walkingObstacles(active),WORLD);
    if(guidedWalk){guidedWalk.stalled=travelled<.001?guidedWalk.stalled+dt:0;if(guidedWalk.stalled>1.5){guidedWalk=null;trailNoticeUntil=time+6;updateLocation();}}
    active.moving=travelled>.001;
    if(active.moving)active.yaw=angleLerp(active.yaw,Math.atan2(velocity.x,velocity.z),1-Math.exp(-dt*13));
    roaming.update(players,active,dt,time);
    for(const player of players){
      if(player.jump>0||player.jumpVelocity>0){player.jumpVelocity-=18*dt;player.jump=Math.max(0,player.jump+player.jumpVelocity*dt);if(!player.jump)player.jumpVelocity=0;}
      player.model.root.position.set(player.x,groundHeight(player.x,player.z)+player.jump,player.z);player.model.root.rotation.y=player.yaw;
      player.model.update(dt,{time:reducedMotion?0:time,moving:player.moving,emotion:player.emotion});
      if(player.moodUntil<time){setEmotion(player,['happy','happy','curious','excited','surprised','sleepy'][Math.floor(Math.random()*6)],18+Math.random()*19);}
    }
    if(time>nextRemark)remark(active);
    town.update(reducedMotion?0:time);park.update(reducedMotion?0:time);landscape.update(reducedMotion?0:time);
    if(active.jump<.3)updateBallContact(ballState,active,dt);
    const goal=stepBall(ballState,dt);football.update(ballState,time);
    if(goal){activityMessage=`Goal! ${ballState.goals} scored. Back to the center!`;activityUntil=time+4;setEmotion(active,'excited',8);tone();}

  }else active.moving=false;
  updateCamera(dt);
  const radius=Math.max(.9,active.width*.57);selectedRing.scale.set(radius,radius,1);selectedRing.position.x=active.x;selectedRing.position.z=active.z;selectedRing.position.y=groundHeight(active.x,active.z)+.16;
  selectionShadow.scale.set(radius*.9,.7,1);selectionShadow.position.x=active.x;selectionShadow.position.z=active.z;selectionShadow.position.y=groundHeight(active.x,active.z)+.13;
  sunlight.target.position.set(active.x,groundHeight(active.x,active.z),active.z);sunlight.position.set(active.x-24,groundHeight(active.x,active.z)+63,active.z-2);
  updateBubbles();renderer.render(scene,camera);
  frameCount++;
  if(timestamp-statsAt>500){
    fps=Math.round(frameCount*1000/(timestamp-statsAt));frameCount=0;statsAt=timestamp;updateLocation();if(active.number===21)updateBackpackButton();
    canvas.dataset.selected=String(active.number);canvas.dataset.ready='true';
    if(debug){$('#diagnostics').hidden=false;$('#diagnostics').textContent=JSON.stringify({renderer:'WebGL 2 · Three.js r180',fps,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,world:{...townCounts,cabins:park.cabinCount,bridges:BRIDGES.length,riverFrom:RIVER.startZ,riverTo:RIVER.endZ,seaStart:COAST.seaStart,width:WORLD.width,depth:WORLD.depth,minZ:WORLD.minZ},ball:{x:+ballState.x.toFixed(2),z:+ballState.z.toFixed(2),speed:+Math.hypot(ballState.vx,ballState.vz).toFixed(2),goals:ballState.goals,kicks:kickCount},trail:guidedWalk?{direction:guidedWalk.direction,index:guidedWalk.index}:null,characters:players.length,hopCount:hopCount,unitCubes:CHARACTERS.reduce((sum,p)=>sum+p.cells.length,0),selected:{number:active.number,x:+active.x.toFixed(2),z:+active.z.toFixed(2),width:active.width,height:active.height,cubes:active.cells.length,mood:active.emotion,jump:+active.jump.toFixed(2),altitude:+groundHeight(active.x,active.z).toFixed(2)},speech:{text:active.lastText,kind:active.lastRemarkKind,spoken:bubbles[0].element.dataset.spoken||'',speaker:active.number,voices:!muted,voice:voiceState},roaming:players.filter(p=>p!==active).map(p=>({number:p.number,x:+p.x.toFixed(2),z:+p.z.toFixed(2),moving:p.moving,...roaming.stateFor(p)})),camera:{yaw:+orbit.yaw.toFixed(2),elevation:+orbit.elevation.toFixed(2),distance:+orbit.distance.toFixed(1)},place:currentPlace?.id,errors},null,2);}
  }
}
updateCamera(1);renderer.render(scene,camera);$('#loading').hidden=true;
requestAnimationFrame(animate);
setTimeout(()=>{if(!active.lastText&&!modalOpen()&&!document.hidden){remark(active);if(document.activeElement===document.body)focusGame();}},900);
