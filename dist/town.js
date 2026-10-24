// A tiny hand-crafted toy town. All positions are world-space coordinates.
export const WORLD = { width: 1750, height: 1500, cornerRadius: 115, edgeInset: 18, spawn: { x: 550, y: 650 } };
export const project = (x, y, z = 0) => ({ x: (x - y) * 0.9, y: (x + y) * 0.45 - z });
export const obstacles = [];
export const townObjects = [];
export const LANDMARKS = [
  { id:'town-square', name:'Town square', x:1225, y:955, radius:205, description:'Meet your friends in the heart of town.', arrival:{x:1150,y:950} },
  { id:'library', name:'Town library', x:1310, y:425, radius:190, description:'A whole world of stories to discover.', arrival:{x:1280,y:570} },
  { id:'garden', name:'Fountain garden', x:550, y:430, radius:155, description:'Listen to the fountain and count the flowers.', arrival:{x:550,y:540} },
  { id:'pond', name:'Duck pond', x:810, y:827, radius:150, description:'A quiet little pond with a friendly duck.', arrival:{x:810,y:940} }
];
export const FRIEND_STARTS = [WORLD.spawn,{x:460,y:565},{x:670,y:565},{x:380,y:715},{x:730,y:725},
  {x:1190,y:1080},{x:1320,y:560},{x:1450,y:690},{x:1320,y:1170},{x:1050,y:1010}];

const P = project;
const TAU = Math.PI * 2;
function poly(ctx, points, fill, stroke, width = 1) {
  ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke(); }
}
function wp(ctx, points, fill, stroke, width = 1) { poly(ctx, points.map(p => P(...p)), fill, stroke, width); }
function rect(ctx, x, y, w, d, color, z = 0, stroke) { wp(ctx, [[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z]],color,stroke); }
function ellipse(ctx, x, y, rx, ry, fill, stroke, line = 1) {
  ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,TAU);
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}
}
function groundEllipse(ctx, x, y, r, color, z = 0) { const p=P(x,y,z); ellipse(ctx,p.x,p.y,r*1.27,r*.636,color); }
function line(ctx, pts, color, width = 3) {
  ctx.beginPath(); pts.map(p => P(...p)).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();
}
function object(x,y,draw) { townObjects.push({x,y,draw(ctx,time=0){ctx.save();draw(ctx,time);ctx.restore();}}); }
function rand(n) { const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v); }
function island(ctx,z=0) {
  const r=WORLD.cornerRadius, min=WORLD.edgeInset, maxX=WORLD.width-min,maxY=WORLD.height-min;
  const corners=[[maxX-r,min+r,-Math.PI/2],[maxX-r,maxY-r,0],[min+r,maxY-r,Math.PI/2],[min+r,min+r,Math.PI]];
  ctx.beginPath();let first=true;
  for(const [x,y,start] of corners) for(let i=0;i<=12;i++) {
    const a=start+i/12*Math.PI/2;const p=P(x+Math.cos(a)*r,y+Math.sin(a)*r,z);
    if(first){ctx.moveTo(p.x,p.y);first=false;}else ctx.lineTo(p.x,p.y);
  }
  ctx.closePath();
}
const roadRects = [
  [506,145,88,780], [115,606,875,88], [187,255,745,70],
  [207,195,58,110], [552,170,58,120], [850,210,58,90],
  [177,515,55,125], [845,630,72,45], [305,676,55,160],
  // The old neighborhood flows into an east avenue and a larger civic district.
  [590,606,1050,88], [930,255,710,70], [506,910,88,500],
  [1276,525,88,300], [1276,1100,88,310], [1600,255,70,1160],
  [550,965,530,70], [550,1126,1090,88], [550,1380,1090,45],
  [995,530,65,95], [1020,235,55,55], [1310,210,55,80],
  [1490,505,60,120], [1430,930,210,60], [1510,890,55,65],
  [800,1360,55,40], [1120,1360,55,40], [1480,1350,55,50]
];
function road(ctx,x,y,w,d){rect(ctx,x-9,y-9,w+18,d+18,'#b5c28c',1);rect(ctx,x-5,y-5,w+10,d+10,'#f0e3c5',2);rect(ctx,x,y,w,d,'#cccdb9',2.5);}

