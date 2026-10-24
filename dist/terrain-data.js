/** Shared terrain surface: rendering and walking use this exact height field. */
export const HILL = Object.freeze({ x:100, z:212, radius:32, plateau:9, height:12 });
export const DECK = Object.freeze({ x:100, z:212, width:14, depth:12, height:12.28 });
export const RIVER = Object.freeze({ startZ:181, endZ:247, width:8, bridgeZ:190, bridgeWidth:10, bridgeSpan:29 });
export const HILL_TRAIL = [[100,178],[91,184],[82,195],[83,201],[91,201],[100,202],[100,208],[100,212]];
export const riverX = z => 170 + 7*Math.sin((z-173)/20);

export function hillHeight(x,z){
  const radius=Math.hypot(x-HILL.x,z-HILL.z);
  if(radius>=HILL.radius)return 0;
  if(radius<=HILL.plateau)return HILL.height;
  const t=(radius-HILL.plateau)/(HILL.radius-HILL.plateau);
  return HILL.height*(1-t*t*(3-2*t));
}
export function groundHeight(x,z){
  let height=hillHeight(x,z);
  if(Math.abs(x-DECK.x)<=DECK.width/2 && Math.abs(z-DECK.z)<=DECK.depth/2)height=DECK.height;
  const bx=riverX(RIVER.bridgeZ);
  if(Math.abs(z-RIVER.bridgeZ)<=RIVER.bridgeWidth/2 && Math.abs(x-bx)<RIVER.bridgeSpan/2){
    height=Math.max(height,.6*Math.min(1,(RIVER.bridgeSpan/2-Math.abs(x-bx))/4));
  }
  return height;
}

export const HILL_LANDMARK={id:'hill',name:'Hill trail',description:'Follow the winding path up to the lookout.',x:100,z:205,radius:37,arrival:{x:100,z:178}};
export const LOOKOUT_LANDMARK={id:'lookout',name:'Scenic deck',description:'You made it! Turn the camera for a view of the whole town.',x:100,z:212,radius:8,arrival:{x:100,z:211}};
export const RIVER_LANDMARK={id:'river',name:'River walk',description:'Follow the water and cross the little wooden bridge.',x:riverX(190),z:190,radius:31,arrival:{x:150,z:190}};
export const HILL_TREES=[.12,.75,1.24,1.98,2.65,3.35,4.55,5.5].map((angle,index)=>({x:100+Math.cos(angle)*(25+index%3),z:212+Math.sin(angle)*(25+index%3),height:4.5+index%3*.6,radius:1.8}));

const water=[];
for(let z=RIVER.startZ;z<RIVER.endZ;z+=1){
  if(z>=RIVER.bridgeZ-RIVER.bridgeWidth/2 && z<RIVER.bridgeZ+RIVER.bridgeWidth/2)continue;
  const cx=riverX(z+.5);
  water.push({id:`river-${z}`,kind:'water',x:cx-RIVER.width/2,z,w:RIVER.width,d:1});
}
const bx=riverX(RIVER.bridgeZ);
export const TERRAIN_OBSTACLES=[
  ...water,
  // The lookout has a generous north entrance, even for Five-wide Fifteen.
  {id:'deck-west',kind:'rail',x:92.9,z:205.9,w:.2,d:12.2},
  {id:'deck-east',kind:'rail',x:106.9,z:205.9,w:.2,d:12.2},
  {id:'deck-south',kind:'rail',x:92.9,z:217.9,w:14.2,d:.2},
  {id:'deck-north-west',kind:'rail',x:92.9,z:205.9,w:3.7,d:.2},
  {id:'deck-north-east',kind:'rail',x:103.4,z:205.9,w:3.7,d:.2},
  {id:'bridge-north',kind:'rail',x:bx-14.5,z:184.7,w:29,d:.2},
  {id:'bridge-south',kind:'rail',x:bx-14.5,z:195.1,w:29,d:.2},
  ...HILL_TREES.map((tree,index)=>({...tree,id:`hill-tree-${index}`,kind:'tree'})),
];
