import * as THREE from './vendor/three.module.js';
import {HILL,DECK,RIVER,HILL_TRAIL,HILL_TREES,hillHeight,groundHeight,riverX} from './terrain-data.js';

export function createLandscape(){
  const root=new THREE.Group();root.name='Hill, scenic deck, and river';
  const mats=new Map();
  const mat=color=>{if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.87}));return mats.get(color);};
  const cube=new THREE.BoxGeometry(1,1,1),sphere=new THREE.SphereGeometry(1,12,8),cylinder=new THREE.CylinderGeometry(1,1,1,10);
  function mesh(geometry,color,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geometry,mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;}
  const box=(x,y,z,w,h,d,color)=>mesh(cube,color,x,y,z,w,h,d);
  const ball=(x,y,z,rx,ry,rz,color)=>mesh(sphere,color,x,y,z,rx,ry,rz);
  function beam(a,b,r,color){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),dir=bv.clone().sub(av);const m=mesh(cylinder,color,...av.clone().add(bv).multiplyScalar(.5).toArray(),r,dir.length(),r);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());return m;}
  function ribbon(points,width,color,height,across=1){
    const positions=[],indices=[],stride=across+1;
    points.forEach(([x,z],i)=>{
      const previous=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)];
      const dx=next[0]-previous[0],dz=next[1]-previous[1],length=Math.hypot(dx,dz)||1;
      // Sample the full width, so a broad trail follows the curved hillside
      // instead of connecting only its edges and cutting through the ground.
      for(let column=0;column<=across;column++){
        const offset=(column/across-.5)*width;
        const px=x+dz/length*offset,pz=z-dx/length*offset;
        positions.push(px,height(px,pz),pz);
      }
      if(i<points.length-1)for(let column=0;column<across;column++){
        const j=i*stride+column;
        indices.push(j,j+stride,j+1,j+1,j+stride,j+stride+1);
      }
    });
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
    const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:.85,side:THREE.DoubleSide}));m.receiveShadow=true;root.add(m);return m;
  }
  // The hill is a continuous height field, not a decorative sphere: feet can
  // follow every point on this same mathematical surface without clipping.
  const positions=[],colors=[],indices=[],size=HILL.radius*2,segments=80;
  const low=new THREE.Color('#b7cda4'),high=new THREE.Color('#c6d49a'),color=new THREE.Color();
  for(let j=0;j<=segments;j++)for(let i=0;i<=segments;i++){
    const x=HILL.x-size/2+i/segments*size,z=HILL.z-size/2+j/segments*size,y=hillHeight(x,z);
    positions.push(x,y+.012,z);color.copy(low).lerp(high,y/HILL.height*.7);colors.push(color.r,color.g,color.b);
    if(i<segments&&j<segments){const k=j*(segments+1)+i;indices.push(k,k+segments+1,k+1,k+1,k+segments+1,k+segments+2);}
  }
  const hillGeo=new THREE.BufferGeometry();hillGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));hillGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));hillGeo.setIndex(indices);hillGeo.computeVertexNormals();
  const hill=new THREE.Mesh(hillGeo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));hill.name='Walkable continuous hill';hill.receiveShadow=true;root.add(hill);
  const pathCurve=new THREE.CatmullRomCurve3(HILL_TRAIL.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal');
  const trail=pathCurve.getPoints(150).map(v=>[v.x,v.z]);
  ribbon(trail,6,'#f0dfb7',(x,z)=>hillHeight(x,z)+.04,8).name='Hill trail surface';
  // Trail-edge markers make the climb easy to follow without constraining play.
  for(let i=5;i<130;i+=12){const [x,z]=trail[i];const [nx,nz]=trail[i+1];const length=Math.hypot(nx-x,nz-z)||1;
    const px=x+(nz-z)/length*3.1,pz=z-(nx-x)/length*3.1;
    box(px,hillHeight(px,pz)+.45,pz,.18,.9,.18,'#b69a6c');ball(px,hillHeight(px,pz)+.94,pz,.22,.12,.22,'#fff0ca');
  }
  for(const [i,t] of HILL_TREES.entries()){
    const y=hillHeight(t.x,t.z);mesh(cylinder,'#a08660',t.x,y+t.height*.35,t.z,.2,t.height*.7,.2);
    ball(t.x,y+t.height*.78,t.z,1.75,t.height*.44,1.75,['#87aa81','#a5bd87','#94b28a'][i%3]);
    ball(t.x+.5,y+t.height*1.05,t.z-.2,1.15,1.3,1.15,'#a8c091');
  }
  // Planked summit deck, sturdy posts, railings, and a north-facing entrance.
  box(DECK.x,DECK.height-.18,DECK.z,DECK.width,.36,DECK.depth,'#b78d5c');
  for(let x=DECK.x-DECK.width/2+.25;x<DECK.x+DECK.width/2;x+=.5)box(x,DECK.height+.008,DECK.z,.465,.016,DECK.depth-.15,(Math.round(x*2)%3===0)?'#d5b785':'#dfc293');
  const railY=DECK.height+1.12;
  const rails=[[[93,206],[93,218]],[[107,206],[107,218]],[[93,218],[107,218]],[[93,206],[96.5,206]],[[103.5,206],[107,206]]];
  for(const [[ax,az],[bx,bz]] of rails){
    beam([ax,railY,az],[bx,railY,bz],.1,'#a57c51');beam([ax,DECK.height+.5,az],[bx,DECK.height+.5,bz],.055,'#c3a06f');
    const length=Math.hypot(ax-bx,az-bz),steps=Math.ceil(length/2);
    for(let i=0;i<=steps;i++){const x=ax+(bx-ax)*i/steps,z=az+(bz-az)*i/steps;box(x,DECK.height+.58,z,.17,1.16,.17,'#ab8154');}
  }
  // A real telescope points across the neighborhood, leaving the deck open.
  const tx=104.8,tz=215.9;mesh(cylinder,'#7c9997',tx,DECK.height+.8,tz,.14,1.6,.14);
  beam([tx,DECK.height+1.7,tz],[tx-.1,DECK.height+1.9,tz-1.1],.23,'#779d9e');
  mesh(cylinder,'#ddd1b0',tx,DECK.height+.09,tz,.55,.18,.55);
  label('SUNNY HILL LOOKOUT',100,DECK.height+.8,218.13,6.1,1.05,Math.PI);
  label('HILL TRAIL  ↑',105,.95,178,4.2,1.0,0);

  // Riverbank and continuous blue surface, gently winding beside the hill.
  const river=[];for(let z=RIVER.startZ;z<=RIVER.endZ;z+=.5)river.push([riverX(z),z]);
  ribbon(river,12.2,'#d7c79e',()=>.012);ribbon(river,10.5,'#a9c8ad',()=>.021);
  const water=ribbon(river,RIVER.width,'#70bacb',()=>.035);water.material.roughness=.35;water.material.metalness=.08;
  const ripples=[];
  const rippleGeo=new THREE.TorusGeometry(.72,.025,4,18);
  for(let i=0;i<22;i++){
    const z=RIVER.startZ+(i+.5)*(RIVER.endZ-RIVER.startZ)/22,x=riverX(z)+(i%3-1)*2;
    const ripple=new THREE.Mesh(rippleGeo,new THREE.MeshBasicMaterial({color:'#d6f0e7',transparent:true,opacity:.4}));ripple.rotation.x=-Math.PI/2;ripple.scale.set(1.5,.42,1);ripple.position.set(x,.065,z);root.add(ripple);ripples.push({mesh:ripple,z,side:i%3-1});
  }
  for(let i=0;RIVER.startZ+1+i*2.03<RIVER.endZ-1;i++){
    const z=RIVER.startZ+1+i*2.03;if(Math.abs(z-RIVER.bridgeZ)<7)continue;const side=i%2?1:-1;
    ball(riverX(z)+side*5.4,.16,z,.45,.24,.32,i%3?'#d9d0b5':'#e9ddc1');
    if(i%3===0){const x=riverX(z)+side*6.3;for(let j=-1;j<2;j++)beam([x+j*.18,0,z],[x+j*.25,.8+j*.1,z+.1],.035,'#7e9a69');}
  }
  const bridgeX=riverX(RIVER.bridgeZ);
  for(let x=bridgeX-RIVER.bridgeSpan/2+.2;x<bridgeX+RIVER.bridgeSpan/2;x+=.4){
    const y=groundHeight(x,RIVER.bridgeZ);
    box(x,y-.09,RIVER.bridgeZ,.38,.18,RIVER.bridgeWidth,'#cfac78');
  }
  for(const side of [-1,1]){
    const z=RIVER.bridgeZ+side*5.2;
    for(let i=0;i<=10;i++){
      const x=bridgeX-14.5+i*2.9,y=groundHeight(x,RIVER.bridgeZ);box(x,y+.6,z,.18,1.2,.18,'#987647');
      if(i<10){const nx=x+2.9,ny=groundHeight(nx,RIVER.bridgeZ);beam([x,y+1.15,z],[nx,ny+1.15,z],.085,'#a78451');beam([x,y+.5,z],[nx,ny+.5,z],.04,'#c5a674');}
    }
  }
  label('RIVERSIDE WALK',149,1.1,183.8,4.8,1.0,0);
  function label(text,x,y,z,w,h,rotation){
    if(typeof document==='undefined')return;
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;const c=canvas.getContext('2d');c.fillStyle='#ffefcf';c.fillRect(0,0,768,160);c.strokeStyle='#b4a582';c.lineWidth=10;c.strokeRect(8,8,752,144);c.fillStyle='#6c7d5a';c.font='bold 43px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,384,82);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const sign=new THREE.Mesh(new THREE.BoxGeometry(w,h,.12),new THREE.MeshStandardMaterial({map:texture,roughness:.9}));sign.position.set(x,y,z);sign.rotation.y=rotation;root.add(sign);
  }
  return {root,update(time){ripples.forEach((r,i)=>{const z=RIVER.startZ+((r.z-RIVER.startZ+time*.3)%(RIVER.endZ-RIVER.startZ));r.mesh.position.set(riverX(z)+r.side*2,.065,z);r.mesh.material.opacity=.2+Math.sin(time+i)*.1;});}};
}
