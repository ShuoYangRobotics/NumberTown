import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { WORLD, WATER_PLAY } from '../dist/geography.js';
import { HILL, DECK, RIVER, BRIDGES, COAST, MOUNTAINS, HILL_TRAIL, HILL_LANDMARK, LOOKOUT_LANDMARK, BRIDGE_LANDMARKS, RIVER_LANDMARK, BEACH_LANDMARK, WATER_PLAY_LANDMARK, UNDERWATER_LANDMARK, WATER_PLAY_BUOYS, MOUNTAIN_LANDMARK, hillHeight, bridgeHeight, waterPlayHeight, groundHeight, riverX, riverWidth, TERRAIN_OBSTACLES } from '../dist/terrain-data.js';
import { CHARACTERS, getCharacterMetrics } from '../dist/character-data.js';
import { createCharacter } from '../dist/characters3d.js';
import { getCharacterArrangements } from '../dist/arrangements.js';
import { createTown } from '../dist/world3d.js';
import { mountTownMap } from '../dist/town-map.js';
import { collides, moveWithCollisions } from '../dist/navigation.js';
import { createLandscape } from '../dist/terrain.js';
import { createWaterBall } from '../dist/water-ball.js';
import { MOUNTAIN_TRAIL_LANDMARK, SUMMIT_LANDMARK, isOnMountainRoute } from '../dist/mountain-route.js';
const widest = Math.max(...CHARACTERS.flatMap(character=>[character,...getCharacterArrangements(character.number).filter(form=>form.family==='funny')]).map(character=>getCharacterMetrics(character).radius));
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-6, `${a} differs from ${b}`);

 test('the relocated hill rises continuously and has a level deck above the sea',()=>{
  assert.equal(hillHeight(HILL.x,HILL.z),HILL.height);
  assert.equal(hillHeight(HILL.x+HILL.radius,HILL.z),0);
  let previous=0;
  for(let z=HILL.z-HILL.radius-2;z<=HILL.z-HILL.plateau;z+=.1){
    const height=hillHeight(HILL.x,z);assert.ok(height>=previous-1e-9);assert.ok(height-previous<.1*1.5*HILL.height/(HILL.radius-HILL.plateau)+1e-8);previous=height;
  }
  assert.equal(groundHeight(DECK.x,DECK.z),DECK.height);
  assert.ok(HILL.z+HILL.radius<COAST.beachStart);
  assert.ok(DECK.height>10 && COAST.seaStart>DECK.z);
});

