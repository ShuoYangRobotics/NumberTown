import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { WORLD } from '../dist/geography.js';
import { HILL, DECK, RIVER, BRIDGES, COAST, MOUNTAINS, HILL_TRAIL, HILL_LANDMARK, LOOKOUT_LANDMARK, BRIDGE_LANDMARKS, RIVER_LANDMARK, BEACH_LANDMARK, MOUNTAIN_LANDMARK, hillHeight, bridgeHeight, groundHeight, riverX, riverWidth, TERRAIN_OBSTACLES } from '../dist/terrain-data.js';
import { collides, moveWithCollisions } from '../dist/navigation.js';
import { createLandscape } from '../dist/terrain.js';
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-6, `${a} differs from ${b}`);

 test('the relocated hill rises continuously and has a level deck above the sea',()=>{
  assert.equal(hillHeight(HILL.x,HILL.z),HILL.height);
  assert.equal(hillHeight(HILL.x+HILL.radius,HILL.z),0);
  let previous=0;
  for(let z=HILL.z-HILL.radius-2;z<=HILL.z-HILL.plateau;z+=.1){
    const height=hillHeight(HILL.x,z);assert.ok(height>=previous-1e-9);assert.ok(height-previous<.081);previous=height;
  }
  assert.equal(groundHeight(DECK.x,DECK.z),DECK.height);
  assert.ok(HILL.z+HILL.radius<COAST.beachStart);
  assert.ok(DECK.height>10 && COAST.seaStart>DECK.z);
});

test('a wide friend can follow the entire winding trail through the deck entrance',()=>{
  const player={x:HILL_TRAIL[0][0],z:HILL_TRAIL[0][1],radius:2.7};
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

test('all three bridge crossings admit wide characters and have continuous bank ramps',()=>{
  assert.equal(BRIDGES.length,3);
  assert.deepEqual(BRIDGE_LANDMARKS.map(place=>place.id),['north-bridge','river','coast-bridge']);
  assert.equal(RIVER_LANDMARK,BRIDGE_LANDMARKS[1]);
  for(const [index,bridge] of BRIDGES.entries()){
    const start=bridge.x-bridge.span/2-7,end=bridge.x+bridge.span/2+7;
    const player={x:start,z:bridge.z,radius:2.7};
    moveWithCollisions(player,end-start,0,TERRAIN_OBSTACLES,WORLD);
    close(player.x,end);close(player.z,bridge.z);
    assert.ok(BRIDGE_LANDMARKS[index].arrival.x<bridge.x-bridge.span/2);
    assert.equal(groundHeight(bridge.x,bridge.z),bridge.height);
    assert.equal(bridgeHeight(bridge,start),0);assert.equal(bridgeHeight(bridge,end),0);
    let previous=0;
    for(let x=start;x<=end;x+=.1){const y=groundHeight(x,bridge.z);assert.ok(Number.isFinite(y));assert.ok(Math.abs(y-previous)<.025);previous=y;}
    const onBridge={x:bridge.x,z:bridge.z,radius:2.7};
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

test('mountains including the gorge are inaccessible, while their viewing arrival is clear',()=>{
  for(const x of [20,130,240,320,420])for(const z of [10,35,60,68])assert.equal(collides(x,z,TERRAIN_OBSTACLES,WORLD,.6),true);
  const player={...MOUNTAIN_LANDMARK.arrival,radius:2.7};
  assert.equal(collides(player.x,player.z,TERRAIN_OBSTACLES,WORLD,player.radius),false);
  moveWithCollisions(player,0,-50,TERRAIN_OBSTACLES,WORLD);
  assert.ok(player.z>=MOUNTAINS.maxZ+player.radius-1e-7);
});

test('beach sand is walkable and the sea blocks travel beyond the shoreline',()=>{
  const player={...BEACH_LANDMARK.arrival,radius:2.7};
  assert.equal(collides(player.x,player.z,TERRAIN_OBSTACLES,WORLD,player.radius),false);
  for(let z=COAST.beachStart;z<=COAST.seaStart-3;z+=.5)assert.equal(collides(player.x,z,TERRAIN_OBSTACLES,WORLD,player.radius),false);
  moveWithCollisions(player,0,80,TERRAIN_OBSTACLES,WORLD);
  assert.ok(player.z<=COAST.seaStart-player.radius+1e-7);
  for(const x of [20,160,240,320,420])assert.equal(collides(x,COAST.seaStart+5,TERRAIN_OBSTACLES,WORLD,.6),true);
});

test('every geographic landmark has an open arrival for the widest supported footprint',()=>{
  for(const place of [HILL_LANDMARK,LOOKOUT_LANDMARK,...BRIDGE_LANDMARKS,BEACH_LANDMARK,MOUNTAIN_LANDMARK]){
    assert.equal(collides(place.arrival.x,place.arrival.z,TERRAIN_OBSTACLES,WORLD,2.7),false,`${place.name} arrival blocked`);
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


test('both riverbank promenades cross the open bridge ramps without hitting rails',()=>{
  for(const bridge of BRIDGES)for(const x of [218,266]){
    const player={x,z:bridge.z-10,radius:2.7};
    assert.equal(collides(player.x,player.z,TERRAIN_OBSTACLES,WORLD,player.radius),false);
    moveWithCollisions(player,0,20,TERRAIN_OBSTACLES,WORLD);
    close(player.x,x);close(player.z,bridge.z+10);
    assert.equal(collides(player.x,player.z,TERRAIN_OBSTACLES,WORLD,player.radius),false);
  }
});
