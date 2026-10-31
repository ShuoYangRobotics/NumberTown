import { MOUNTAINS, riverX } from './geography.js';

const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
export const SUMMIT=Object.freeze({x:104,z:1,height:72,pathWidth:9.6,shoulderWidth:7.4,turns:1.5});
export const SUMMIT_DECK=Object.freeze({x:104,z:1,width:16,depth:14,height:72});
const halfWidth=SUMMIT.pathWidth/2;

// Height follows the shrinking radius, so each turn climbs a conical hillside
// instead of reaching summit height while it is still far from the peak.
const raw=[],startAngle=.5;
const sx=SUMMIT.x+56*Math.sin(startAngle),sz=SUMMIT.z+56*Math.cos(startAngle);
const tx=56*Math.cos(startAngle)*3*Math.PI-48*Math.sin(startAngle);
const tz=-56*Math.sin(startAngle)*3*Math.PI-48*Math.cos(startAngle),tl=Math.hypot(tx,tz);
const controls=[[104,79],[104,65],[sx-tx/tl*18,sz-tz/tl*18],[sx,sz]];
for(let i=0;i<=100;i++){
  const t=i/100,u=1-t,weights=[u**3,3*u*u*t,3*u*t*t,t**3];
  raw.push({x:controls.reduce((sum,p,index)=>sum+p[0]*weights[index],0),z:controls.reduce((sum,p,index)=>sum+p[1]*weights[index],0),y:0});
}
for(let i=1;i<=700;i++){
  const t=i/700,r=56-48*t,a=startAngle+3*Math.PI*t;
  raw.push({x:SUMMIT.x+r*Math.sin(a),z:SUMMIT.z+r*Math.cos(a),y:SUMMIT.height*smooth(t)});
}
const last=raw.at(-1);
export const MOUNTAIN_PAVING_END=raw.length-1;
for(let i=1;i<=16;i++)raw.push({x:last.x+(SUMMIT.x-last.x)*i/16,z:last.z+(SUMMIT.z-last.z)*i/16,y:SUMMIT.height});
const distances=[0];
for(let i=1;i<raw.length;i++)distances.push(distances[i-1]+Math.hypot(raw[i].x-raw[i-1].x,raw[i].z-raw[i-1].z));
const length=distances.at(-1);
export const MOUNTAIN_TRAIL=Object.freeze(raw.map(p=>Object.freeze({...p})));
export const MOUNTAIN_TRAIL_LANDMARK=Object.freeze({id:'mountain-trail',name:'Mountain trail',description:'Follow the paved spiral all the way to the high summit.',x:104,z:76,radius:16,arrival:Object.freeze({x:104,z:79})});
export const SUMMIT_LANDMARK=Object.freeze({id:'summit',name:'Mountain summit',description:'Rest above the town and enjoy the mountain panorama.',x:SUMMIT.x,z:SUMMIT.z,radius:11,arrival:Object.freeze({x:SUMMIT.x,z:SUMMIT.z})});
export const SUMMIT_OBSTACLES=Object.freeze([
  {id:'summit-west-bench',kind:'furniture',x:98.1,z:.8,w:1.1,d:3.2},
  {id:'summit-east-bench',kind:'furniture',x:108.8,z:-2.6,w:1.1,d:3.2},
  {id:'summit-telescope',kind:'furniture',x:109.3,z:5,radius:.75},
].map(Object.freeze));