export function drawGround(ctx,time=0) {
  ctx.save();
  island(ctx,-31);ctx.fillStyle='#bda986';ctx.shadowColor='rgba(46,67,51,.12)';ctx.shadowBlur=30;ctx.shadowOffsetY=18;ctx.fill();
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  island(ctx,-19);ctx.fillStyle='#cfbf95';ctx.fill();
  island(ctx,-7);ctx.fillStyle='#83b77b';ctx.fill();
  island(ctx,0);ctx.fillStyle='#b8d99b';ctx.fill();
  // Subtle, irregular grass creates a soft felt-like play mat.
  ctx.save();island(ctx,0);ctx.clip();
  for(let i=0;i<Math.ceil(WORLD.width*WORLD.height/7857);i++){
    const x=rand(i*3)*WORLD.width,y=rand(i*3+1)*WORLD.height,r=18+rand(i*3+2)*55;
    groundEllipse(ctx,x,y,r,i%3===0?'rgba(239,242,192,.13)':'rgba(100,157,101,.035)');
  }
  for(let i=0;i<Math.ceil(WORLD.width*WORLD.height/2340);i++){
    const x=45+rand(i*5)*(WORLD.width-90),y=45+rand(i*5+1)*(WORLD.height-90);
    const p=P(x,y);const s=2+rand(i*5+2)*2.4;
    ctx.strokeStyle=i%3?'#99c384':'#cce3ad';ctx.lineWidth=1.5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(p.x-s,p.y);ctx.lineTo(p.x-s*.5,p.y-s);ctx.moveTo(p.x,p.y+.8);ctx.lineTo(p.x+s*.45,p.y-s*.8);ctx.stroke();
  }
  ctx.restore();
  roadRects.forEach(r=>road(ctx,...r));
  // Joined road interiors remove seams where paths meet.
  roadRects.forEach(r=>rect(ctx,...r,'#cccdb9',3));
  for(let y=330;y<910;y+=52) if(y<365||y>495) rect(ctx,548,y,4,22,'#faf6df',3.2);
  for(let x=135;x<985;x+=52) if(Math.abs(x-550)>58) rect(ctx,x,648,23,4,'#faf6df',3.2);
  for(let x=210;x<920;x+=50) if(Math.abs(x-550)>50) rect(ctx,x,289,22,3,'#f4efdc',3.2);
  for(let x=1025;x<1600;x+=52) if(Math.abs(x-1320)>57) rect(ctx,x,648,23,4,'#faf6df',3.2);
  for(let x=975;x<1610;x+=52) rect(ctx,x,289,22,3,'#faf6df',3.2);
  for(let y=1060;y<1370;y+=52) if(y<1110||y>1220) rect(ctx,548,y,4,22,'#faf6df',3.2);
  for(let x=615;x<1590;x+=52) if(Math.abs(x-1320)>55) rect(ctx,x,1168,23,4,'#faf6df',3.2);
  drawTownSquare(ctx);
  // A warm stone forecourt and a tiny reading garden welcome library visitors.
  rect(ctx,1160,508,295,73,'#aabf91',1);
  rect(ctx,1166,510,283,65,'#f1e3c8',3);
  for(let x=1170;x<1440;x+=28) line(ctx,[[x,512,3.2],[x,572,3.2]],'#dfd1b8',1);
  // A paved square and its alternating cobblestone border.
  groundEllipse(ctx,550,430,101,'#a9bd8d',3);
  groundEllipse(ctx,550,430,96,'#f2e6cc',3.5);
  groundEllipse(ctx,550,430,85,'#e8dcc1',4);
  for(let i=0;i<24;i++){
    const a=i/24*TAU;line(ctx,[[550+Math.cos(a)*86,430+Math.sin(a)*86,4.2],[550+Math.cos(a)*96,430+Math.sin(a)*96,4.2]],'#d3c5aa',1.6);
  }
  drawPond(ctx,time);
  // Pebbles on the paths and lawn, deliberately sparse.
  for(const [x,y] of [[390,557],[410,558],[400,544],[693,761],[710,760],[701,775],[316,360],[330,365]])groundEllipse(ctx,x,y,5,'#aab58e',1);
  ctx.restore();
}