test('a wide friend can follow the entire winding trail through the deck entrance',()=>{
  assert.equal(CHARACTERS.length,51);
  assert.ok(HILL.pathWidth>=widest*2+1);
  assert.ok(DECK.entranceWidth>=widest*2+2);
  const player={x:HILL_TRAIL[0][0],z:HILL_TRAIL[0][1],radius:widest};
  const curve=new THREE.CatmullRomCurve3(HILL_TRAIL.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal');
  let highest=0;
  for(const next of curve.getPoints(600)){
    moveWithCollisions(player,next.x-player.x,next.z-player.z,TERRAIN_OBSTACLES,WORLD);
    assert.ok(Math.hypot(player.x-next.x,player.z-next.z)<1e-7,'tree or railing blocks painted trail');
    assert.equal(collides(player.x,player.z,TERRAIN_OBSTACLES,WORLD,player.radius),false);
    highest=Math.max(highest,groundHeight(player.x,player.z));
  }
  assert.equal(highest,DECK.height);close(player.x,DECK.x);close(player.z,DECK.z);
  moveWithCollisions(player,0,15,TERRAIN_OBSTACLES,WORLD);
  assert.ok(player.z<DECK.z+DECK.depth/2-player.radius);
});

test('the widened visible hill paving and deck support the whole largest funny footprint',()=>{
  const root=createLandscape().root;root.updateMatrixWorld(true);
  const trail=root.getObjectByName('Hill trail surface'),deck=root.getObjectByName('Hill lookout deck');
  assert.ok(trail&&deck);
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
  const curve=new THREE.CatmullRomCurve3(HILL_TRAIL.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal');
  let checked=0;
  for(const point of curve.getSpacedPoints(90))for(let i=0;i<16;i++){
    const x=point.x+Math.cos(i*Math.PI/8)*widest,z=point.z+Math.sin(i*Math.PI/8)*widest;
    ray.ray.origin.set(x,100,z);
    const hit=ray.intersectObjects([trail,deck],false)[0];
    assert.ok(hit,`The widest footprint leaves visible hill paving at ${x},${z}`);
    assert.ok(Math.abs(hit.point.y-groundHeight(x,z))<.15,`The visible hill surface disagrees with walking height at ${x},${z}`);
    checked++;
  }
  assert.ok(checked>1400);
});

test('all three bridge crossings admit wide characters and have continuous bank ramps',()=>{
  assert.equal(BRIDGES.length,3);
  assert.deepEqual(BRIDGE_LANDMARKS.map(place=>place.id),['north-bridge','river','coast-bridge']);
  assert.equal(RIVER_LANDMARK,BRIDGE_LANDMARKS[1]);
  for(const [index,bridge] of BRIDGES.entries()){
    const start=bridge.x-bridge.span/2-7,end=bridge.x+bridge.span/2+7;
    const player={x:start,z:bridge.z,radius:widest};
    moveWithCollisions(player,end-start,0,TERRAIN_OBSTACLES,WORLD);
    close(player.x,end);close(player.z,bridge.z);
    assert.ok(BRIDGE_LANDMARKS[index].arrival.x<bridge.x-bridge.span/2);
    assert.equal(groundHeight(bridge.x,bridge.z),bridge.height);
    assert.equal(bridgeHeight(bridge,start),0);assert.equal(bridgeHeight(bridge,end),0);
    let previous=0;
    for(let x=start;x<=end;x+=.1){const y=groundHeight(x,bridge.z);assert.ok(Number.isFinite(y));assert.ok(Math.abs(y-previous)<.025);previous=y;}
    const onBridge={x:bridge.x,z:bridge.z,radius:widest};
    moveWithCollisions(onBridge,0,20,TERRAIN_OBSTACLES,WORLD);
    assert.ok(onBridge.z<bridge.z+bridge.width/2,'side rails must prevent leaving into the river');
  }
});

test('the river remains blocked along its full town length except the three crossing corridors',()=>{
  const water=TERRAIN_OBSTACLES.filter(obstacle=>obstacle.kind==='water');
  for(let z=MOUNTAINS.maxZ+.25;z<COAST.seaStart;z+=.5){
    const bridgeCorridor=BRIDGES.some(bridge=>Math.abs(z-bridge.z)<bridge.width/2);
    assert.equal(collides(riverX(z),z,water,WORLD,.01),!bridgeCorridor,`incorrect water gap at z=${z}`);
  }
  assert.ok(RIVER.startZ<MOUNTAINS.minZ);
  assert.ok(RIVER.endZ>COAST.seaStart);
  assert.equal(riverWidth(200),14);
  assert.ok(riverWidth(COAST.seaStart)>30,'the river must widen into an estuary');
});

test('mountains and the gorge remain inaccessible away from the paved summit route',()=>{
  for(const x of [20,130,240,320,420])for(const z of [10,35,60,68]){
    if (!isOnMountainRoute(x, z, .6)) assert.equal(collides(x,z,TERRAIN_OBSTACLES,WORLD,.6),true,`unprotected mountainside at ${x},${z}`);
  }
  const player={...MOUNTAIN_LANDMARK.arrival,radius:2.7};
  assert.equal(collides(player.x,player.z,TERRAIN_OBSTACLES,WORLD,player.radius),false);
  // A straight-line shortcut from the viewing area must either stop at the
  // mountain boundary or remain wholly inside the dedicated walking route.
  for (let step = 0; step < 250; step++) {
    moveWithCollisions(player,0,-.2,TERRAIN_OBSTACLES,WORLD);
    assert.ok(player.z>=MOUNTAINS.maxZ+player.radius-1e-7 || isOnMountainRoute(player.x,player.z,player.radius));
  }
});

test('all original footprints fit the expanded bay and the widest walks from shore to the offshore boundary',()=>{
  assert.ok(Object.isFrozen(WATER_PLAY)&&Object.isFrozen(WATER_PLAY.spawn));
  assert.deepEqual(WATER_PLAY,{xMin:18,xMax:212,shoreZ:398,deepZ:660,beachZ:379,spawn:{x:160,z:410},waterY:.045,maxDepth:18,depthRamp:120});
  assert.ok((WATER_PLAY.xMax-WATER_PLAY.xMin)*(WATER_PLAY.deepZ-WATER_PLAY.shoreZ)>11*115*40);
  for(const character of CHARACTERS){
    const player={...BEACH_LANDMARK.arrival,radius:getCharacterMetrics(character.number).radius};
    for(const destination of [WATER_PLAY_LANDMARK.arrival,WATER_PLAY.spawn,UNDERWATER_LANDMARK.arrival]){
      assert.equal(collides(destination.x,destination.z,TERRAIN_OBSTACLES,WORLD,player.radius),false,`${character.name} cannot enter the bay`);
    }
    assert.ok(player.radius<=widest,'the continuous widest route must cover every original footprint');
  }
  const player={...BEACH_LANDMARK.arrival,radius:widest};
  for(const destination of [WATER_PLAY_LANDMARK.arrival,WATER_PLAY.spawn,{x:160,z:460},UNDERWATER_LANDMARK.arrival,{x:160,z:640}]){
      moveWithCollisions(player,destination.x-player.x,destination.z-player.z,TERRAIN_OBSTACLES,WORLD);
      close(player.x,destination.x);close(player.z,destination.z);
  }
  moveWithCollisions(player,0,100,TERRAIN_OBSTACLES,WORLD);
  assert.ok(player.z<=WATER_PLAY.deepZ-player.radius+1e-7,'the whole footprint stays inside the marked boundary');
  assert.ok(player.z>WATER_PLAY.deepZ-player.radius-1,'the expanded area remains usable to its offshore edge');
  moveWithCollisions(player,0,BEACH_LANDMARK.arrival.z-player.z,TERRAIN_OBSTACLES,WORLD);
  close(player.z,BEACH_LANDMARK.arrival.z);
});

test('the bay sides respect full footprints while the rest of the sea and the river mouth stay blocked',()=>{
  for(const radius of [.01,getCharacterMetrics(0).radius,.7,2.7,8]){
    for(const [x,allowed] of [[WATER_PLAY.xMin+radius+.01,true],[WATER_PLAY.xMin+radius-.01,false],[WATER_PLAY.xMax-radius-.01,true],[WATER_PLAY.xMax-radius+.01,false]]){
      assert.equal(collides(x,416,TERRAIN_OBSTACLES,WORLD,radius),!allowed,`incorrect bay edge at ${x} for radius ${radius}`);
    }
    assert.equal(collides(174,WATER_PLAY.deepZ-radius+.01,TERRAIN_OBSTACLES,WORLD,radius),true);
    const player={x:WATER_PLAY.spawn.x,z:416,radius};
    moveWithCollisions(player,250,0,TERRAIN_OBSTACLES,WORLD);
    assert.ok(player.x<=WATER_PLAY.xMax-radius+1e-7,'the river cannot be reached through the bay side');
  }
  for(const x of [5,10,215,240,320,420])assert.equal(collides(x,COAST.seaStart+5,TERRAIN_OBSTACLES,WORLD,.6),true);
  for(let z=COAST.seaStart;z<=RIVER.endZ;z+=.5)assert.equal(collides(riverX(z),z,TERRAIN_OBSTACLES,WORLD,.6),true,'the estuary remains forbidden');
  for(let x=5;x<WORLD.width-5;x+=2)assert.equal(collides(x,WATER_PLAY.deepZ+1,TERRAIN_OBSTACLES,WORLD,.6),true,'the southern edge must be closed');
});

test('the sandy slope descends continuously to eighteen metres without a step at the former world boundary',()=>{
  for(const x of [WATER_PLAY.xMin,94,105,160,201,WATER_PLAY.xMax]){
    let previous=groundHeight(x,WATER_PLAY.shoreZ-1);
    for(let z=WATER_PLAY.shoreZ-1;z<=WATER_PLAY.deepZ+1;z+=.1){
      const height=groundHeight(x,z);assert.ok(height>=-WATER_PLAY.maxDepth-1e-9&&height<=0);
      assert.ok(height<=previous+1e-9&&Math.abs(height-previous)<.023,'the sandy floor must descend gently');previous=height;
      close(height,waterPlayHeight(x,z));
    }
  }
  close(groundHeight(160,WATER_PLAY.shoreZ),0);close(groundHeight(160,WATER_PLAY.shoreZ+WATER_PLAY.depthRamp),-18);
  for(const x of [25,70,125,160,205]){
    close(groundHeight(x,535),-18);close(groundHeight(x,650),-18);
    assert.ok(Math.abs(groundHeight(x,460.1)-groundHeight(x,459.9))<.05);
    assert.equal(collides(x,460,TERRAIN_OBSTACLES,WORLD,2.7),false,'the old world edge cannot become a seabed wall');
  }
});

test('every form shorter than fifteen blocks, including Zero, can fully submerge on the deep floor',()=>{
  let checked=0;
  for(const character of CHARACTERS)for(const definition of getCharacterArrangements(character.number)){
    if(definition.height>=15)continue;
    const model=createCharacter(character.number,{definition});
    model.root.position.set(UNDERWATER_LANDMARK.arrival.x,groundHeight(125,535),UNDERWATER_LANDMARK.arrival.z);
    model.update(0,{time:2,moving:false});model.root.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model.root);
    assert.ok(bounds.max.y<WATER_PLAY.waterY,`${character.name}/${definition.formId}: full model and accessories must fit below the surface`);
    model.dispose();checked++;
  }
  assert.ok(checked>60,'check original shapes and their short rectangle forms');
});

test('every geographic landmark has an open arrival for the widest supported footprint',()=>{
  for(const place of [HILL_LANDMARK,LOOKOUT_LANDMARK,...BRIDGE_LANDMARKS,BEACH_LANDMARK,WATER_PLAY_LANDMARK,UNDERWATER_LANDMARK,MOUNTAIN_LANDMARK,MOUNTAIN_TRAIL_LANDMARK,SUMMIT_LANDMARK]){
    assert.equal(collides(place.arrival.x,place.arrival.z,TERRAIN_OBSTACLES,WORLD,widest),false,`${place.name} arrival blocked`);
  }
});

test('landscape builds without a DOM, uses batched props, and has finite geometry',()=>{
  assert.equal(typeof document,'undefined');
  const landscape=createLandscape();landscape.update(12);landscape.root.updateMatrixWorld(true);
  let meshes=0,instances=0;const geometries=new Set();
  landscape.root.traverse(object=>{
    if(object.isMesh){meshes++;geometries.add(object.geometry);}
    if(object.isInstancedMesh){instances++;assert.ok(Array.from(object.instanceMatrix.array).every(Number.isFinite));}
    assert.ok([...object.position.toArray(),...object.scale.toArray(),...object.quaternion.toArray()].every(Number.isFinite));
  });
  assert.ok(meshes>50&&meshes<180,'static scenery should remain batched');assert.ok(instances>10);
  for(const geometry of geometries)for(const value of geometry.attributes.position.array)assert.ok(Number.isFinite(value));
  assert.equal(landscape.root.children.filter(object=>object.userData.bridgeId).length,3);
  for(const name of ['Long sandy beach','Wet sand shoreline','Rugged northern mountain range','Open sea','Sea foam 1']){
    const bounds=new THREE.Box3().setFromObject(landscape.root.getObjectByName(name));
    assert.ok(bounds.min.x<(WORLD.minX??0)&&bounds.max.x>WORLD.width,`${name} must cover both edges of the expanded world`);
  }
});

test('the actual sandy floor matches walking height, and neither the island nor opaque sea covers the underwater bay',()=>{
  const landscape=createLandscape(),town=createTown();
  landscape.root.updateMatrixWorld(true);town.root.updateMatrixWorld(true);
  const floor=landscape.root.getObjectByName('Sandy underwater floor'),sea=landscape.root.getObjectByName('Open sea');
  const bay=landscape.root.getObjectByName('Water-play bay surface'),island=town.root.getObjectByName('Dry town island');
  assert.ok(floor&&sea&&bay&&island);
  const landBounds=new THREE.Box3().setFromObject(island);
  assert.ok(landBounds.max.z<=COAST.seaStart+1e-4,'dry land must end before the underwater area');
  floor.geometry.computeBoundingBox();const bounds=floor.geometry.boundingBox;
  close(bounds.min.y,-18);close(bounds.max.y,0);close(bounds.min.z,398);close(bounds.max.z,660);
  const positions=floor.geometry.attributes.position;
  for(let index=0;index<positions.count;index++){
    assert.ok(Math.abs(positions.getY(index)-groundHeight(positions.getX(index),positions.getZ(index)))<1e-5,'rendered floor vertices must use the walking profile');
  }
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
  for(const x of [25,75,125,160,205])for(const z of [399.13,410.44,450.77,459.97,460.37,475.61,518.9,535.3,650.5]){
    ray.ray.origin.set(x,30,z);
    const hits=ray.intersectObject(floor);
    assert.ok(hits.length>0,`missing sandy floor at ${x},${z}`);
    assert.ok(Math.abs(hits[0].point.y-groundHeight(x,z))<.002,'triangle interpolation must track the continuous slope');
    assert.equal(ray.intersectObject(sea).length,0,'the opaque ocean must have an actual opening over the whole bay');
    assert.equal(ray.intersectObject(island).length,0,'no island slab may conceal the seafloor');
  }
  for(const [x,z] of [[10,535],[225,535],[125,680]]){
    ray.ray.origin.set(x,30,z);assert.ok(ray.intersectObject(sea).length>0,'the ocean outside the play area remains opaque');
  }
  assert.equal(bay.material.transparent,true);assert.ok(bay.material.opacity>0&&bay.material.opacity<.6);
  assert.equal(bay.material.depthWrite,false);assert.equal(bay.material.side,THREE.DoubleSide);
  assert.ok(bay.renderOrder>0,'the transparent surface tints underwater objects after they are drawn');
});

test('every rendered trail triangle clears the actual triangulated hill, including tight bends',()=>{
  const root=createLandscape().root,trail=root.getObjectByName('Hill trail surface'),hill=root.getObjectByName('Walkable continuous hill');
  const triangles=mesh=>{
    const p=mesh.geometry.attributes.position,index=mesh.geometry.index,result=[];
    for(let i=0;i<index.count;i+=3)result.push([0,1,2].map(offset=>{const id=index.getX(i+offset);return {x:p.getX(id),y:p.getY(id),z:p.getZ(id)};}));
    return result;
  };
  const cross=(a,b,p)=>(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);
  const bounds=t=>({minX:Math.floor(Math.min(...t.map(p=>p.x))),maxX:Math.floor(Math.max(...t.map(p=>p.x))),minZ:Math.floor(Math.min(...t.map(p=>p.z))),maxZ:Math.floor(Math.max(...t.map(p=>p.z)))});
  const height=(t,p)=>{
    const area=cross(t[0],t[1],t[2]);
    const a=cross(t[1],t[2],p)/area,b=cross(t[2],t[0],p)/area;
    return a*t[0].y+b*t[1].y+(1-a-b)*t[2].y;
  };
  // Clip actual triangle projections against each other. The clearance is
  // linear over each intersection, so its minimum occurs at one of these
  // vertices; checking only centroids or the analytic hill misses crossings.
  const overlap=(a,b)=>{
    let polygon=a;const sign=Math.sign(cross(b[0],b[1],b[2]));
    for(let edge=0;edge<3&&polygon.length;edge++){
      const from=b[edge],to=b[(edge+1)%3],clipped=[];
      for(let i=0;i<polygon.length;i++){
        const p=polygon[i],q=polygon[(i+1)%polygon.length],dp=sign*cross(from,to,p),dq=sign*cross(from,to,q);
        if(dp>=0)clipped.push(p);
        if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);clipped.push({x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t});}
      }
      polygon=clipped;
    }
    return polygon;
  };
  const buckets=new Map();
  for(const triangle of triangles(hill)){
    const b=bounds(triangle);
    for(let x=b.minX;x<=b.maxX;x++)for(let z=b.minZ;z<=b.maxZ;z++){
      const key=`${x},${z}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(triangle);
    }
  }
  let comparisons=0;
  for(const triangle of triangles(trail)){
    const area=cross(...triangle);assert.ok(area<=1e-8,'trail grid must not fold over at the inside of bends');
    if(Math.abs(area)<1e-10)continue;
    const b=bounds(triangle),candidates=new Set();
    for(let x=b.minX;x<=b.maxX;x++)for(let z=b.minZ;z<=b.maxZ;z++)for(const candidate of buckets.get(`${x},${z}`)||[])candidates.add(candidate);
    for(const ground of candidates)for(const p of overlap(triangle,ground)){
      const clearance=height(triangle,p)-height(ground,p);comparisons++;
      assert.ok(clearance>=.075,`rendered trail and hill overlap near ${p.x},${p.z}: clearance ${clearance}`);
    }
  }
  assert.ok(comparisons>10000,'the check must cover the whole rendered corridor');
  assert.equal(trail.material.polygonOffset,true);
  assert.ok(trail.material.polygonOffsetFactor<hill.material.polygonOffsetFactor);
});

test('the rendered river is continuous from behind the mountains into the open sea',()=>{
  const root=createLandscape().root,river=root.getObjectByName('Continuous flowing river'),sea=root.getObjectByName('Open sea'),mountains=root.getObjectByName('Rugged northern mountain range');
  river.geometry.computeBoundingBox();sea.geometry.computeBoundingBox();mountains.geometry.computeBoundingBox();
  const bounds=river.geometry.boundingBox;
  close(bounds.min.z,RIVER.startZ);close(bounds.max.z,RIVER.endZ);
  assert.ok(sea.geometry.boundingBox.max.z>=1500,'the ocean end must lie beyond the camera fog');
  assert.ok(sea.geometry.boundingBox.min.x<=-1200 && sea.geometry.boundingBox.max.x>=WORLD.width+1200,'side edges must also remain hidden when orbiting');
  assert.ok(bounds.max.z>sea.geometry.boundingBox.min.z,'river and sea surfaces must overlap');
  assert.ok(mountains.geometry.boundingBox.max.y>60,'the backdrop must contain high peaks');
  assert.ok(mountains.geometry.boundingBox.min.z<=MOUNTAINS.minZ);
  assert.ok(mountains.geometry.boundingBox.max.z>=MOUNTAINS.maxZ);
  const vertices=river.geometry.attributes.position;
  for(let i=0;i<vertices.count;i+=2){
    const z=vertices.getZ(i);close(vertices.getZ(i+1),z);
    assert.ok(Math.abs(vertices.getX(i+1)-vertices.getX(i)-riverWidth(z))<.0001,'channel width does not match collisions');
    if(i+2<vertices.count)assert.ok(vertices.getZ(i+2)-z<=.801,'river surface has a longitudinal gap');
  }
});

test('flowing ripples and sea foam remain finite and bounded at all elapsed times',()=>{
  const landscape=createLandscape(),ripples=landscape.root.children.filter(object=>object.name==='River ripple'),waves=landscape.root.children.filter(object=>object.name.startsWith('Sea foam '));
  assert.equal(ripples.length,56);assert.ok(waves.length>=12);
  for(const time of [0,36,270,1000,-200,Infinity]){
    landscape.update(time);
    for(const ripple of ripples){assert.ok(ripple.position.z>=RIVER.startZ&&ripple.position.z<=RIVER.endZ);assert.ok(ripple.position.toArray().every(Number.isFinite));}
    for(const wave of waves){assert.ok(wave.position.toArray().every(Number.isFinite));assert.ok(wave.material.opacity>0&&wave.material.opacity<1);}
  }
});

test('waves travel toward shore and the expanded bay has a matching buoy boundary',()=>{
  const landscape=createLandscape(),bay=landscape.root.getObjectByName('Water-play bay surface'),buoys=landscape.root.getObjectByName('Water-play boundary buoys');
  bay.geometry.computeBoundingBox();const bounds=bay.geometry.boundingBox;
  close(bounds.min.x,WATER_PLAY.xMin);close(bounds.max.x,WATER_PLAY.xMax);close(bounds.min.z,WATER_PLAY.shoreZ);close(bounds.max.z,WATER_PLAY.deepZ);
  close(bounds.min.y,WATER_PLAY.waterY+.01);close(bounds.max.y,WATER_PLAY.waterY+.01);
  assert.equal(WATER_PLAY_BUOYS.length,29);
  assert.equal(buoys.children.filter(mesh=>mesh.name.startsWith('Colored bay buoys')).reduce((sum,mesh)=>sum+mesh.count,0),WATER_PLAY_BUOYS.length);
  assert.ok(WATER_PLAY_BUOYS.every(buoy=>buoy.x===WATER_PLAY.xMin||buoy.x===WATER_PLAY.xMax||buoy.z===WATER_PLAY.deepZ));
  const waves=landscape.root.children.filter(object=>object.name.startsWith('Sea foam '));
  landscape.update(.25);const positions=waves.map(wave=>wave.position.z);
  landscape.update(.5);
  waves.forEach((wave,index)=>close(wave.position.z-positions[index],-.9*.25));
  for(const time of [0,9.9,160,10000]){
    landscape.update(time);
    for(const wave of waves){
      wave.geometry.computeBoundingBox();
      assert.ok(wave.position.z+wave.geometry.boundingBox.min.z>=COAST.seaStart,'foam must not drift inland across the beach');
      assert.ok(wave.position.z<COAST.seaStart+waves.length*12+2);
      assert.ok(wave.renderOrder>bay.renderOrder,'surface transparency must not cover the foam');
    }
    for(const mesh of buoys.children)assert.ok(Array.from(mesh.instanceMatrix.array).every(Number.isFinite));
  }
});

test('foam and beach-ball ripples sit above the bay without a depth-offset surface hiding them',()=>{
  const landscape=createLandscape(),bay=landscape.root.getObjectByName('Water-play bay surface');
  assert.equal(bay.material.polygonOffset,false,'a slope-scaled offset can hide higher foam at low viewing angles');
  const bayTop=new THREE.Box3().setFromObject(bay).max.y;
  for(const wave of landscape.root.children.filter(object=>object.name.startsWith('Sea foam '))){
    const bounds=new THREE.Box3().setFromObject(wave);
    assert.ok(bounds.min.y>bayTop+.06,'foam must be physically above the shallow water');
    close(bounds.min.y,.12);assert.equal(wave.material.depthTest,true);
  }
  const ball=createWaterBall(),ripples=ball.root.children.filter(object=>object.name==='Beach ball ripple');
  assert.equal(ripples.length,3);
  for(const ripple of ripples){
    assert.equal(ripple.visible,true);assert.equal(ripple.material.depthTest,true);
    const bounds=new THREE.Box3().setFromObject(ripple);
    close(bounds.min.y,.063);assert.ok(bounds.min.y>bayTop+.007,'floating-ball ripples must not be buried under the bay');
  }
  ball.dispose();
});

test('the town map shows the bounded bay and exposes its supplied water-play destination',()=>{
  const oldDocument=globalThis.document,oldResizeObserver=globalThis.ResizeObserver,buttons=[],elements=new Map();let selected=null;
  const createElement=()=>({
    attributes:{},style:{},dataset:{},textContent:'',
    setAttribute(name,value){this.attributes[name]=value;},
    addEventListener(type,callback){this[type]=callback;},
    querySelectorAll(){return[];},
    getBoundingClientRect(){return{width:1000,height:600,left:0,top:0,right:1000,bottom:600};},
    append(button){buttons.push(button);},
  });
  const container={innerHTML:'',querySelector(selector){
    if(!elements.has(selector))elements.set(selector,createElement());
    return elements.get(selector);
  }};
  globalThis.document={createElement};
  globalThis.ResizeObserver=class{
    constructor(callback){this.callback=callback;}
    observe(){this.callback();}
    disconnect(){}
  };
  try{
    const map=mountTownMap(container,[BEACH_LANDMARK,WATER_PLAY_LANDMARK,UNDERWATER_LANDMARK],place=>{selected=place;});
    assert.match(container.innerHTML,/WATER PLAY/);assert.match(container.innerHTML,/UNDERWATER GARDEN/);
    assert.match(container.innerHTML,new RegExp(`x="${WATER_PLAY.xMin}" y="${WATER_PLAY.shoreZ}" width="194" height="262"`));
    const button=buttons.find(item=>item.textContent==='Water play');assert.ok(button);button.click();assert.equal(selected,WATER_PLAY_LANDMARK);
    const underwaterButton=buttons.find(item=>item.textContent==='Underwater garden');assert.ok(underwaterButton);underwaterButton.click();assert.equal(selected,UNDERWATER_LANDMARK);
    map.update({x:125,z:550});assert.match(elements.get('#map-player').attributes.transform,/translate\(125 550\)/);
    map.destroy();
  }finally{
    if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
    if(oldResizeObserver===undefined)delete globalThis.ResizeObserver;else globalThis.ResizeObserver=oldResizeObserver;
  }
});


test('both riverbank promenades cross the open bridge ramps without hitting rails',()=>{
  for(const bridge of BRIDGES)for(const x of [218,266]){
    const player={x,z:bridge.z-10,radius:2.7};
    assert.equal(collides(player.x,player.z,TERRAIN_OBSTACLES,WORLD,player.radius),false);
    moveWithCollisions(player,0,20,TERRAIN_OBSTACLES,WORLD);
    close(player.x,x);close(player.z,bridge.z+10);
    assert.equal(collides(player.x,player.z,TERRAIN_OBSTACLES,WORLD,player.radius),false);
  }
});
