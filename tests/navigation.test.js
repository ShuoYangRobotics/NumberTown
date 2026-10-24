import test from 'node:test';
import assert from 'node:assert/strict';
import { movementVector, collides, moveWithCollisions, nearestOpenPosition, angleLerp } from '../dist/navigation.js';
const world = {width:96, depth:84, margin:2};
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-7, `${a} != ${b}`);

test('movement stays aligned with the camera at every orbit angle', () => {
  for (const yaw of [0, Math.PI/2, Math.PI, -Math.PI/2, .63]) {
    for (const [h,v] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const p=movementVector(h,v,yaw);
      near(p.x*Math.cos(yaw)-p.z*Math.sin(yaw),h*6);
      near(p.x*Math.sin(yaw)+p.z*Math.cos(yaw),v*6);
    }
    near(Math.hypot(...Object.values(movementVector(1,1,yaw))),6);
  }
  assert.deepEqual(movementVector(0,0,1),{x:0,z:0});
});
test('swept walking cannot tunnel through buildings, ponds, or the island boundary',()=>{
  const obstacles=[{x:30,z:10,w:2,d:65},{x:15,z:50,radius:4}];
  for (const radius of [.72,1.2,2.7]) {
    const p={x:15,z:20,radius};
    moveWithCollisions(p,60,0,obstacles,world);
    assert.ok(p.x<=30-radius+.001);
    assert.equal(collides(p.x,p.z,obstacles,world,radius),false);
    const q={x:15,z:30,radius}; moveWithCollisions(q,0,40,obstacles,world);
    assert.ok(q.z<=46-radius+.001);
    const r={x:10,z:10,radius}; moveWithCollisions(r,-100,-100,[],world);
    assert.ok(r.x>=world.margin+radius && r.z>=world.margin+radius);
  }
});
test('diagonal motion slides along a wall and safe relocation respects wide bodies',()=>{
  const obstacle=[{x:30,z:10,w:4,d:65}];
  const p={x:26,z:20,radius:2.7}; moveWithCollisions(p,10,10,obstacle,world);
  assert.ok(p.x<27.31 && p.z>29.9);
  const q=nearestOpenPosition({x:31,z:40},obstacle,world,2.7);
  assert.equal(collides(q.x,q.z,obstacle,world,2.7),false);
});
test('turning takes the short path across the angle seam',()=>{
  const angle=angleLerp(Math.PI-.1,-Math.PI+.1,.5);
  near(angle,Math.PI);
});