function wall(ctx,x,y,axis,draw){const p=P(x,y);ctx.save();ctx.transform(axis==='x'?.9:-.9,.45,0,-1,p.x,p.y);draw();ctx.restore();}
function arch(ctx,x,z,w,h,color,stroke){
  const r=w/2;ctx.beginPath();ctx.moveTo(x,z);ctx.lineTo(x+w,z);ctx.lineTo(x+w,z+h-r);ctx.bezierCurveTo(x+w,z+h+r*.3,x,z+h+r*.3,x,z+h-r);ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=4;ctx.stroke();}
}
function windowOn(ctx,x,z,w=28,h=34,flowers=false){
  ctx.fillStyle='#fff7df';ctx.beginPath();ctx.roundRect(x-4,z-4,w+8,h+8,3);ctx.fill();
  ctx.fillStyle='#82bec7';ctx.beginPath();ctx.roundRect(x,z,w,h,2);ctx.fill();
  ctx.fillStyle='#aedce0';ctx.beginPath();ctx.moveTo(x+2,z+2);ctx.lineTo(x+w-2,z+h-2);ctx.lineTo(x+2,z+h-2);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#fff7df';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+w/2,z);ctx.lineTo(x+w/2,z+h);ctx.moveTo(x,z+h/2);ctx.lineTo(x+w,z+h/2);ctx.stroke();
  if(flowers){ctx.fillStyle='#b27651';ctx.fillRect(x-7,z-12,w+14,10);ctx.fillStyle='#dc9672';ctx.fillRect(x-8,z-6,w+16,5);for(let i=0;i<4;i++){ellipse(ctx,x+i*w/3,z-2,5,7,'#76a869');ellipse(ctx,x+i*w/3,z+3,4,4,i%2?'#f7cc5e':'#ef96a1');}}
}
const homes=[
  {x:150,y:100,w:150,d:123,h:105,roof:60,front:'#fff0d5',side:'#e9d9b9',roofA:'#e77965',roofB:'#c95f56',door:'#77a49f',accent:'#e58a73',name:'1'},
  {x:500,y:83,w:148,d:126,h:117,roof:59,front:'#f7e9b8',side:'#e4d398',roofA:'#e5b14f',roofB:'#ce963c',door:'#79a59b',accent:'#dcaa48',name:'2'},
  {x:805,y:119,w:145,d:123,h:110,roof:62,front:'#e5f0df',side:'#c9deca',roofA:'#70aca4',roofB:'#518c88',door:'#e69b79',accent:'#78aca3',name:'3'},
  {x:100,y:410,w:146,d:125,h:112,roof:58,front:'#f5ddd9',side:'#dfc0bb',roofA:'#ad94ba',roofB:'#8d77a2',door:'#78aaa4',accent:'#a08caf',name:'4'},
  {x:840,y:480,w:143,d:125,h:119,roof:60,front:'#fff0d6',side:'#e6d5b8',roofA:'#dd866e',roofB:'#bd6b58',door:'#91ad8a',accent:'#d88c75',name:'5'},
  {x:249,y:808,w:139,d:118,h:102,roof:57,front:'#e0eeeb',side:'#bed9d3',roofA:'#7aa9c0',roofB:'#5a8da5',door:'#e2b466',accent:'#82aabd',name:'6'}
  ,{x:965,y:110,w:150,d:123,h:107,roof:56,front:'#ffead2',side:'#e4ceb0',roofA:'#dc8b83',roofB:'#bd706c',door:'#8cb6aa',accent:'#d68a7d',label:'BAKERY',name:'7'}
  ,{x:1260,y:85,w:151,d:126,h:115,roof:59,front:'#f0e7f6',side:'#d5c7df',roofA:'#9a9ac3',roofB:'#797ca7',door:'#a5bd91',accent:'#a3a1c5',name:'8'}
  ,{x:980,y:400,w:150,d:133,h:117,roof:57,front:'#e9f0da',side:'#ccd9b9',roofA:'#7eab8a',roofB:'#608c70',door:'#d9ad72',accent:'#88ad87',label:'BOOKSHOP',name:'9'}
  ,{x:1455,y:370,w:142,d:136,h:116,roof:58,front:'#fff1d0',side:'#e3d1a9',roofA:'#e4b56e',roofB:'#c5964e',door:'#a3b5bf',accent:'#e2b278',name:'10'}
  ,{x:1465,y:765,w:139,d:126,h:110,roof:55,front:'#f9e5df',side:'#dec6c0',roofA:'#8baeb9',roofB:'#6d8f9a',door:'#d0a379',accent:'#8facb5',label:'CAFÉ',name:'11'}
  ,{x:710,y:1235,w:210,d:128,h:123,roof:62,front:'#fff0bf',side:'#e6d5a4',roofA:'#d78f70',roofB:'#b77157',door:'#87aaa0',accent:'#dba07d',label:'LITTLE SCHOOL',name:'12'}
  ,{x:1050,y:1245,w:151,d:124,h:109,roof:58,front:'#e7efdc',side:'#c9d9bb',roofA:'#8bad91',roofB:'#6a9175',door:'#dfa980',accent:'#99b395',name:'13'}
  ,{x:1415,y:1225,w:149,d:126,h:112,roof:60,front:'#f3e5ef',side:'#dac7d8',roofA:'#b090b7',roofB:'#917299',door:'#9ab4a4',accent:'#b39ab9',name:'14'}
];
function house(h){
  const {x,y,w,d,h:height,roof:r}=h;
  obstacles.push({x:x-5,y:y-5,w:w+10,d:d+10});
  object(x+w*.65,y+d*.65,(ctx)=>{
    // Broad, soft contact shadow and a little raised stone foundation.
    const sh=P(x+w*.6,y+d*.64);ellipse(ctx,sh.x,sh.y+6,w*.86,d*.54,'rgba(63,92,62,.15)');
    rect(ctx,x-7,y-7,w+14,d+14,'#c1b898',4);
    wp(ctx,[[x,y+d,4],[x+w,y+d,4],[x+w,y+d,height],[x,y+d,height]],h.front,'rgba(98,92,72,.09)');
    wp(ctx,[[x+w,y,4],[x+w,y+d,4],[x+w,y+d,height],[x+w,y,height]],h.side,'rgba(98,92,72,.09)');
    wp(ctx,[[x,y+d,height],[x+w,y+d,height],[x+w/2,y+d,height+r-5]],h.front);
    // Raised cream corner trims make each house feel like a wooden toy.
    line(ctx,[[x,y+d,7],[x,y+d,height-2]],'#fff8e8',5);
    line(ctx,[[x+w,y+d,7],[x+w,y+d,height-2]],'#fff8e8',5);
    line(ctx,[[x+w,y,7],[x+w,y,height-2]],'#f2e8d1',4);
    line(ctx,[[x,y+d,14],[x+w,y+d,14]],'#e0d5bd',5);
    line(ctx,[[x+w,y,14],[x+w,y+d,14]],'#cfbea2',5);
    wall(ctx,x,y+d+.5,'x',()=>{
      arch(ctx,w*.43,5,35,63,h.door,'#fff9e7');
      arch(ctx,w*.43+7,38,21,23,'#bce0df');
      ellipse(ctx,w*.43+28,27,2.8,2.8,'#f9d57d');
      windowOn(ctx,18,45,25,31,true);windowOn(ctx,w-47,45,25,31,true);
      ellipse(ctx,w/2,height+20,14,14,'#fff8e8');ellipse(ctx,w/2,height+20,9,9,'#8dbcc3');
      ctx.strokeStyle='#fff8e8';ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(w/2-10,height+20);ctx.lineTo(w/2+10,height+20);ctx.moveTo(w/2,height+10);ctx.lineTo(w/2,height+30);ctx.stroke();
    });
    wall(ctx,x+w+.5,y,'y',()=>{windowOn(ctx,22,46,27,35,true);windowOn(ctx,d-48,46,26,35,true);});
    // Three cream doorstep slabs, visible just below the front door.
    rect(ctx,x+w*.43-7,y+d+3,49,22,'#b9ad91',3);
    rect(ctx,x+w*.43-5,y+d+1,45,15,'#f2e5c9',7);
    rect(ctx,x+w*.43-2,y+d,39,8,'#fff3d9',10);
    // Roof has a thickness, two large planes and simple tile seams.
    const oy=y-12,ey=y+d+13,lx=x-12,rx=x+w+12,mx=x+w/2;
    wp(ctx,[[lx,oy,height+3],[mx,oy,height+r+3],[mx,ey,height+r+3],[lx,ey,height+3]],h.roofA);
    wp(ctx,[[mx,oy,height+r+3],[rx,oy,height+3],[rx,ey,height+3],[mx,ey,height+r+3]],h.roofB);
    wp(ctx,[[lx,ey,height+3],[mx,ey,height+r+3],[rx,ey,height+3],[rx,ey,height-5],[mx,ey,height+r-5],[lx,ey,height-5]],h.roofA);
    line(ctx,[[lx,ey,height+4],[mx,ey,height+r+4],[rx,ey,height+4]],'#fff0d3',4);
    line(ctx,[[mx,oy,height+r+5],[mx,ey,height+r+5]],h.roofA,7);
    for(let i=1;i<5;i++){
      const yy=oy+(ey-oy)*i/5;
      line(ctx,[[mx+5,yy,height+r-1],[rx-5,yy,height+7]],'rgba(96,73,59,.12)',1.5);
    }
    // Squat chimney, with a cream cap and a dark opening.
    const cx=x+w*.75,cy=y+25,cz=height+r*.61;
    wp(ctx,[[cx,cy,cz],[cx+20,cy,cz],[cx+20,cy,cz+45],[cx,cy,cz+45]],'#c08269');
    wp(ctx,[[cx+20,cy,cz],[cx+20,cy+21,cz],[cx+20,cy+21,cz+45],[cx+20,cy,cz+45]],'#ae6e59');
    rect(ctx,cx-3,cy-3,26,27,'#e9be96',cz+45);rect(ctx,cx+3,cy+3,14,15,'#7d6659',cz+46);
    if(h.label) {
      const sign=P(x+w*.51,y+d+1,height-13);
      label(ctx,sign.x,sign.y,h.label,h.accent,h.label.length>10?122:108,12);
      // Soft striped canopies distinguish the little shops from the homes.
      if(h.label!=='LITTLE SCHOOL') for(let i=0;i<6;i++) {
        const sx=x+12+i*(w-24)/6,sw=(w-24)/6;
        wp(ctx,[[sx,y+d,92],[sx+sw,y+d,92],[sx+sw,y+d+19,78],[sx,y+d+19,78]],i%2?'#fff4df':h.accent);
        line(ctx,[[sx,y+d+19,77],[sx+sw,y+d+19,77]],i%2?'#fff4df':h.accent,5);
      }
    }
  });
}
homes.forEach(house);

