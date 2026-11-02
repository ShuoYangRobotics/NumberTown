import { getCharacterArrangements, findArrangementPosition } from '../dist/arrangements.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { WATER_PLAY, WORLD } from '../dist/geography.js';
import { groundHeight, TERRAIN_OBSTACLES, UNDERWATER_LANDMARK } from '../dist/terrain-data.js';
import { bodyHeight, stepSwimming, resetSwimming, SWIM_SPEED, bodiesOverlap, hasBodyClearance } from '../dist/swimming.js';
import { immersionFor } from '../dist/water-view.js';
import { getCharacterMetrics } from '../dist/character-data.js';
import { collides, nearestOpenPosition } from '../dist/navigation.js';
import { MOUNTAIN_TRAIL, SUMMIT_LANDMARK } from '../dist/mountain-route.js';
import { createTrainState, boardingPoint, TRAIN_OBSTACLES } from '../dist/train-park.js';

const swimmer = () => ({number:0,x:125,z:535,height:.9,jump:0,jumpVelocity:0,swimY:null});
test('Z ascends, X descends, and releasing them holds exact absolute height',()=>{
  const p=swimmer();stepSwimming(p,0);assert.equal(p.swimY,-18);
  for(let i=0;i<120;i++)stepSwimming(p,1/60,1);
  assert.ok(Math.abs(bodyHeight(p)-(-18+2*SWIM_SPEED))<1e-9);
  const held=p.swimY;
  for(let i=0;i<1800;i++)stepSwimming(p,1/60,0);
  assert.equal(p.swimY,held);
  for(let i=0;i<60;i++)stepSwimming(p,1/60,-1);
  assert.ok(Math.abs(p.swimY-(held-SWIM_SPEED))<1e-9);
});
test('horizontal movement preserves altitude but cannot enter sand or leave water floating',()=>{
  const p={...swimmer(),swimY:-6};p.z=470;stepSwimming(p,1/60);assert.equal(bodyHeight(p),-6);
  p.z=430;stepSwimming(p,1/60);assert.equal(bodyHeight(p),groundHeight(p.x,p.z));
  p.z=385;stepSwimming(p,1/60);assert.equal(p.swimY,null);assert.equal(bodyHeight(p),0);
  p.z=430;stepSwimming(p,1/60,0,0);assert.equal(p.swimY,0,'entry preserves pre-move altitude');
});
test('surface and floor limit movement for Zero and every character height',()=>{
  for(const height of [.9,1,14,30]){
    const p={...swimmer(),height};
    for(let i=0;i<500;i++)stepSwimming(p,1/60,1);
    assert.equal(bodyHeight(p),WATER_PLAY.waterY);
    assert.equal(immersionFor(p,height).submerged,false);
    for(let i=0;i<500;i++)stepSwimming(p,1/60,-1);
    assert.equal(bodyHeight(p),-18);
    assert.equal(immersionFor(p,height).submerged,height<18);
  }
});
test('swimming clears gravity, survives pauses, and resets on travel',()=>{
  const p={...swimmer(),jump:2,jumpVelocity:7};stepSwimming(p,0);
  assert.equal(p.swimY,-16);assert.equal(p.jump,0);assert.equal(p.jumpVelocity,0);
  const before=p.swimY;stepSwimming(p,NaN,1);assert.equal(p.swimY,before);
  resetSwimming(p);assert.equal(p.swimY,null);
  p.z=385;p.jump=1;assert.equal(bodyHeight(p),1);
});

test('character collision compares body spans at different swimming depths',()=>{
  const tall={...swimmer(),height:30,swimY:0},short={...swimmer(),height:1,swimY:-18};
  assert.equal(bodiesOverlap(tall,short),false);assert.equal(bodiesOverlap(short,tall),false);
  short.swimY=-.5;assert.equal(bodiesOverlap(tall,short),true);
  tall.swimY=-18;short.swimY=-5;assert.equal(bodiesOverlap(tall,short),true);
});

test('growing underwater checks the new height and finds room beside a higher swimmer', () => {
  const definition=getCharacterArrangements(20).find(form=>form.width===1&&form.height===20);
  const player={number:20,x:160,z:560,height:1,radius:.71,swimY:-18,jump:0};
  const swimmer={number:1,x:160,z:560,height:1,radius:.71,swimY:-8,jump:0};
  assert.equal(bodiesOverlap(player,swimmer),false);
  const canPlace=(position,metrics)=>hasBodyClearance({...player,...definition,...metrics,...position,jump:0},[swimmer]);
  const options={obstacles:[],world:{width:840,depth:690,minZ:-90,margin:2},groundHeight,canPlace};
  assert.equal(findArrangementPosition(player,definition,{...options,maxDistance:0}),null);
  const placement=findArrangementPosition(player,definition,{...options,maxDistance:4});
  assert.ok(placement,'a safe nearby transformation should still be possible');
  assert.ok(Math.hypot(placement.position.x-swimmer.x,placement.position.z-swimmer.z)>=placement.metrics.radius+swimmer.radius+.08);
  assert.equal(player.swimY,-18,'finding room must not change the swimming height');
});

