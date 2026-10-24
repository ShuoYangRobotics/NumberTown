import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {HILL,DECK,RIVER,HILL_TRAIL,hillHeight,groundHeight,riverX,TERRAIN_OBSTACLES} from '../dist/terrain-data.js';
import {collides,moveWithCollisions} from '../dist/navigation.js';
import {createLandscape} from '../dist/terrain.js';
const world={width:300,depth:250,margin:2};

test('hill is a continuous climb with a level summit and zero-height outskirts',()=>{
  assert.equal(hillHeight(HILL.x,HILL.z),12);
  assert.equal(hillHeight(HILL.x+HILL.radius,HILL.z),0);
  let previous=0;
  for(let z=178;z<=203;z+=.1){const height=hillHeight(100,z);assert.ok(height>=previous-1e-9);assert.ok(height-previous<.081);previous=height;}
  assert.equal(groundHeight(100,212),DECK.height);
  assert.equal(groundHeight(20,20),0);
});

test('Fifteen can climb from trailhead through the deck entrance without clipping rails',()=>{
  const p={x:HILL_TRAIL[0][0],z:HILL_TRAIL[0][1],radius:2.7};
  const curve=new THREE.CatmullRomCurve3(HILL_TRAIL.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal');
  let highest=0;
  for(const next of curve.getPoints(600)){
    moveWithCollisions(p,next.x-p.x,next.z-p.z,TERRAIN_OBSTACLES,world);
    assert.ok(Math.hypot(p.x-next.x,p.z-next.z)<1e-7,'a tree or rail blocks the painted trail');
    assert.equal(collides(p.x,p.z,TERRAIN_OBSTACLES,world,p.radius),false);
    const elevation=groundHeight(p.x,p.z);assert.ok(Number.isFinite(elevation));highest=Math.max(highest,elevation);
  }
  assert.equal(highest,DECK.height);
  assert.ok(p.z>211.9);
  assert.equal(groundHeight(p.x,p.z),DECK.height);
  moveWithCollisions(p,0,15,TERRAIN_OBSTACLES,world);
  assert.ok(p.z<218-p.radius);
});

test('river blocks walking except at the wide bridge, whose ramps meet the banks',()=>{
  for(let x=148;x<=198;x+=.5)assert.equal(collides(x,173,TERRAIN_OBSTACLES,world,2.7),false,'river must leave the neighborhood street clear');
  const p={x:150,z:190,radius:2.7};moveWithCollisions(p,52,0,TERRAIN_OBSTACLES,world);
  assert.ok(p.x>201.9,'wide friend should cross the whole bridge');
  assert.equal(collides(riverX(220),220,TERRAIN_OBSTACLES,world,1),true);
  assert.equal(groundHeight(riverX(190),190),.6);
  assert.equal(groundHeight(riverX(190)-RIVER.bridgeSpan/2,190),0);
});

test('landscape constructs without browser dependencies and has finite geometry',()=>{
  const landscape=createLandscape();landscape.update(12);
  let meshes=0;landscape.root.traverse(object=>{if(object.isMesh){meshes++;assert.ok(object.position.toArray().every(Number.isFinite));const positions=object.geometry.attributes.position;for(const value of positions.array)assert.ok(Number.isFinite(value));}});
  assert.ok(meshes>50);
});


test('the full-width trail mesh remains above the curved hill surface',()=>{
  const landscape=createLandscape();
  const trail=landscape.root.getObjectByName('Hill trail surface');
  assert.ok(trail,'painted trail geometry should be identifiable');
  const vertices=trail.geometry.getAttribute('position'),index=trail.geometry.index;
  assert.ok(vertices.count>1000,'the trail must sample across its width, not only at its edges');
  for(let i=0;i<index.count;i+=3){
    const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
    const x=ids.reduce((sum,id)=>sum+vertices.getX(id),0)/3;
    const y=ids.reduce((sum,id)=>sum+vertices.getY(id),0)/3;
    const z=ids.reduce((sum,id)=>sum+vertices.getZ(id),0)/3;
    assert.ok(y>=hillHeight(x,z)+.005,`trail triangle cuts underground at ${x},${z}`);
  }
});


test('river ripples begin and stay inside the relocated water stretch',()=>{
  const landscape=createLandscape();
  const ripples=landscape.root.children.filter(object=>object.geometry?.type==='TorusGeometry');
  assert.equal(ripples.length,22);
  for(const time of [null,0,36,270,1000]){
    if(time!==null)landscape.update(time);
    for(const ripple of ripples){
      assert.ok(ripple.position.z>=RIVER.startZ && ripple.position.z<=RIVER.endZ,'ripple drifted outside the visible river');
    }
  }
});