function label(ctx,x,y,text,color='#789582',width=126,fontSize=13) {
  ctx.fillStyle='rgba(75,86,64,.13)';ctx.beginPath();ctx.roundRect(x-width/2+1,y-13,width,31,7);ctx.fill();
  ctx.fillStyle='#fff5df';ctx.beginPath();ctx.roundRect(x-width/2,y-16,width,30,7);ctx.fill();
  ctx.strokeStyle='#dfcba4';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle=color;ctx.font=`800 ${fontSize}px "Trebuchet MS", sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y);
}

function drawTownSquare(ctx) {
  rect(ctx,1027,797,421,326,'#9db78b',1);
  rect(ctx,1033,803,409,314,'#eee2c7',2);
  rect(ctx,1042,812,391,296,'#dfd4bb',3);
  for(let x=1044;x<1430;x+=35)for(let y=814;y<1106;y+=35) {
    rect(ctx,x,y,Math.min(33,1431-x),Math.min(33,1106-y),((x+y)/35|0)%3===0?'#e9dfc8':'#e4d8bf',3.2);
  }
  // A circular mosaic gives the clock its own little gathering space.
  groundEllipse(ctx,1225,955,94,'#f5ebd3',3.6);
  groundEllipse(ctx,1225,955,83,'#d2c5a9',3.7);
  groundEllipse(ctx,1225,955,78,'#ece2cb',3.8);
  for(let i=0;i<16;i++) {
    const a=i/16*TAU;
    line(ctx,[[1225+Math.cos(a)*84,955+Math.sin(a)*84,4],[1225+Math.cos(a)*94,955+Math.sin(a)*94,4]],'#cfbfa0',2);
  }
}

function library() {
  const x=1165,y=350,w=280,d=155,h=143,r=51;
  obstacles.push({x:x-5,y:y-5,w:w+10,d:d+10});
  object(x+w*.65,y+d*.65,ctx=>{
    const shadow=P(x+w*.6,y+d*.6);ellipse(ctx,shadow.x,shadow.y+12,235,86,'rgba(57,86,61,.14)');
    rect(ctx,x-8,y-8,w+16,d+16,'#b8b4a0',5);
    wp(ctx,[[x,y+d,5],[x+w,y+d,5],[x+w,y+d,h],[x,y+d,h]],'#f4edda');
    wp(ctx,[[x+w,y,5],[x+w,y+d,5],[x+w,y+d,h],[x+w,y,h]],'#d9ddcb');
    wp(ctx,[[x,y+d,h],[x+w,y+d,h],[x+w/2,y+d,h+r]],'#f4edda');
    for(const xx of [x+4,x+87,x+192,x+w-4])line(ctx,[[xx,y+d,8],[xx,y+d,h-3]],'#fff9e9',8);
    line(ctx,[[x,y+d,17],[x+w,y+d,17]],'#d9cfb4',8);
    line(ctx,[[x+w,y,17],[x+w,y+d,17]],'#bfc9b5',8);
    wall(ctx,x,y+d+.6,'x',()=>{
      arch(ctx,109,8,62,87,'#7a9f95','#fff9e8');
      arch(ctx,116,48,48,38,'#b7d9d7');
      ctx.strokeStyle='#fff8e5';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(140,48);ctx.lineTo(140,89);ctx.moveTo(140,10);ctx.lineTo(140,42);ctx.stroke();
      ellipse(ctx,132,32,2.5,2.5,'#e8cb83');ellipse(ctx,147,32,2.5,2.5,'#e8cb83');
      windowOn(ctx,20,37,52,61,true);windowOn(ctx,208,37,52,61,true);
      // Books peek through the generous library windows.
      for(const offset of [20,208])for(let i=0;i<5;i++){
        ctx.fillStyle=['#d7a17c','#d6bf7c','#83a9ab','#b8a3bf','#9eaf85'][i];ctx.fillRect(offset+4+i*9,40,6,13+(i%3)*3);
      }
    });
    wall(ctx,x+w+.5,y,'y',()=>{windowOn(ctx,26,43,40,56,true);windowOn(ctx,91,43,40,56,true);});
    rect(ctx,x+97,y+d+4,86,26,'#b2ad96',3);
    rect(ctx,x+101,y+d+2,78,20,'#dfd7bc',7);
    rect(ctx,x+105,y+d,70,13,'#fff2d5',11);
    const lx=x-13,rx=x+w+13,mx=x+w/2,oy=y-12,ey=y+d+14;
    wp(ctx,[[lx,oy,h+4],[mx,oy,h+r+4],[mx,ey,h+r+4],[lx,ey,h+4]],'#83aca7');
    wp(ctx,[[mx,oy,h+r+4],[rx,oy,h+4],[rx,ey,h+4],[mx,ey,h+r+4]],'#638f8c');
    wp(ctx,[[lx,ey,h+4],[mx,ey,h+r+4],[rx,ey,h+4],[rx,ey,h-3],[mx,ey,h+r-3],[lx,ey,h-3]],'#82a9a1');
    line(ctx,[[lx,ey,h+4],[mx,ey,h+r+4],[rx,ey,h+4]],'#fff0d5',5);
    for(let i=1;i<6;i++)line(ctx,[[mx+8,oy+i*(ey-oy)/6,h+r+1],[rx-7,oy+i*(ey-oy)/6,h+9]],'rgba(45,82,77,.14)',2);
    const sign=P(x+w/2,y+d+2,h-20);label(ctx,sign.x,sign.y,'TOWN LIBRARY','#547e78',166,15);
    // An open-book emblem in the gable makes the destination easy to recognize.
    const book=P(x+w/2,y+d+4,h+19);
    ellipse(ctx,book.x,book.y,24,21,'#e8d6a1');
    poly(ctx,[{x:book.x,y:book.y-9},{x:book.x-17,y:book.y-13},{x:book.x-17,y:book.y+9},{x:book.x,y:book.y+13}], '#fff9e7','#88a396',1.7);
    poly(ctx,[{x:book.x,y:book.y-9},{x:book.x+17,y:book.y-13},{x:book.x+17,y:book.y+9},{x:book.x,y:book.y+13}], '#f7edcc','#88a396',1.7);
    ctx.strokeStyle='#c4c6a5';ctx.lineWidth=1;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(book.x-13,book.y-5+i*5);ctx.lineTo(book.x-4,book.y-3+i*5);ctx.moveTo(book.x+4,book.y-3+i*5);ctx.lineTo(book.x+13,book.y-5+i*5);ctx.stroke();}
  });
}
library();

function tree(x,y,size=1,kind=0){
  obstacles.push({x:x-10,y:y-10,w:20,d:20});
  object(x,y,(ctx)=>{
    const p=P(x,y);ellipse(ctx,p.x+3,p.y+3,36*size,17*size,'rgba(61,104,64,.13)');
    const h=54*size;ctx.fillStyle='#ad8a62';ctx.beginPath();ctx.roundRect(p.x-6*size,p.y-h,12*size,h,4);ctx.fill();
    ctx.strokeStyle='#a07d55';ctx.lineWidth=5*size;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(p.x,p.y-29*size);ctx.lineTo(p.x-14*size,p.y-47*size);ctx.moveTo(p.x,p.y-33*size);ctx.lineTo(p.x+13*size,p.y-51*size);ctx.stroke();
    const colors=kind===1?['#d7b973','#e6ca83','#efda9b']:kind===2?['#8eb48b','#a9c79b','#bdd6ad']:['#6fa976','#85b980','#a1cb91'];
    ellipse(ctx,p.x+7*size,p.y-h-23*size,39*size,43*size,colors[0]);
    ellipse(ctx,p.x-19*size,p.y-h-19*size,29*size,34*size,colors[1]);
    ellipse(ctx,p.x+2*size,p.y-h-44*size,31*size,30*size,colors[1]);
    ellipse(ctx,p.x-8*size,p.y-h-48*size,20*size,18*size,colors[2]);
    ellipse(ctx,p.x+21*size,p.y-h-19*size,7*size,9*size,colors[1]);
    if(kind===0)for(const [u,v]of[[-25,-30],[16,-39],[9,-4]])ellipse(ctx,p.x+u*size,p.y-h+v*size,4*size,4*size,'#edb27a');
  });
}
[[90,155,1.08,0],[95,295,.94,2],[367,125,1.08,0],[420,170,.85,2],[735,110,1.08,1],[1080,350,1.1,0],[1130,375,.91,2],[735,350,.85,2],[330,448,.9,1],[80,720,1.03,0],[132,819,.82,2],[149,916,.8,0],[448,902,.75,2],[645,906,.98,0],[1001,745,1.1,1],[945,895,.9,0],[1020,914,.72,2]].forEach(t=>tree(...t));

function bush(x,y,s=1,flower=false){object(x,y,ctx=>{const p=P(x,y);ellipse(ctx,p.x,p.y+2,27*s,12*s,'rgba(74,112,60,.1)');ellipse(ctx,p.x+10*s,p.y-10*s,18*s,16*s,'#7faa73');ellipse(ctx,p.x-10*s,p.y-10*s,18*s,17*s,'#9bc588');ellipse(ctx,p.x,p.y-20*s,18*s,17*s,'#aed196');if(flower)for(const [u,v]of[[-15,-17],[3,-28],[17,-9]]){ellipse(ctx,p.x+u*s,p.y+v*s,4*s,4*s,'#f5cccf');ellipse(ctx,p.x+u*s,p.y+v*s,1.5*s,1.5*s,'#eac46c');}});}
[[120,377,1,true],[270,230,.8,true],[670,190,.8,false],[970,206,.85,true],[828,462,.85,true],[1000,613,.8,false],[241,936,.8,true],[400,838,.65,true],[700,730,.75,true],[660,355,.65,false],[330,540,.7,true]].forEach(v=>bush(...v));

function flowers(x,y,color='#f4c368',count=9){object(x,y,(ctx)=>{const p=P(x,y);for(let i=0;i<count;i++){const q=P(x+(rand(i+13)-.5)*52,y+(rand(i+73)-.5)*38),h=5+rand(i+3)*7;ctx.strokeStyle='#6fa26b';ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(q.x,q.y-h);ctx.stroke();ellipse(ctx,q.x,q.y-h,3.3,3.3,color);ellipse(ctx,q.x,q.y-h,1,1,'#fff4c1');}});}
[[363,336,'#f8e0ab'],[410,780,'#f3a7ad'],[737,531,'#fff6c8'],[934,349,'#fff8dc'],[186,736,'#f4b6ad'],[725,926,'#e6bcda'],[682,237,'#f9d675'],[438,498,'#f5e6a6'],[857,937,'#f6b8ba']].forEach(f=>flowers(...f));

function fence(x,y,length,axis='x'){
  const end=[x+(axis==='x'?length:0),y+(axis==='y'?length:0)];
  object((x+end[0])/2,(y+end[1])/2,ctx=>{
    line(ctx,[[x,y,13],[...end,13]],'#c4bea0',7);line(ctx,[[x,y,28],[...end,28]],'#fff7e6',5);
    const n=Math.round(length/20);for(let i=0;i<=n;i++){const p=P(x+(end[0]-x)*i/n,y+(end[1]-y)*i/n);ctx.fillStyle='#fff8e9';ctx.beginPath();ctx.moveTo(p.x-3,p.y);ctx.lineTo(p.x+3,p.y);ctx.lineTo(p.x+3,p.y-32);ctx.lineTo(p.x,p.y-37);ctx.lineTo(p.x-3,p.y-32);ctx.closePath();ctx.fill();}
  });
}
fence(130,250,70);fence(270,250,76);fence(730,243,83);fence(953,147,90,'y');fence(77,427,132,'y');fence(848,632,135);fence(253,949,140);fence(800,368,105);

function bench(x,y,axis='x'){
  object(x,y,ctx=>{
    const dx=axis==='x'?1:0,dy=axis==='x'?0:1;
    const at=(u,v,z)=>[x+u*dx+v*dy,y+u*dy+v*dx,z];
    for(const u of[-23,23]){line(ctx,[at(u,-7,0),at(u,-7,29)],'#7e8a79',4);line(ctx,[at(u,9,0),at(u,9,18)],'#7e8a79',4);}
    for(const v of[-7,0,7])line(ctx,[at(-32,v,18),at(32,v,18)],'#cd9d6d',7);
    line(ctx,[at(-32,-9,32),at(32,-9,32)],'#dfb888',9);line(ctx,[at(-32,-9,44),at(32,-9,44)],'#e9c89a',9);
  });
}
bench(408,413,'y');bench(678,438,'y');bench(740,719);bench(424,697);

function lamp(x,y){object(x,y,ctx=>{const p=P(x,y);ellipse(ctx,p.x,p.y,9,4,'#9caa86');line(ctx,[[x,y,3],[x,y,87]],'#83938a',4);ellipse(ctx,p.x,p.y-86,10,4,'#6f887e');ctx.fillStyle='#fff4ce';ctx.beginPath();ctx.roundRect(p.x-7,p.y-106,14,19,4);ctx.fill();line(ctx,[[x,y,107],[x,y,111]],'#6f887e',5);ellipse(ctx,p.x,p.y-108,11,4,'#8ca392');ellipse(ctx,p.x,p.y-96,3,6,'#fffbea');});}
[[489,337],[609,568],[450,590],[723,594],[461,745],[605,820],[360,332],[953,704]].forEach(v=>lamp(...v));

function mailbox(x,y,color){object(x,y,ctx=>{const p=P(x,y);line(ctx,[[x,y,0],[x,y,27]],'#b99a73',5);ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(p.x-10,p.y-42,24,17,6);ctx.fill();ctx.fillStyle='#fff2db';ctx.beginPath();ctx.roundRect(p.x-10,p.y-39,9,14,3);ctx.fill();ctx.strokeStyle='#aa7962';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(p.x-8,p.y-34);ctx.lineTo(p.x-3,p.y-34);ctx.stroke();line(ctx,[[x+13,y,35],[x+13,y,49]],'#d9705f',2);ctx.fillStyle='#e8917e';ctx.fillRect(p.x+11,p.y-52,9,6);});}
mailbox(285,251,'#e8897a');mailbox(642,238,'#d6b269');mailbox(937,272,'#80b3a4');mailbox(231,573,'#b293b8');mailbox(933,655,'#e68f79');mailbox(387,953,'#8cb5c4');

obstacles.push({x:503,y:383,w:94,d:94});
object(550,430,(ctx,time)=>{
  const p=P(550,430);ellipse(ctx,p.x+4,p.y+9,77,39,'rgba(97,100,74,.12)');
  ellipse(ctx,p.x,p.y+1,70,35,'#b7bba5');ellipse(ctx,p.x,p.y-8,70,35,'#e6e5cc');
  ellipse(ctx,p.x,p.y-9,59,28,'#85bdc5');ellipse(ctx,p.x,p.y-10,52,24,'#a2d9da');
  ctx.save();ctx.beginPath();ctx.ellipse(p.x,p.y-10,52,24,0,0,TAU);ctx.clip();
  for(let i=0;i<3;i++){const r=12+((time*.0009+i*.8)%2.4)*16;ellipse(ctx,p.x,p.y-13,r,r*.4,null,'rgba(231,252,238,.55)',1.5);}
  ctx.restore();
  ctx.fillStyle='#d2d5bd';ctx.beginPath();ctx.roundRect(p.x-8,p.y-48,16,34,5);ctx.fill();ellipse(ctx,p.x,p.y-47,27,13,'#afb9a7');ellipse(ctx,p.x,p.y-54,28,13,'#e9ead2');ellipse(ctx,p.x,p.y-55,22,9,'#9bd4d7');
  ctx.strokeStyle='#caeeeb';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x,p.y-58);ctx.bezierCurveTo(p.x-7,p.y-102,p.x-29,p.y-83,p.x-38,p.y-27);ctx.moveTo(p.x,p.y-58);ctx.bezierCurveTo(p.x+10,p.y-102,p.x+30,p.y-81,p.x+39,p.y-27);ctx.stroke();
  const splash=Math.sin(time*.004)*2;ellipse(ctx,p.x,p.y-73+splash,5,7,'#e1f8ec');
});

function drawPond(ctx,time){
  const cx=810,cy=827;
  const shape=(expand,z,color)=>{
    const pts=[];for(let i=0;i<48;i++){const a=i/48*TAU;const rr=1+Math.sin(a*3+.6)*.09+Math.cos(a*5)*.04;pts.push([cx+Math.cos(a)*(91+expand)*rr,cy+Math.sin(a)*(66+expand)*rr,z]);}wp(ctx,pts,color);
  };
  shape(17,1,'#9bb986');shape(10,2,'#e7d7ac');shape(0,3,'#7db7bd');shape(-6,3.5,'#98d3d1');
  const p=P(cx,cy,4);for(let i=0;i<5;i++){const xx=p.x-65+i*30,yy=p.y+Math.sin(i*2)*18;ctx.strokeStyle='rgba(226,248,224,.55)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(xx,yy);ctx.quadraticCurveTo(xx+8,yy+3+Math.sin(time*.001+i)*1.5,xx+17,yy);ctx.stroke();}
  for(const [x,y,r]of[[760,801,8],[832,854,11],[861,800,7]]){groundEllipse(ctx,x,y,r,'#81b584',5);const q=P(x,y,5);ctx.fillStyle='#a0cca0';ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(q.x+12,q.y+2);ctx.lineTo(q.x+6,q.y+7);ctx.closePath();ctx.fill();}
  const f=P(832,854,6);ellipse(ctx,f.x,f.y-3,4,3,'#f6c3ca');ellipse(ctx,f.x+3,f.y-1,4,3,'#ffe0df');
}
obstacles.push({x:717,y:760,w:187,d:136});
// Reeds, small rounded stones, and a friendly duck along the little pond.
[[739,765],[887,851],[884,866]].forEach(([x,y])=>object(x,y,ctx=>{for(let i=0;i<4;i++){const p=P(x+i*4,y+i*2);ctx.strokeStyle='#86a46c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.quadraticCurveTo(p.x+3,p.y-12,p.x+(i-1)*5,p.y-24-i*2);ctx.stroke();}}));
[[739,865,10],[752,882,7],[898,798,10],[902,820,6]].forEach(([x,y,r])=>object(x,y,ctx=>{const p=P(x,y);ellipse(ctx,p.x,p.y,r*1.2,r*.6,'#b8baa0');ellipse(ctx,p.x-1,p.y-3,r,r*.7,'#d8d4b6');}));
object(803,810,(ctx,time)=>{const p=P(803+Math.sin(time*.0003)*5,810);ellipse(ctx,p.x,p.y+2,14,5,'rgba(103,165,162,.3)');ellipse(ctx,p.x,p.y-4,11,7,'#fff4d0');ellipse(ctx,p.x+7,p.y-12,6,6,'#fff8dd');ellipse(ctx,p.x+12,p.y-10,4,2,'#eeb25c');ellipse(ctx,p.x+9,p.y-14,1.1,1.1,'#786a54');ellipse(ctx,p.x-3,p.y-4,5,3,'#ecdfb1');});

// A front-facing welcome board remains readable from the game's camera.
object(139,647,ctx=>{
  const p=P(139,647);
  ctx.fillStyle='#aa8c66';ctx.beginPath();ctx.roundRect(p.x-40,p.y-70,7,70,3);ctx.roundRect(p.x+33,p.y-70,7,70,3);ctx.fill();
  ctx.fillStyle='#8b9f77';ctx.beginPath();ctx.roundRect(p.x-65,p.y-92,130,54,12);ctx.fill();
  ctx.fillStyle='#fff2d5';ctx.beginPath();ctx.roundRect(p.x-63,p.y-94,126,52,11);ctx.fill();
  ctx.strokeStyle='#dbc798';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='#658873';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='800 16px "Trebuchet MS", sans-serif';ctx.fillText('BLOCK TOWN',p.x,p.y-72);
  ctx.fillStyle='#b49661';ctx.font='600 9px "Trebuchet MS", sans-serif';ctx.fillText('a little place to play',p.x,p.y-54);
  for(let i=0;i<3;i++)ellipse(ctx,p.x-9+i*9,p.y-84,2,2,['#df947e','#e6c56e','#88af99'][i]);
});

// The new district keeps the same little wooden-toy proportions and soft colors.
[[1165,105,1,1],[1510,150,.9,0],[1655,100,1.08,2],[1690,405,.84,0],
 [1135,735,.83,2],[1675,765,.92,1],[1535,1080,.9,0],[1690,1130,.83,2],
 [975,1280,.88,1],[680,1390,.82,0],[1260,1350,.79,2],[1370,1450,.72,0],
 [390,1090,.97,1],[350,1275,1.1,0],[440,1410,.8,2],[180,1150,1.04,0],
 [185,1355,.9,2],[85,1000,.96,1]].forEach(t=>tree(...t));
[[1140,216,.75,true],[1415,255,.68,true],[1418,567,.66,true],[1188,578,.6,true],
 [1575,705,.8,true],[1635,895,.72,true],[970,1140,.7,true],[930,1395,.7,true],
 [1200,1415,.7,true],[1575,1365,.7,true],[335,1155,.85,true]].forEach(t=>bush(...t));
[[1080,740,'#fff1b8'],[1490,1018,'#f6b3c3'],[1010,1195,'#e8bfe0'],[665,1095,'#f8db9c'],
 [1350,730,'#ffe7a9'],[405,1230,'#f1b4b7'],[240,1090,'#fff2ca']].forEach(f=>flowers(...f));
[[1030,320],[1245,600],[1375,740],[1015,937],[1458,1040],[1245,1225],[610,1135],[1590,1200]].forEach(t=>lamp(...t));
bench(1195,559);bench(1400,555,'y');bench(1120,875);bench(1375,975,'y');bench(1275,1080);
fence(970,253,45);fence(1100,253,40);fence(1450,530,40);fence(1555,530,55);
fence(715,1392,62);fence(866,1392,61);fence(1410,1370,60);
mailbox(1400,243,'#b39dbf');mailbox(1580,542,'#deb777');mailbox(1190,1400,'#94b18a');

function planter(x,y,w,d,color) {
  obstacles.push({x,y,w,d});
  object(x+w/2,y+d/2,ctx=>{
    wp(ctx,[[x,y+d,2],[x+w,y+d,2],[x+w,y+d,13],[x,y+d,13]],'#c7b89b');
    wp(ctx,[[x+w,y,2],[x+w,y+d,2],[x+w,y+d,13],[x+w,y,13]],'#b3aa90');
    rect(ctx,x-2,y-2,w+4,d+4,'#eee0bb',14);
    rect(ctx,x+3,y+3,w-6,d-6,'#9ba775',14.5);
    for(let i=0;i<8;i++) {
      const px=x+8+rand(i+45)*(w-16),py=y+7+rand(i+22)*(d-14),p=P(px,py,18);
      ellipse(ctx,p.x,p.y,6,6,'#86b182');ellipse(ctx,p.x,p.y-4,4,4,i%2?color:'#fff1ca');
      ellipse(ctx,p.x,p.y-4,1.3,1.3,'#deb663');
    }
  });
}
planter(1055,825,70,32,'#eeb0b8');planter(1355,825,60,32,'#e7c37d');
planter(1055,1060,45,30,'#e6b2d3');planter(1360,1060,55,30,'#efb69c');

// A friendly clock is the town square's meeting point.
obstacles.push({x:1190,y:920,w:70,d:70});
object(1225,955,ctx=>{
  const x=1225,y=955,p=P(x,y);
  ellipse(ctx,p.x+6,p.y+6,68,31,'rgba(77,92,65,.13)');
  rect(ctx,x-37,y-37,74,74,'#b7b4a0',4);
  rect(ctx,x-34,y-34,68,68,'#f0e5c9',9);
  rect(ctx,x-25,y-25,50,50,'#dfd0b1',16);
  wp(ctx,[[x-14,y+14,16],[x+14,y+14,16],[x+14,y+14,111],[x-14,y+14,111]],'#8faf9d');
  wp(ctx,[[x+14,y-14,16],[x+14,y+14,16],[x+14,y+14,111],[x+14,y-14,111]],'#709986');
  const q=P(x,y,126);
  ctx.fillStyle='#749b87';ctx.beginPath();ctx.roundRect(q.x-29,q.y-30,58,63,12);ctx.fill();
  ellipse(ctx,q.x,q.y,24,24,'#fdf3d7','#e4cd95',3);
  for(let i=0;i<12;i++) {const a=i/12*TAU;ellipse(ctx,q.x+Math.sin(a)*19,q.y-Math.cos(a)*19,1.2,1.2,'#8ba08a');}
  ctx.strokeStyle='#6d8a78';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(q.x-10,q.y-6);ctx.lineTo(q.x,q.y);ctx.lineTo(q.x+10,q.y-11);ctx.stroke();
  ellipse(ctx,q.x,q.y,3,3,'#d2aa6a');
  poly(ctx,[{x:q.x-37,y:q.y-27},{x:q.x,y:q.y-48},{x:q.x+37,y:q.y-27}], '#d7a777');
  line(ctx,[[x,y,172],[x,y,186]],'#a18561',3);const top=P(x,y,190);ellipse(ctx,top.x,top.y,5,5,'#ecd39b');
  const plaque=P(x,y+29,35);label(ctx,plaque.x,plaque.y,'MEET & PLAY','#8a9b7c',92,9);
});

function placeSign(x,y,title,subtitle,width=154) {
  object(x,y,ctx=>{
    const p=P(x,y);
    ctx.fillStyle='#b1936e';ctx.beginPath();ctx.roundRect(p.x-width*.34,p.y-63,6,63,3);ctx.roundRect(p.x+width*.34-6,p.y-63,6,63,3);ctx.fill();
    ctx.fillStyle='#fff2d7';ctx.beginPath();ctx.roundRect(p.x-width/2,p.y-85,width,47,9);ctx.fill();
    ctx.strokeStyle='#d5c09a';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#6b8a77';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='800 14px "Trebuchet MS", sans-serif';ctx.fillText(title,p.x,p.y-67);
    ctx.fillStyle='#a39272';ctx.font='600 9px "Trebuchet MS", sans-serif';ctx.fillText(subtitle,p.x,p.y-49);
  });
}
placeSign(1075,1125,'TOWN SQUARE','a place for everyone');
placeSign(450,508,'FOUNTAIN GARDEN','take a little moment',151);
placeSign(1200,603,'READING GARDEN','little books, big adventures',145);

// Colored pennants span the square entrance, high above the walking paths.
object(1220,800,ctx=>{
  const a=P(1055,800,114),b=P(1410,800,114);
  line(ctx,[[1055,800,0],[1055,800,119]],'#9b9d80',3);
  line(ctx,[[1410,800,0],[1410,800,119]],'#9b9d80',3);
  ctx.strokeStyle='#a39e82';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo((a.x+b.x)/2,(a.y+b.y)/2+23,b.x,b.y);ctx.stroke();
  for(let i=1;i<12;i++) {
    const t=i/12,xx=a.x+(b.x-a.x)*t,yy=a.y+(b.y-a.y)*t+46*t*(1-t);
    poly(ctx,[{x:xx-6,y:yy-3},{x:xx+6,y:yy+3},{x:xx,y:yy+17}],['#e9a28c','#e7c774','#97bba0','#9dbac5','#b6a4c3'][i%5]);
  }
});