const groundedArrival=(player,arrival,others,obstacles=TERRAIN_OBSTACLES)=>{
  const peers=others.filter(other=>other!==player);
  const canPlace=point=>hasBodyClearance({...player,...point,jump:0,swimY:null},peers);
  const point=nearestOpenPosition(arrival,obstacles,WORLD,player.radius,canPlace);
  const placed={...player,...point,jump:0,swimY:null};
  assert.equal(collides(point.x,point.z,obstacles,WORLD,player.radius),false);
  assert.equal(hasBodyClearance(placed,peers),true);
  return placed;
};

test('fast travel compares proposed summit altitude instead of the old town altitude',()=>{
  const five={number:5,...getCharacterMetrics(5),...SUMMIT_LANDMARK.arrival,jump:0,swimY:null};
  const thirty={number:30,...getCharacterMetrics(30),x:140,z:200,jump:2,swimY:null};
  const before={...thirty};
  assert.equal(bodiesOverlap(five,thirty),false,'this old-height comparison previously omitted Five');
  const placed=groundedArrival(thirty,SUMMIT_LANDMARK.arrival,[thirty,five]);
  assert.equal(bodyHeight(placed),72);
  assert.ok(Math.hypot(placed.x-five.x,placed.z-five.z)>=placed.radius+five.radius+.08);
  assert.deepEqual(thirty,before,'search must not mutate altitude or position before committing');
  assert.deepEqual(groundedArrival(five,SUMMIT_LANDMARK.arrival,[five]),five,'the original player must not become its own obstacle');
});

test('surface-to-seabed travel avoids grounded friends while allowing vertically separate swimmers',()=>{
  const arrival=UNDERWATER_LANDMARK.arrival;
  const arriving={number:1,...getCharacterMetrics(1),...arrival,jump:0,swimY:WATER_PLAY.waterY};
  const floorFriend={number:5,...getCharacterMetrics(5),...arrival,jump:0,swimY:null};
  assert.equal(bodiesOverlap(arriving,floorFriend),false);
  const beside=groundedArrival(arriving,arrival,[floorFriend]);
  assert.equal(bodyHeight(beside),-18);
  assert.ok(Math.hypot(beside.x-floorFriend.x,beside.z-floorFriend.z)>=beside.radius+floorFriend.radius+.08);

  const higher={number:2,...getCharacterMetrics(2),...arrival,jump:0,swimY:-5};
  const below=groundedArrival(arriving,arrival,[higher]);
  assert.equal(below.x,arrival.x);assert.equal(below.z,arrival.z);
  const tall={...arriving,height:30};
  const besideHigher=groundedArrival(tall,arrival,[higher]);
  assert.ok(Math.hypot(besideHigher.x-higher.x,besideHigher.z-higher.z)>=tall.radius+higher.radius+.08);
});

test('mountain trail candidates use each proposed height and train exits retain peer and rail clearance',()=>{
  const player={number:1,...getCharacterMetrics(1),x:140,z:200,jump:0,swimY:null};
  const first=MOUNTAIN_TRAIL.find(point=>groundHeight(point.x,point.z)>20&&!collides(point.x,point.z,TERRAIN_OBSTACLES,WORLD,player.radius));
  assert.ok(first);
  const peer={...player,number:2,...first};
  // Slice by index: trail samples carry coordinates, without requiring progress metadata.
  const remaining=MOUNTAIN_TRAIL.slice(MOUNTAIN_TRAIL.indexOf(first));
  const safe=remaining.find(point=>!collides(point.x,point.z,TERRAIN_OBSTACLES,WORLD,player.radius)&&hasBodyClearance({...player,...point,jump:0,swimY:null},[peer]));
  assert.ok(safe&&safe!==first);
  assert.equal(hasBodyClearance({...player,...safe,jump:0,swimY:null},[peer]),true);

  const state=createTrainState(),exit=boardingPoint(state);
  const waiting={...player,number:2,...exit};
  const disembarked=groundedArrival({...player,jump:8},exit,[waiting],[...TERRAIN_OBSTACLES,...TRAIN_OBSTACLES]);
  assert.equal(bodyHeight(disembarked),0);
  assert.ok(Math.hypot(disembarked.x-exit.x,disembarked.z-exit.z)>=player.radius+waiting.radius+.08);
});
