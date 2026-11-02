/** Shared geographic plan. +x is east, +z is south; all lengths are block units. */
export const WORLD = Object.freeze({width:1040,depth:690,minX:-320,minZ:-90,margin:2});
export const RIVER = Object.freeze({startZ:-80,endZ:440,width:14});
export const riverX = z => 240 + 6*Math.sin((z-80)/60);
export const riverWidth = z => 14 + 20*Math.max(0,Math.min(1,(z-354)/52));
export const BRIDGES = Object.freeze([
  {id:'north-bridge',name:'North bridge',z:126},
  {id:'market-bridge',name:'Market bridge',z:210},
  {id:'coast-bridge',name:'Coast bridge',z:286},
].map(b=>Object.freeze({...b,x:riverX(b.z),width:16,span:48,height:.7})));
export const HILL = Object.freeze({x:130,z:341,radius:34,plateau:14.5,height:12,pathWidth:12.4});
export const DECK = Object.freeze({x:130,z:341,width:22,depth:18,height:12.28,entranceWidth:14.6});
export const HILL_TRAIL = [[130,307],[121,313],[112,321],[113,326],[121,325],[130,326],[130,333],[130,341]];
export const COAST = Object.freeze({beachStart:377,seaStart:398,seaEnd:1000});
export const WATER_PLAY = Object.freeze({xMin:18,xMax:212,shoreZ:398,deepZ:660,beachZ:379,spawn:Object.freeze({x:160,z:410}),waterY:.045,maxDepth:18,depthRamp:120});
export const MOUNTAINS = Object.freeze({minZ:-65,maxZ:68,ridgeZ:18,height:74});
export const PARK_OFFSET = Object.freeze({x:112,z:70});
export const FIELD_OFFSET = Object.freeze({x:112,z:70});
