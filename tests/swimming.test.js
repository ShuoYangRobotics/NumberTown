import { getCharacterArrangements, findArrangementPosition } from '../dist/arrangements.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { WATER_PLAY } from '../dist/geography.js';
import { groundHeight } from '../dist/terrain-data.js';
import { bodyHeight, stepSwimming, resetSwimming, SWIM_SPEED, bodiesOverlap, hasBodyClearance } from '../dist/swimming.js';
import { immersionFor } from '../dist/water-view.js';

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
