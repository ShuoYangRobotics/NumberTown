import * as THREE from './vendor/three.module.js';
import { WORLD } from './geography.js';
import { HILL, DECK, RIVER, BRIDGES, COAST, MOUNTAINS, HILL_TRAIL, HILL_TREES, BEACH_UMBRELLAS, hillHeight, bridgeHeight, riverX, riverWidth } from './terrain-data.js';

/** Complete geographic scenery. Static props share instanced draw calls. */
export function createLandscape() {
  const root = new THREE.Group(); root.name = 'Mountain river, hill, and seaside';
  const materials = new Map(), batches = new Map(), dummy = new THREE.Object3D();
  const geometry = { box: new THREE.BoxGeometry(1, 1, 1), sphere: new THREE.SphereGeometry(1, 12, 8), cylinder: new THREE.CylinderGeometry(1, 1, 1, 10) };
  function mat(color, options = {}) {
    const key = color + JSON.stringify(options);
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .86, ...options }));
    return materials.get(key);
  }
  function put(shape, color, x, y, z, sx, sy, sz, rotation = [0, 0, 0], cast = true) {
    const key = `${shape}:${color}:${cast}`;
    if (!batches.has(key)) batches.set(key, { shape, color, cast, matrices: [] });
    dummy.position.set(x, y, z); dummy.rotation.set(...rotation); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
    batches.get(key).matrices.push(dummy.matrix.clone());
  }
  const box = (x, y, z, w, h, d, color, rotation, cast = true) => put('box', color, x, y, z, w, h, d, rotation, cast);
  const ball = (x, y, z, rx, ry, rz, color, cast = true) => put('sphere', color, x, y, z, rx, ry, rz, [0, 0, 0], cast);
  function beam(a, b, radius, color) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const center = start.clone().add(end).multiplyScalar(.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
    const euler = new THREE.Euler().setFromQuaternion(q);
    put('cylinder', color, center.x, center.y, center.z, radius, delta.length(), radius, [euler.x, euler.y, euler.z]);
  }
  function surface(positions, indices, color, name, options = {}) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices); geo.computeVertexNormals();
    const object = new THREE.Mesh(geo, mat(color, options)); object.name = name; object.receiveShadow = true; root.add(object); return object;
  }
  function plane(x, z, w, d, color, y, name) {
    return surface([x-w/2,y,z-d/2, x+w/2,y,z-d/2, x-w/2,y,z+d/2, x+w/2,y,z+d/2], [0,2,1,1,2,3], color, name);
  }
  function ribbon(points, width, color, height, across = 1, name = '', horizontal = false) {
    const positions = [], indices = [], stride = across + 1;
    points.forEach(([x, z], row) => {
      const previous = points[Math.max(0, row - 1)], next = points[Math.min(points.length - 1, row + 1)];
      const dx = next[0] - previous[0], dz = next[1] - previous[1], length = Math.hypot(dx, dz) || 1;
      const span = typeof width === 'function' ? width(z) : width;
      for (let column = 0; column <= across; column++) {
        const offset = (column / across - .5) * span;
        const px = x + (horizontal ? offset : dz / length * offset), pz = z - (horizontal ? 0 : dx / length * offset);
        positions.push(px, height(px, pz), pz);
      }
      if (row < points.length - 1) for (let column = 0; column < across; column++) {
        const j = row * stride + column; indices.push(j,j+stride,j+1, j+1,j+stride,j+stride+1);
      }
    });
    return surface(positions, indices, color, name, { side: THREE.DoubleSide });
  }
  function label(text, x, y, z, width, height, rotation = 0) {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 160;
    const context = canvas.getContext('2d'); if (!context) return;
    context.fillStyle = '#fff0d3'; context.fillRect(0, 0, 768, 160); context.strokeStyle = '#b9a482'; context.lineWidth = 10; context.strokeRect(8, 8, 752, 144);
    context.fillStyle = '#60776c'; context.font = 'bold 44px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 384, 84);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.BoxGeometry(width, height, .12), new THREE.MeshStandardMaterial({ map: texture, roughness: .9 }));
    sign.position.set(x, y, z); sign.rotation.y = rotation; sign.name = text; root.add(sign);
  }

  // The relocated hill and its broad winding path share the walking height field.
  const hillPositions = [], hillColors = [], hillIndices = [], segments = 80, size = HILL.radius * 2;
  const low = new THREE.Color('#b7cda4'), high = new THREE.Color('#c6d49a'), tint = new THREE.Color();
  for (let row = 0; row <= segments; row++) for (let column = 0; column <= segments; column++) {
    const x = HILL.x-size/2+column/segments*size, z = HILL.z-size/2+row/segments*size, y = hillHeight(x, z);
    hillPositions.push(x, y + .012, z); tint.copy(low).lerp(high, y / HILL.height * .7); hillColors.push(tint.r, tint.g, tint.b);
    if (row < segments && column < segments) { const i = row*(segments+1)+column; hillIndices.push(i,i+segments+1,i+1, i+1,i+segments+1,i+segments+2); }
  }
  const hill = surface(hillPositions, hillIndices, '#ffffff', 'Walkable continuous hill', { vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  hill.geometry.setAttribute('color', new THREE.Float32BufferAttribute(hillColors, 3));
  // Sample the actual hill triangles, whose interpolation differs slightly
  // from the analytic walking height between grid vertices.
  function renderedHillHeight(x, z) {
    const gx=(x-HILL.x+size/2)/size*segments, gz=(z-HILL.z+size/2)/size*segments;
    if(gx<0||gz<0||gx>=segments||gz>=segments)return .012;
    const column=Math.floor(gx), row=Math.floor(gz), u=gx-column, v=gz-row;
    const i=row*(segments+1)+column, y=index=>hillPositions[index*3+1];
    return u+v<=1 ? y(i)*(1-u-v)+y(i+1)*u+y(i+segments+1)*v
      : y(i+segments+2)*(u+v-1)+y(i+1)*(1-v)+y(i+segments+1)*(1-u);
  }
  const curve = new THREE.CatmullRomCurve3(HILL_TRAIL.map(([x,z]) => new THREE.Vector3(x,0,z)), false, 'centripetal');
  const trail = curve.getPoints(150).map(point => [point.x, point.z]);
  {
  // A broad offset ribbon folds over itself at tight bends. Clip a shared
  // ground grid to the path corridor instead, so every patch is drawn once.
  const trailStep=.32, trailRadius=3, trailLift=.10, trailVertices=[], trailIndices=[];
  const minX=Math.floor((Math.min(...trail.map(p=>p[0]))-trailRadius)/trailStep)*trailStep;
  const maxX=Math.ceil((Math.max(...trail.map(p=>p[0]))+trailRadius)/trailStep)*trailStep;
  const minZ=Math.floor((Math.min(...trail.map(p=>p[1]))-trailRadius)/trailStep)*trailStep;
  const maxZ=Math.ceil((Math.max(...trail.map(p=>p[1]))+trailRadius)/trailStep)*trailStep;
  const columns=Math.round((maxX-minX)/trailStep), rows=Math.round((maxZ-minZ)/trailStep), samples=[];
  function trailDistance(x,z) {
    let nearest=Infinity;
    for(let i=1;i<trail.length;i++) {
      const [ax,az]=trail[i-1], [bx,bz]=trail[i], dx=bx-ax, dz=bz-az;
      const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1)));
      nearest=Math.min(nearest,(x-ax-t*dx)**2+(z-az-t*dz)**2);
    }
    return Math.sqrt(nearest)-trailRadius;
  }
  for(let row=0;row<=rows;row++)for(let column=0;column<=columns;column++) {
    const x=minX+column*trailStep,z=minZ+row*trailStep;
    samples.push({x,z,d:trailDistance(x,z)});
  }
  function clippedTrailTriangle(points) {
    const polygon=[];
    for(let i=0;i<3;i++) {
      const a=points[i], b=points[(i+1)%3];
      if(a.d<=0)polygon.push(a);
      if((a.d<=0)!==(b.d<=0)) {
        const t=a.d/(a.d-b.d);polygon.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
      }
    }
    for(let i=1;i<polygon.length-1;i++)for(const p of [polygon[0],polygon[i],polygon[i+1]]) {
      trailIndices.push(trailVertices.length/3);trailVertices.push(p.x,renderedHillHeight(p.x,p.z)+trailLift,p.z);
    }
  }
  for(let row=0;row<rows;row++)for(let column=0;column<columns;column++) {
    const i=row*(columns+1)+column;
    clippedTrailTriangle([samples[i],samples[i+columns+1],samples[i+1]]);
    clippedTrailTriangle([samples[i+1],samples[i+columns+1],samples[i+columns+2]]);
  }
  surface(trailVertices,trailIndices,'#f0dfb7','Hill trail surface',{roughness:1,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4});
  }
  for (let i = 5; i < 130; i += 12) {
    const [x,z] = trail[i], [nx,nz] = trail[i+1], length = Math.hypot(nx-x,nz-z)||1;
    const px=x+(nz-z)/length*3.1, pz=z-(nx-x)/length*3.1, y=hillHeight(px,pz);
    box(px,y+.45,pz,.18,.9,.18,'#b69a6c'); ball(px,y+.94,pz,.22,.12,.22,'#fff0ca');
  }
  HILL_TREES.forEach((tree, i) => {
    const y = hillHeight(tree.x, tree.z);
    put('cylinder','#a08660',tree.x,y+tree.height*.35,tree.z,.2,tree.height*.7,.2);
    ball(tree.x,y+tree.height*.78,tree.z,1.75,tree.height*.44,1.75,['#87aa81','#a5bd87','#94b28a'][i%3]);
    ball(tree.x+.5,y+tree.height*1.05,tree.z-.2,1.15,1.3,1.15,'#a8c091');
  });
  box(DECK.x,DECK.height-.18,DECK.z,DECK.width,.36,DECK.depth,'#b78d5c');
  for (let x = DECK.x-DECK.width/2+.25; x < DECK.x+DECK.width/2; x += .5) box(x,DECK.height+.008,DECK.z,.465,.016,DECK.depth-.15,Math.round(x*2)%3===0?'#d5b785':'#dfc293');
  const west=DECK.x-DECK.width/2, east=DECK.x+DECK.width/2, north=DECK.z-DECK.depth/2, south=DECK.z+DECK.depth/2;
  const deckRails=[[[west,north],[west,south]],[[east,north],[east,south]],[[west,south],[east,south]],[[west,north],[DECK.x-3.5,north]],[[DECK.x+3.5,north],[east,north]]];
  for (const [[ax,az],[bx,bz]] of deckRails) {
    beam([ax,DECK.height+1.12,az],[bx,DECK.height+1.12,bz],.1,'#a57c51'); beam([ax,DECK.height+.5,az],[bx,DECK.height+.5,bz],.055,'#c3a06f');
    const count=Math.ceil(Math.hypot(ax-bx,az-bz)/2);
    for(let i=0;i<=count;i++)box(ax+(bx-ax)*i/count,DECK.height+.58,az+(bz-az)*i/count,.17,1.16,.17,'#ab8154');
  }
  const tx=DECK.x+4.8, tz=DECK.z+3.9;
  put('cylinder','#7c9997',tx,DECK.height+.8,tz,.14,1.6,.14); put('cylinder','#ddd1b0',tx,DECK.height+.09,tz,.55,.18,.55);
  beam([tx,DECK.height+1.7,tz],[tx-.1,DECK.height+1.9,tz+1.1],.23,'#779d9e');
  label('SEASIDE HILL LOOKOUT',DECK.x,DECK.height+.8,south+.13,6.1,1.05,Math.PI);
  label('HILL TRAIL  ↑',HILL_TRAIL[0][0]+5,.95,HILL_TRAIL[0][1],4.2,1);

  // The sea continues far past the world's walking boundary and into the fog.
  const seaColor = '#7dbfc9';
  const seaVisualEnd = Math.max(COAST.seaEnd, 1500);
  const sea = plane(WORLD.width/2,(COAST.seaStart+seaVisualEnd)/2,WORLD.width+2400,seaVisualEnd-COAST.seaStart,seaColor,.045,'Open sea');
  sea.material.roughness=.35; sea.material.metalness=.05; sea.receiveShadow=false;
  plane(WORLD.width/2,(COAST.beachStart+COAST.seaStart)/2,WORLD.width+160,COAST.seaStart-COAST.beachStart,'#f2dfb5',.026,'Long sandy beach');
  plane(WORLD.width/2,COAST.seaStart-2.4,WORLD.width+160,4.8,'#dfcea9',.03,'Wet sand shoreline');
  for(let i=0;i<36;i++) {
    const x=8+i*12.2, z=COAST.beachStart+1.2+Math.sin(i*1.8)*.7;
    ball(x,.035,z,2.5,.045,.6,'#d6d6a3',false);
    if(Math.abs(x-riverX(391))>riverWidth(391)/2+5)ball(x+2,.08,COAST.beachStart+7+(i%4)*3,.17,.08,.13,i%3?'#fff1d7':'#dfb1ad',false);
  }
  BEACH_UMBRELLAS.forEach(({x,z,index}) => {
    const palette=['#dca1ad','#83bcc8','#b4c78f','#e7b57b','#adabd0','#85b7a7'];
    put('cylinder','#fff2d4',x,1.75,z,.055,3.5,.055);
    const canopyVertices=[], canopyColors=[], canopyIndices=[];
    for(let i=0;i<10;i++) {
      const a=i*Math.PI/5,b=(i+1)*Math.PI/5,color=new THREE.Color(i%2?'#fff2da':palette[index]);
      canopyVertices.push(x,3.95,z,x+Math.cos(a)*2.4,2.95,z+Math.sin(a)*2.4,x+Math.cos(b)*2.4,2.95,z+Math.sin(b)*2.4);
      for(let j=0;j<3;j++)canopyColors.push(color.r,color.g,color.b);
      canopyIndices.push(i*3,i*3+2,i*3+1);
    }
    const canopy=surface(canopyVertices,canopyIndices,'#ffffff',`Beach umbrella ${index+1}`,{vertexColors:true,side:THREE.DoubleSide}); canopy.castShadow=true;
    canopy.geometry.setAttribute('color',new THREE.Float32BufferAttribute(canopyColors,3));
    ball(x,4.01,z,.12,.14,.12,'#fff2da');
    for(const side of [-1,1]) {
      box(x+side*.9,.42,z+1.15,.64,.12,1.8,'#fff1d5'); box(x+side*.9,.77,z+.39,.64,.85,.12,palette[index],[.25,0,0]);
      for(const dz of [.5,1.7])box(x+side*.9,.2,z+dz,.48,.4,.06,'#c4ab83');
    }
  });
  label('SEASIDE BEACH',160,1.1,COAST.beachStart-1,5.4,1.05);

  // One uninterrupted channel runs out of the gorge and blends into the sea.
  const riverPoints=[];
  for(let z=RIVER.startZ;z<=RIVER.endZ;z+=.8)riverPoints.push([riverX(z),z]);
  if(riverPoints.at(-1)[1]<RIVER.endZ)riverPoints.push([riverX(RIVER.endZ),RIVER.endZ]);
  ribbon(riverPoints,z=>riverWidth(z)+6,'#d6c89f',()=>.018,1,'Continuous river bank',true);
  ribbon(riverPoints,z=>riverWidth(z)+3,'#a7c5a2',()=>.028,1,'Riverbank grass',true);
  const water=ribbon(riverPoints,riverWidth,'#ffffff',()=>.065,1,'Continuous flowing river',true);
  const riverColors=[], upstream=new THREE.Color('#6bb8ca'), downstream=new THREE.Color(seaColor), riverTint=new THREE.Color();
  for(const [,z] of riverPoints) {
    riverTint.copy(upstream).lerp(downstream,Math.max(0,Math.min(1,(z-COAST.beachStart)/(COAST.seaStart-COAST.beachStart))));
    for(let side=0;side<2;side++)riverColors.push(riverTint.r,riverTint.g,riverTint.b);
  }
  water.geometry.setAttribute('color',new THREE.Float32BufferAttribute(riverColors,3)); water.material=mat('#ffffff',{vertexColors:true,roughness:.35,metalness:.05,side:THREE.DoubleSide});
  water.userData.startZ=RIVER.startZ; water.userData.endZ=RIVER.endZ;
  for(let i=0,z=MOUNTAINS.maxZ+5;z<COAST.seaStart-2;i++,z+=4.3) {
    if(BRIDGES.some(bridge=>Math.abs(z-bridge.z)<bridge.width/2+2))continue;
    const side=i%2?1:-1, edge=riverWidth(z)/2;
    ball(riverX(z)+side*(edge+1),.16,z,.45,.24,.32,i%3?'#d9d0b5':'#e9ddc1');
    if(i%3===0)for(let j=-1;j<2;j++)beam([riverX(z)+side*(edge+2)+j*.18,0,z],[riverX(z)+side*(edge+2)+j*.25,.8+j*.1,z+.1],.035,'#7e9a69');
  }
  for(let x=16;x<WORLD.width;x+=31) {
    if(Math.abs(x-riverX(396))<riverWidth(396)/2+6)continue;
    for(let j=-1;j<=1;j++)beam([x+j*.22,0,COAST.seaStart-2],[x+j*.35,.6+j*.1,COAST.seaStart-1.8],.027,'#a0ab79');
  }

  // Three separate planked crossings. Every ramp and rail follows bridgeHeight.
  for(const bridge of BRIDGES) {
    const marker=new THREE.Group(); marker.name=bridge.name; marker.userData.bridgeId=bridge.id; marker.userData.x=bridge.x; marker.userData.z=bridge.z; root.add(marker);
    for(let x=bridge.x-bridge.span/2+.2;x<bridge.x+bridge.span/2;x+=.4)box(x,bridgeHeight(bridge,x)-.09,bridge.z,.385,.18,bridge.width,'#cfac78');
    for(const side of [-1,1]) {
      const z=bridge.z+side*(bridge.width/2+.2),railSpan=bridge.span-14,steps=12;
      for(let i=0;i<=steps;i++) {
        const x=bridge.x-railSpan/2+i*railSpan/steps,y=bridgeHeight(bridge,x);
        box(x,y+.6,z,.18,1.2,.18,'#987647');
        if(i<steps) {
          const nx=x+railSpan/steps,ny=bridgeHeight(bridge,nx);
          beam([x,y+1.15,z],[nx,ny+1.15,z],.085,'#a78451'); beam([x,y+.5,z],[nx,ny+.5,z],.04,'#c5a674');
        }
      }
    }
    for(const side of [-1,1])for(const x of [bridge.x-8,bridge.x+8])box(x,.15,bridge.z+side*4.8,.38,.9,.38,'#9a805d');
    label(bridge.name.toUpperCase(),bridge.x-bridge.span/2-3,1.25,bridge.z-7.4,5.5,1.05);
  }

  // Tall faceted mountains are a closed, volumetric landform with a deep gorge.
  const peaks=[[-75,4,64,90,76],[20,12,68,78,70],[104,1,74,76,79],[177,14,70,67,70],[304,5,74,76,79],[382,16,71,74,70],[478,0,74,94,83],[565,12,65,80,70]];
  const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
  function mountainY(x,z) {
    let y=13+5*Math.sin(x*.027+.3)**2;
    for(const [px,pz,h,rx,rz] of peaks) {
      const r=Math.hypot((x-px)/rx,(z-pz)/rz);
      if(r<1)y=Math.max(y,h*Math.pow(1-r,.69));
    }
    y*=.94+.06*Math.sin(x*.67+z*.19)*Math.cos(z*.47-x*.13);
    y*=smooth((MOUNTAINS.maxZ-z)/22);
    const gorge=smooth((Math.abs(x-riverX(z))-10)/14);
    const backWall=smooth((-52-z)/13);
    return Math.max(0,y*(gorge+(1-gorge)*backWall));
  }
  const mountainVertices=[],mountainIndices=[],mountainColors=[],columns=100,rows=38,minX=-130,maxX=WORLD.width+130;
  const rockLow=new THREE.Color('#879c86'),rockHigh=new THREE.Color('#aab3a9'),snow=new THREE.Color('#e8eade'),rockTint=new THREE.Color();
  for(let row=0;row<=rows;row++)for(let column=0;column<=columns;column++) {
    const x=minX+(maxX-minX)*column/columns,z=MOUNTAINS.minZ+(MOUNTAINS.maxZ-MOUNTAINS.minZ)*row/rows,y=mountainY(x,z);
    mountainVertices.push(x,y,z);rockTint.copy(rockLow).lerp(rockHigh,Math.min(1,y/60));
    if(y>49)rockTint.lerp(snow,smooth((y-49)/17));
    mountainColors.push(rockTint.r,rockTint.g,rockTint.b);
    if(row<rows&&column<columns){const i=row*(columns+1)+column;mountainIndices.push(i,i+columns+1,i+1,i+1,i+columns+1,i+columns+2);}
  }
  const border=[];
  for(let column=0;column<=columns;column++)border.push(column);
  for(let row=1;row<=rows;row++)border.push(row*(columns+1)+columns);
  for(let column=columns-1;column>=0;column--)border.push(rows*(columns+1)+column);
  for(let row=rows-1;row>0;row--)border.push(row*(columns+1));
  for(let i=0;i<border.length;i++) {
    const a=border[i],b=border[(i+1)%border.length],bottom=mountainVertices.length/3;
    mountainVertices.push(mountainVertices[a*3],-.7,mountainVertices[a*3+2],mountainVertices[b*3],-.7,mountainVertices[b*3+2]);
    mountainColors.push(rockLow.r,rockLow.g,rockLow.b,rockLow.r,rockLow.g,rockLow.b); mountainIndices.push(a,b,bottom,b,bottom+1,bottom);
  }
  const mountains=surface(mountainVertices,mountainIndices,'#ffffff','Rugged northern mountain range',{vertexColors:true,flatShading:true,roughness:1});
  mountains.geometry.setAttribute('color',new THREE.Float32BufferAttribute(mountainColors,3)); mountains.castShadow=true;
  mountains.userData.nonClimbable=true; mountains.userData.gorgeX=riverX(MOUNTAINS.ridgeZ);
  for(let x=4;x<WORLD.width;x+=22) {
    if(Math.abs(x-riverX(61))<24)continue;
    ball(x,1.2,63,3.1,2.3,3.7,'#91a18c');
  }
  label('MOUNTAIN VIEW',139,1.2,77,5.2,1.1);

  // Light animated water accents need no terrain remeshing or per-frame textures.
  const ripples=[],rippleGeometry=new THREE.TorusGeometry(.78,.025,4,18);
  const rippleMaterial=new THREE.MeshBasicMaterial({color:'#d9f1eb',transparent:true,opacity:.35,depthWrite:false});
  for(let i=0;i<56;i++) {
    const z=RIVER.startZ+(i+.5)*(RIVER.endZ-RIVER.startZ)/56,side=(i%5-2)/3;
    const object=new THREE.Mesh(rippleGeometry,rippleMaterial);object.name='River ripple';object.rotation.x=-Math.PI/2;object.scale.set(1.4,.44,1);object.position.set(riverX(z)+side*riverWidth(z)*.22,.095,z);root.add(object);ripples.push({mesh:object,z,side});
  }
  const waves=[];
  for(let row=0;row<16;row++) {
    const points=[];
    for(let x=-90;x<=WORLD.width+90;x+=7)points.push([x,COAST.seaStart+1.2+row*9+Math.sin(x*.065+row*.9)*.75]);
    const wave=ribbon(points,.18+row*.018,'#e0f1e3',()=>.09,1,`Sea foam ${row+1}`);
    wave.material=new THREE.MeshBasicMaterial({color:row%3?'#d9efe4':'#ecf5e6',transparent:true,opacity:row<4?.48:.24,side:THREE.DoubleSide,depthWrite:false});
    wave.receiveShadow=false;waves.push(wave);
  }

  for(const {shape,color,cast,matrices} of batches.values()) {
    const object=new THREE.InstancedMesh(geometry[shape],mat(color),matrices.length);
    matrices.forEach((matrix,index)=>object.setMatrixAt(index,matrix));object.instanceMatrix.needsUpdate=true;object.castShadow=cast;object.receiveShadow=true;object.computeBoundingSphere();object.name=`Terrain ${shape} details`;root.add(object);
  }
  return {root,update(time=0){
    const elapsed=Number.isFinite(time)?time:0,span=RIVER.endZ-RIVER.startZ;
    for(const ripple of ripples) {
      const z=RIVER.startZ+((ripple.z-RIVER.startZ+elapsed*.6)%span+span)%span;
      ripple.mesh.position.set(riverX(z)+ripple.side*riverWidth(z)*.22,.095,z);
    }
    waves.forEach((wave,index)=>{wave.position.z=Math.sin(elapsed*.34+index*.63)*.75;wave.material.opacity=(index<4?.36:.19)+Math.sin(elapsed*.7-index*.8)*.08;});
  }};
}
