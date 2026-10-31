import * as THREE from './vendor/three.module.js';
import { SUMMIT, SUMMIT_DECK, SUMMIT_RAILS, MOUNTAIN_TRAIL, MOUNTAIN_PAVING_END, mountainWalkHeight } from './mountain-route.js';

/** Paved mountain walk, protective rails, and a furnished summit platform. */
export function createMountainSummit(){
  const root=new THREE.Group();root.name='Mountain summit trail and lookout';
  const materials=new Map(),batches=new Map(),dummy=new THREE.Object3D();
  const geometries={box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(1,1,1,8),sphere:new THREE.SphereGeometry(1,10,6)};
  const material=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.85}));return materials.get(color);};
  function instance(shape,color,x,y,z,sx,sy,sz,quaternion){
    const key=shape+color;if(!batches.has(key))batches.set(key,{shape,color,matrices:[]});
    dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.quaternion.copy(quaternion||new THREE.Quaternion());dummy.updateMatrix();batches.get(key).matrices.push(dummy.matrix.clone());
  }
  const box=(color,x,y,z,w,h,d)=>instance('box',color,x,y,z,w,h,d);
  function beam(a,b,radius,color){
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start),center=start.clone().add(end).multiplyScalar(.5);
    if(delta.length()<.001)return;
    const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());
    instance('cylinder',color,center.x,center.y,center.z,radius,delta.length(),radius,rotation);
  }
  function sign(text,x,y,z,width=4){
    if(typeof document==='undefined')return;
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;
    const context=canvas.getContext('2d');if(!context)return;
    context.fillStyle='#fff2d7';context.fillRect(0,0,768,192);context.strokeStyle='#72908b';context.lineWidth=14;context.strokeRect(9,9,750,174);
    context.fillStyle='#435c58';context.font='bold 48px sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillText(text,384,98,720);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const object=new THREE.Mesh(new THREE.BoxGeometry(width,1,.14),new THREE.MeshStandardMaterial({map:texture,roughness:.85}));object.position.set(x,y,z);root.add(object);
  }
  const pathVertices=[],pathIndices=[],edges=[],across=8,half=SUMMIT.pathWidth/2;
  const pavedTrail=MOUNTAIN_TRAIL.slice(0,MOUNTAIN_PAVING_END+1);
  pavedTrail.forEach((p,index)=>{
    const before=pavedTrail[Math.max(0,index-1)],after=pavedTrail[Math.min(pavedTrail.length-1,index+1)];
    const dx=after.x-before.x,dz=after.z-before.z,length=Math.hypot(dx,dz),normal={x:dz/length,z:-dx/length};
    const rowEdges=[];
    for(let column=0;column<=across;column++){
      const offset=(column/across-.5)*SUMMIT.pathWidth,x=p.x+normal.x*offset,z=Math.min(MOUNTAIN_TRAIL[0].z,p.z+normal.z*offset);
      const y=mountainWalkHeight(x,z)??p.y;pathVertices.push(x,y,z);
      if(column===0||column===across)rowEdges.push({x,y,z});
    }
    edges.push(rowEdges);
    if(index<pavedTrail.length-1)for(let column=0;column<across;column++){
      const i=index*(across+1)+column;pathIndices.push(i,i+across+1,i+1,i+1,i+across+1,i+across+2);
    }
  });
  const pathGeometry=new THREE.BufferGeometry();pathGeometry.setAttribute('position',new THREE.Float32BufferAttribute(pathVertices,3));pathGeometry.setIndex(pathIndices);pathGeometry.computeVertexNormals();
  const pathMaterial=new THREE.MeshStandardMaterial({color:'#e2d2ae',roughness:.98,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-5});
  const path=new THREE.Mesh(pathGeometry,pathMaterial);path.name='Paved mountain spiral';path.receiveShadow=true;root.add(path);
  // The radial final steps are on the broad deck. A rounded landing joins it
  // to the spiral without folding a wide ribbon around an abrupt inner turn.
  const end=pavedTrail.at(-1),beforeEnd=pavedTrail.at(-2),endLength=Math.hypot(end.x-beforeEnd.x,end.z-beforeEnd.z);
  const forward={x:(end.x-beforeEnd.x)/endLength,z:(end.z-beforeEnd.z)/endLength};
  const landingVertices=[],landingIndices=[],rings=8,slices=40;
  for(let ring=0;ring<=rings;ring++)for(let slice=0;slice<=slices;slice++){
    const angle=-Math.PI/2+slice/slices*Math.PI,r=half*ring/rings;
    const x=end.x+r*(forward.x*Math.cos(angle)-forward.z*Math.sin(angle));
    const z=end.z+r*(forward.z*Math.cos(angle)+forward.x*Math.sin(angle));
    landingVertices.push(x,mountainWalkHeight(x,z)??SUMMIT_DECK.height,z);
    if(ring<rings&&slice<slices){const i=ring*(slices+1)+slice;landingIndices.push(i,i+1,i+slices+1,i+1,i+slices+2,i+slices+1);}
  }
  const landingGeometry=new THREE.BufferGeometry();landingGeometry.setAttribute('position',new THREE.Float32BufferAttribute(landingVertices,3));landingGeometry.setIndex(landingIndices);landingGeometry.computeVertexNormals();
  const landing=new THREE.Mesh(landingGeometry,pathMaterial);landing.receiveShadow=true;landing.name='Mountain trail landing';path.add(landing);

  const nearDeck=(x,z,padding=0)=>Math.abs(x-SUMMIT_DECK.x)<=SUMMIT_DECK.width/2+padding&&Math.abs(z-SUMMIT_DECK.z)<=SUMMIT_DECK.depth/2+padding;
  let lastRail=0,lastRailDistance=0,lastMarker=0,traveled=0;
  for(let i=1;i<pavedTrail.length;i++){
    const p=pavedTrail[i],previous=pavedTrail[i-1];traveled+=Math.hypot(p.x-previous.x,p.z-previous.z);
    // A pale border makes the paving legible against both snow and rock.
    for(let side=0;side<2;side++){
      const a=edges[i-1][side],b=edges[i][side];
      if(!nearDeck(b.x,b.z))beam([a.x,a.y+.035,a.z],[b.x,b.y+.035,b.z],.055,'#f9edcb');
    }
    if(traveled-lastRailDistance>=3.8||i===pavedTrail.length-1){
      for(let side=0;side<2;side++){
        const a=edges[lastRail===0?0:lastRail][side],b=edges[i][side];
        if(p.z<75&&!nearDeck(a.x,a.z,1)&&!nearDeck(b.x,b.z,1)){
          beam([a.x,a.y+1.2,a.z],[b.x,b.y+1.2,b.z],.075,'#718f89');
          beam([a.x,a.y+.59,a.z],[b.x,b.y+.59,b.z],.045,'#a8b9a0');
          box('#718f89',b.x,b.y+.65,b.z,.14,1.3,.14);
        }
      }
      lastRail=i;lastRailDistance=traveled;
    }
    if(traveled-lastMarker>52&&p.y<68){
      const a=edges[i][0];box('#a7916e',a.x,a.y+.85,a.z,.18,1.7,.18);box('#eacf83',a.x,a.y+1.65,a.z,.75,.28,.25);lastMarker=traveled;
    }
  }
  const deck=new THREE.Mesh(new THREE.BoxGeometry(SUMMIT_DECK.width,.48,SUMMIT_DECK.depth),material('#b7a080'));
  deck.name='Mountain summit deck';deck.position.set(SUMMIT_DECK.x,SUMMIT_DECK.height-.24,SUMMIT_DECK.z);deck.receiveShadow=true;deck.castShadow=true;root.add(deck);
  for(let x=SUMMIT_DECK.x-7.7;x<SUMMIT_DECK.x+8;x+=.55)box('#e4d3b2',x,SUMMIT_DECK.height+.008,SUMMIT_DECK.z,.51,.016,13.7);
  for(const rail of SUMMIT_RAILS){
    const {x1,z1,x2,z2}=rail,count=Math.ceil(Math.hypot(x2-x1,z2-z1)/2);
    beam([x1,72+1.22,z1],[x2,72+1.22,z2],.09,'#718f89');
    beam([x1,72+.58,z1],[x2,72+.58,z2],.055,'#a8b9a0');
    for(let i=0;i<=count;i++)box('#718f89',x1+(x2-x1)*i/count,72+.65,z1+(z2-z1)*i/count,.16,1.3,.16);
  }
  for(const [x,z] of [[98.65,2.4],[109.35,-1]]){
    box('#b69064',x,72+.55,z,1.1,.18,3.2);box('#b69064',x+(x<104?-.42:.42),72+1.12,z,.18,1.05,3.2);
    for(const dz of [-1.15,1.15])box('#718f89',x,72+.26,z+dz,.75,.52,.15);
  }
  const telescope={x:109.3,z:5};
  instance('cylinder','#718f89',telescope.x,72+.8,telescope.z,.13,1.6,.13);
  instance('cylinder','#d4c9a6',telescope.x,72+.09,telescope.z,.55,.18,.55);
  beam([telescope.x,72+1.72,telescope.z],[telescope.x-.35,72+1.92,telescope.z+1.15],.24,'#739f9e');
  sign('MOUNTAIN SUMMIT · 72 m',104,73.1,7.8,6.5);
  sign('SUMMIT TRAIL  ↑',98,1.4,78,5);
  for(const {shape,color,matrices} of batches.values()){
    const mesh=new THREE.InstancedMesh(geometries[shape],material(color),matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();root.add(mesh);
  }
  return root;
}