const bounds={minX:Math.min(...raw.map(p=>p.x))-halfWidth,maxX:Math.max(...raw.map(p=>p.x))+halfWidth,minZ:Math.min(...raw.map(p=>p.z))-halfWidth,maxZ:79};
const segments=MOUNTAIN_TRAIL.slice(0,-1).map((a,index)=>{
  const b=MOUNTAIN_TRAIL[index+1],dx=b.x-a.x,dz=b.z-a.z;
  return {a,b,dx,dz,squared:dx*dx+dz*dz,index};
});
const bucketSize=8,buckets=new Map(),reach=halfWidth+SUMMIT.shoulderWidth+1;
for(const segment of segments){
  const {a,b}=segment;
  for(let x=Math.floor((Math.min(a.x,b.x)-reach)/bucketSize);x<=Math.floor((Math.max(a.x,b.x)+reach)/bucketSize);x++){
    for(let z=Math.floor((Math.min(a.z,b.z)-reach)/bucketSize);z<=Math.floor((Math.max(a.z,b.z)+reach)/bucketSize);z++){
      const key=`${x},${z}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(segment);
    }
  }
}
const withinBounds=(x,z,padding=0)=>Number.isFinite(x)&&Number.isFinite(z)&&x>=bounds.minX-padding&&x<=bounds.maxX+padding&&z>=bounds.minZ-padding&&z<=bounds.maxZ+padding;
function project(x,z,nearbyOnly=false){
  const candidates=buckets.get(`${Math.floor(x/bucketSize)},${Math.floor(z/bucketSize)}`);
  if(!candidates&&nearbyOnly)return null;
  let best=null,bestSquared=Infinity;
  for(const segment of candidates||segments){
    const {a,b,dx,dz,squared,index}=segment,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/squared),px=a.x+dx*t,pz=a.z+dz*t;
    const d=(x-px)**2+(z-pz)**2;
    if(d<bestSquared){bestSquared=d;best={x:px,y:a.y+(b.y-a.y)*t,z:pz,distance:Math.sqrt(d),progress:(distances[index]+Math.sqrt(squared)*t)/length,index,t};}
  }
  return best;
}
export const nearestTrailPoint=(x,z)=>project(x,z);
export const mountainProgress=(x,z)=>nearestTrailPoint(x,z)?.progress??0;
function insideDeck(x,z,inset=0){return Math.abs(x-SUMMIT_DECK.x)<=SUMMIT_DECK.width/2-inset&&Math.abs(z-SUMMIT_DECK.z)<=SUMMIT_DECK.depth/2-inset;}
function insideFootprint(x,z,inset=0){
  if(insideDeck(x,z,inset))return true;
  if(!withinBounds(x,z))return false;
  return project(x,z,true)?.distance<=halfWidth-inset;
}
export function isOnMountainRoute(x,z,radius=0){
  if(!withinBounds(x,z,radius))return false;
  const edgeMargin=radius>0?.12:0;
  if(insideDeck(x,z,radius+edgeMargin))return true;
  const nearest=project(x,z,true);
  if(!nearest)return false;
  // Away from the deck, erosion of the centerline corridor gives a safe
  // footprint without repeatedly projecting its circumference every frame.
  if(nearest.distance+radius<=halfWidth-edgeMargin&&z+radius<=bounds.maxZ)return true;
  if(!insideFootprint(x,z,edgeMargin))return false;
  if(radius<=0)return true;
  for(let i=0;i<24;i++)if(!insideFootprint(x+Math.cos(i*Math.PI/12)*radius,z+Math.sin(i*Math.PI/12)*radius,edgeMargin))return false;
  return true;
}
export function mountainWalkHeight(x,z){
  if(insideDeck(x,z))return SUMMIT_DECK.height;
  if(!withinBounds(x,z))return null;
  const nearest=project(x,z,true);
  return nearest&&nearest.distance<=halfWidth?nearest.y:null;
}

const peaks=[[-75,4,64,90,76],[20,12,68,78,70],[104,1,74,76,79],[177,14,70,67,70],[304,5,74,76,79],[382,16,71,74,70],[478,0,74,94,83],[565,12,65,80,70]];
export function baseMountainHeight(x,z){
  let y=13+5*Math.sin(x*.027+.3)**2;
  for(const [px,pz,h,rx,rz] of peaks){const r=Math.hypot((x-px)/rx,(z-pz)/rz);if(r<1)y=Math.max(y,h*Math.pow(1-r,.69));}
  y*=.94+.06*Math.sin(x*.67+z*.19)*Math.cos(z*.47-x*.13);
  y*=smooth((MOUNTAINS.maxZ-z)/22);
  const gorge=smooth((Math.abs(x-riverX(z))-10)/14),backWall=smooth((-52-z)/13);
  return Math.max(0,y*(gorge+(1-gorge)*backWall));
}
export function mountainHeight(x,z){
  const original=baseMountainHeight(x,z);
  const radius=Math.hypot(x-SUMMIT.x,z-SUMMIT.z);
  const cone=SUMMIT.height*(1-smooth((radius-8)/48));
  const peakBlend=1-smooth((radius-50)/32);
  let result=original+(cone-original)*peakBlend;
  if(!withinBounds(x,z,SUMMIT.shoulderWidth))return result;
  const dx=Math.max(0,Math.abs(x-SUMMIT_DECK.x)-SUMMIT_DECK.width/2-1.2);
  const dz=Math.max(0,Math.abs(z-SUMMIT_DECK.z)-SUMMIT_DECK.depth/2-1.2);
  const deckBlend=1-smooth(Math.hypot(dx,dz)/3);
  result+=(SUMMIT_DECK.height-.12-result)*deckBlend;
  const nearest=project(x,z,true);
  if(nearest){
    const blend=1-smooth((nearest.distance-halfWidth-1.4)/6);
    if(blend>0)result+=(Math.max(0,nearest.y-.12)-result)*blend;
  }
  // The platform sits on a broad stone summit, rather than on stilts.
  return insideDeck(x,z)?SUMMIT_DECK.height-.12:result;
}
