import {WORLD,BUILDINGS,ROAD_SEGMENTS,POND,SQUARE} from './world-data.js';
import {HILL,DECK,BRIDGES,HILL_TRAIL,RIVER,COAST,WATER_PLAY,riverX,riverWidth} from './geography.js';
import {WATER_PLAY_BUOYS,UNDERWATER_LANDMARK} from './terrain-data.js';
import {FIELD} from './football.js';
import {PARK} from './park.js';
import {TRAIN_PARK_OFFSET} from './train-park.js';
import {MOUNTAIN_TRAIL,SUMMIT_DECK} from './mountain-route.js';
import {MAP_MAX_ZOOM,fitMapView,clampMapView,zoomMapView,centerMapView,resizeMapView,visibleMapLabels} from './map-view.js';

/** A true plan of the playable geography, built from the world data. */
export function mountTownMap(container,places,onVisit){
  const roads=ROAD_SEGMENTS.map(r=>`<path d="M${r.x1} ${r.z1}L${r.x2} ${r.z2}" stroke-width="${r.width}"/>`).join('');
  const buildings=BUILDINGS.map(b=>`<rect x="${b.x-b.w/2}" y="${b.z-b.d/2}" width="${b.w}" height="${b.d}" rx="1" fill="${b.roof}" stroke="#fff9" stroke-width=".8"><title>${b.kind==='house'?`${b.bank} bank house ${b.name}`:b.name}</title></rect>`).join('');
  const riverPoints=[];
  for(let z=WORLD.minZ;z<=RIVER.endZ;z+=2)riverPoints.push([z,riverX(z),riverWidth(z)/2]);
  const riverPath=riverPoints.map(([z,x,w],i)=>`${i?'L':'M'}${x-w} ${z}`).join(' ')+riverPoints.slice().reverse().map(([z,x,w])=>`L${x+w} ${z}`).join(' ')+'Z';
  const cabinDots=Array.from({length:PARK.cabinCount},(_,i)=>{const a=i/PARK.cabinCount*Math.PI*2;return `<circle cx="${PARK.x+Math.sin(a)*16}" cy="${PARK.z+Math.cos(a)*16}" r="2.1" fill="${['#e7a277','#94bba8','#bd9abd'][i%3]}"/>`;}).join('');
  const ridges=Array.from({length:Math.ceil((WORLD.width-WORLD.minX)/50)},(_,i)=>{const x=WORLD.minX+10+i*50;if(Math.abs(x-240)<30)return '';return `<path d="M${x-37} 66L${x} ${-66+i%3*8}L${x+37} 66Z" fill="${i%2?'#9caeb1':'#b0bfc0'}"/><path d="M${x-8} ${-42+i%3*8}L${x} ${-66+i%3*8}L${x+8} ${-42+i%3*8}L${x+2} ${-46+i%3*8}L${x-3} ${-39+i%3*8}Z" fill="#eff3e8"/>`;}).join('');
  const bridgePaths=BRIDGES.map(b=>`<path d="M${b.x-b.span/2} ${b.z}h${b.span}" stroke="#bd9668" stroke-width="${b.width}"/><path d="M${b.x-b.span/2} ${b.z}h${b.span}" stroke="#ead1a1" stroke-width="${b.width-3}"/>`).join('');
  const cube=['#ed7268','#f0c95d','#79b8a2','#f3ebd4','#78a3c9','#e9a867','#7fa8c9','#e9aa62','#e77d76'].map((c,i)=>`<rect x="${SQUARE.x-6+(i%3)*4}" y="${SQUARE.z-6+Math.floor(i/3)*4}" width="3.6" height="3.6" rx=".4" fill="${c}"/>`).join('');
  container.innerHTML=`<div class="map-tools" aria-label="Map controls">
    <div class="map-zoom"><button type="button" data-map="out" aria-label="Zoom out map">−</button><output class="map-scale" aria-label="Map zoom">100%</output><button type="button" data-map="in" aria-label="Zoom in map">+</button></div>
    <button type="button" data-map="fit">Fit entire map</button><button type="button" data-map="follow" aria-pressed="false">Follow me</button>
    <span class="map-key"><span class="map-dot"></span> You are here</span>
  </div><div class="map-layout"><div class="map-viewport" tabindex="0" role="group" aria-label="Interactive town map" aria-describedby="map-instructions"><svg viewBox="${WORLD.minX} ${WORLD.minZ} ${WORLD.width-WORLD.minX} ${WORLD.depth-WORLD.minZ}" role="img" aria-label="NumberTown: sixty west-bank houses and twenty west-bank stores, twenty east-bank houses and ten east-bank stores, three river bridges, eastern park and football, a winding path to a northern summit deck, an eastern train park with four landscapes, and a large southern bay with a sloping sandy seabed and an underwater garden.">
    <defs><linearGradient id="bay-depth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4e5c9"/><stop offset=".46" stop-color="#8accc7"/><stop offset="1" stop-color="#65b6bd"/></linearGradient></defs>
    <rect x="${WORLD.minX}" y="${WORLD.minZ}" width="${WORLD.width-WORLD.minX}" height="${WORLD.depth-WORLD.minZ}" rx="8" fill="#dce6c9"/>
    <rect x="${WORLD.minX}" y="${COAST.beachStart}" width="${WORLD.width-WORLD.minX}" height="${WORLD.depth-COAST.beachStart}" fill="#efdeb0"/>
    <rect x="${WORLD.minX}" y="${COAST.seaStart}" width="${WORLD.width-WORLD.minX}" height="${WORLD.depth-COAST.seaStart}" fill="#87bfcb"/>
    <rect x="${WATER_PLAY.xMin}" y="${WATER_PLAY.shoreZ}" width="${WATER_PLAY.xMax-WATER_PLAY.xMin}" height="${WATER_PLAY.deepZ-WATER_PLAY.shoreZ}" fill="url(#bay-depth)"/>
    <path d="M${WATER_PLAY.xMin} ${WATER_PLAY.shoreZ}V${WATER_PLAY.deepZ}H${WATER_PLAY.xMax}V${WATER_PLAY.shoreZ}" fill="none" stroke="#f8efca" stroke-width="1" stroke-dasharray="2 3"/>
    ${WATER_PLAY_BUOYS.map(buoy=>`<circle cx="${buoy.x}" cy="${buoy.z}" r="1.5" fill="${['#ed9a77','#f0d37a','#9cc4b7'][buoy.index%3]}"/>`).join('')}
    <path d="M${WORLD.minX} ${COAST.seaStart+2}H${WORLD.width}" stroke="#eaf4dd" stroke-width="3"/>
    <g fill="none" stroke="#f6efd8" stroke-linecap="round">${roads}</g>
    <rect x="${SQUARE.x-SQUARE.w/2}" y="${SQUARE.z-SQUARE.d/2}" width="${SQUARE.w}" height="${SQUARE.d}" rx="4" fill="#f0dfbf"/>
    ${buildings}${cube}
    <ellipse cx="${POND.x}" cy="${POND.z}" rx="${POND.rx+2}" ry="${POND.rz+2}" fill="#e9d9b4"/>
    <ellipse cx="${POND.x}" cy="${POND.z}" rx="${POND.rx}" ry="${POND.rz}" fill="#85bec9"/>
    <rect x="${PARK.bounds.minX}" y="${PARK.bounds.minZ}" width="${PARK.bounds.maxX-PARK.bounds.minX}" height="${PARK.bounds.maxZ-PARK.bounds.minZ}" rx="10" fill="#bfd4ac"/>
    <circle cx="${PARK.x}" cy="${PARK.z}" r="16" fill="#e7eacb" stroke="#789989"/>${cabinDots}
    <text x="${PARK.x}" y="${PARK.z+33}">WHEEL PARK</text>
    <rect x="${FIELD.minX}" y="${FIELD.minZ}" width="${FIELD.width}" height="${FIELD.depth}" fill="#8ab27c" stroke="#faffed" stroke-width="1.2"/>
    <path d="M${FIELD.minX} ${FIELD.z}H${FIELD.maxX}" stroke="#faffed"/><circle cx="${FIELD.x}" cy="${FIELD.z}" r="9" fill="none" stroke="#faffed"/>
    <text x="${FIELD.x}" y="${FIELD.maxZ+17}">FOOTBALL</text>
    <circle cx="${HILL.x}" cy="${HILL.z}" r="${HILL.radius}" fill="#aac38c"/>
    <circle cx="${HILL.x}" cy="${HILL.z}" r="21" fill="#bed2a1"/>
    <path d="M${HILL_TRAIL.map(p=>p.join(' ')).join('L')}" fill="none" stroke="#f4e5c1" stroke-width="4"/>
    <rect x="${DECK.x-DECK.width/2}" y="${DECK.z-DECK.depth/2}" width="${DECK.width}" height="${DECK.depth}" fill="#c6a16e" stroke="#faf0d0"/>
    <text x="${HILL.x}" y="${HILL.z+25}">SEA-VIEW HILL</text>
    ${ridges}
    <path d="M${MOUNTAIN_TRAIL.map(p=>`${p.x.toFixed(2)} ${p.z.toFixed(2)}`).join('L')}" fill="none" stroke="#586f70" stroke-width="10.5" stroke-linejoin="round"/>
    <path d="M${MOUNTAIN_TRAIL.map(p=>`${p.x.toFixed(2)} ${p.z.toFixed(2)}`).join('L')}" fill="none" stroke="#f8e6bc" stroke-width="7" stroke-linejoin="round"/>
    <rect x="${SUMMIT_DECK.x-SUMMIT_DECK.width/2}" y="${SUMMIT_DECK.z-SUMMIT_DECK.depth/2}" width="${SUMMIT_DECK.width}" height="${SUMMIT_DECK.depth}" rx="1" fill="#c9a06e" stroke="#fff7d7" stroke-width="1.5"/>
    <text x="${SUMMIT_DECK.x}" y="${SUMMIT_DECK.z-14}" data-map-priority="3" style="fill:#354f45;font-weight:800">SUMMIT DECK</text>
    <path d="${riverPath}" fill="#85bdca"/>
    ${bridgePaths}
    <g transform="translate(${TRAIN_PARK_OFFSET.x} ${TRAIN_PARK_OFFSET.z})"><rect x="450" y="78" width="370" height="275" rx="16" fill="#d5dec1" stroke="#fcf6dc" stroke-width="3"/>
    <path d="M450 78H635V215H450Z" fill="#e8c58b"/><path d="M635 78H820V215H635Z" fill="#90b994"/>
    <path d="M450 215H635V353H450Z" fill="#b9ce82"/><path d="M635 215H820V353H635Z" fill="#d5e7df"/>
    <ellipse cx="635" cy="215" rx="150" ry="108" fill="none" stroke="#8e7663" stroke-width="5"/>
    <ellipse cx="635" cy="215" rx="150" ry="108" fill="none" stroke="#f9ebc9" stroke-width="2" stroke-dasharray="2 3"/>
    <rect x="467" y="198" width="16" height="34" rx="3" fill="#fff4db"/>
    <text x="550" y="155">DESERT</text><text x="723" y="155">RAINFOREST</text>
    <text x="550" y="279">FARMS</text><text x="723" y="279">SNOWY PEAKS</text>
    <text x="635" y="370">DISCOVERY TRAIN PARK</text></g>
    <ellipse cx="125" cy="550" rx="34" ry="28" fill="none" stroke="#f5dfae" stroke-width="6"/>
    <text class="map-area" x="112" y="74" data-screen-offset="-16" data-map-priority="3">WEST BANK</text>
    <text class="map-area" x="343" y="74" data-screen-offset="-16" data-map-priority="3">EAST BANK</text>
    <text x="-115" y="74" data-map-priority="2">WEST MARKET</text>
    <text x="515" y="74" data-map-priority="2">EAST MARKET</text>
    <text x="340" y="-49">HIGH MOUNTAINS</text>
    <text x="220" y="389">LONG BEACH</text><text x="${(WATER_PLAY.xMin+WATER_PLAY.xMax)/2}" y="421">WATER PLAY</text>
    <text x="${UNDERWATER_LANDMARK.x}" y="${UNDERWATER_LANDMARK.z}" data-map-priority="3">UNDERWATER GARDEN</text>
    <text x="${UNDERWATER_LANDMARK.x}" y="${UNDERWATER_LANDMARK.z}" data-screen-offset="16" data-map-priority="-1">${WATER_PLAY.maxDepth} BLOCKS DEEP</text><text class="map-sea" x="316" y="575">THE SOUTHERN SEA</text>
    <g id="map-player" transform="translate(${SQUARE.x} ${SQUARE.z})"><circle r="5.8" fill="#fdf6d9"/><circle r="3.6" fill="#d96658" stroke="#fff" stroke-width=".9"/></g>
  </svg><span class="map-compass" aria-hidden="true">↑ N</span></div>
    <aside class="map-destinations" aria-label="Places to visit"><h3>Where shall we go?</h3><button type="button" class="map-places-toggle" aria-expanded="false" aria-controls="map-places-list">Places to visit <span aria-hidden="true">⌄</span></button><p>Choose a place to travel there.</p><div class="map-places" id="map-places-list"></div></aside>
  </div><p id="map-instructions" class="map-instructions">Drag to explore · Scroll to zoom · Focus the map and use arrow keys to move, + / − to zoom, or 0 to fit.</p>`;
  for(const place of places.filter(p=>p.id!=='lookout')){
    const button=document.createElement('button');button.type='button';button.textContent=place.name;
    button.addEventListener('click',()=>onVisit(place));container.querySelector('.map-places').append(button);
  }
  const svg=container.querySelector('svg'),viewport=container.querySelector('.map-viewport');
  const marker=container.querySelector('#map-player'),scale=container.querySelector('.map-scale');
  const followButton=container.querySelector('[data-map="follow"]');
  const zoomIn=container.querySelector('[data-map="in"]'),zoomOut=container.querySelector('[data-map="out"]');
  const labels=[...svg.querySelectorAll('text')];
  const bounds={minX:WORLD.minX,maxX:WORLD.width,minZ:WORLD.minZ,maxZ:WORLD.depth};
  let fitted=fitMapView(bounds,1000,600),view={...fitted},player={x:SQUARE.x,z:SQUARE.z};
  let following=false,drag=null,lastWidth=0,lastHeight=0;
  function render(){
    svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.width} ${view.height}`);
    const zoom=fitted.width/view.width;
    scale.textContent=`${Math.round(zoom*100)}%`;
    zoomIn.disabled=zoom>=MAP_MAX_ZOOM-.001;zoomOut.disabled=zoom<=1.001;
    // Labels and the player dot stay readable at both the whole-town and street scales.
    const units=view.width/(lastWidth||1000);
    for(const label of labels){
      const size=label.classList.contains('map-sea')?14:label.classList.contains('map-area')?11:10;
      label.style.fontSize=`${size*units}px`;
      label.style.letterSpacing=`${.4*units}px`;
      label.style.strokeWidth=`${2.5*units}px`;
      label.style.visibility='visible';
      label.setAttribute('dy',String(Number(label.dataset.screenOffset||0)*units));
    }
    // On narrow screens, hide overlapping detail names rather than shrinking all text.
    // Screen-space bounds include the train park's translated group and label offsets.
    if(lastWidth){
      const viewportRect=viewport.getBoundingClientRect();
      const rectangles=labels.map((label,id)=>({id,priority:Number(label.dataset.mapPriority||0),...label.getBoundingClientRect().toJSON()}))
        .filter(rect=>rect.right>viewportRect.left&&rect.left<viewportRect.right&&rect.bottom>viewportRect.top&&rect.top<viewportRect.bottom);
      const visible=visibleMapLabels(rectangles);
      labels.forEach((label,id)=>{label.style.visibility=visible.has(id)?'visible':'hidden';});
    }
    marker.setAttribute('transform',`translate(${player.x} ${player.z}) scale(${units})`);
  }
  function setFollowing(value){following=value;followButton.setAttribute('aria-pressed',String(value));}
  function zoomBy(factor,anchor){
    view=zoomMapView(view,fitted,factor,anchor);
    if(following)view=centerMapView(view,fitted,player);
    render();
  }
  function fit(){setFollowing(false);view={...fitted};render();}
  function refresh(){
    const rect=viewport.getBoundingClientRect();
    if(rect.width<1||rect.height<1)return;
    if(rect.width===lastWidth&&rect.height===lastHeight)return;
    const next=fitMapView(bounds,rect.width,rect.height);
    view=resizeMapView(view,fitted,next);fitted=next;lastWidth=rect.width;lastHeight=rect.height;
    if(following)view=centerMapView(view,fitted,player);
    render();
  }
  zoomIn.addEventListener('click',()=>zoomBy(1.5));
  zoomOut.addEventListener('click',()=>zoomBy(1/1.5));
  container.querySelector('[data-map="fit"]').addEventListener('click',fit);
  followButton.addEventListener('click',()=>{
    setFollowing(!following);
    if(following){
      const zoom=fitted.width/view.width;
      if(zoom<2.5)view=zoomMapView(view,fitted,2.5/zoom);
      view=centerMapView(view,fitted,player);render();
    }
  });
  container.querySelector('.map-places-toggle').addEventListener('click',event=>{
    const open=container.querySelector('.map-destinations').classList.toggle('is-open');
    event.currentTarget.setAttribute('aria-expanded',String(open));
  });
  viewport.addEventListener('wheel',event=>{
    event.preventDefault();refresh();setFollowing(false);
    const rect=viewport.getBoundingClientRect();
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?rect.height:1);
    zoomBy(Math.exp(-Math.max(-200,Math.min(200,delta))*.0025),{x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height});
  },{passive:false});
  viewport.addEventListener('pointerdown',event=>{
    if(event.button!==0||drag)return;
    event.preventDefault();viewport.focus({preventScroll:true});refresh();setFollowing(false);
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,view:{...view}};
    viewport.setPointerCapture(event.pointerId);viewport.classList.add('is-dragging');
  });
  viewport.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    view=clampMapView({...drag.view,x:drag.view.x-(event.clientX-drag.x)*drag.view.width/lastWidth,y:drag.view.y-(event.clientY-drag.y)*drag.view.height/lastHeight},fitted);
    render();
  });
  function endDrag(event){if(drag&&event.pointerId===drag.id){drag=null;viewport.classList.remove('is-dragging');}}
  viewport.addEventListener('pointerup',endDrag);viewport.addEventListener('pointercancel',endDrag);viewport.addEventListener('lostpointercapture',endDrag);
  viewport.addEventListener('keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey)return;
    const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if(direction){
      event.preventDefault();setFollowing(false);
      view=clampMapView({...view,x:view.x+direction[0]*view.width*.12,y:view.y+direction[1]*view.height*.12},fitted);render();
    }else if(event.key==='+'||event.key==='='){event.preventDefault();zoomBy(1.4);}
    else if(event.key==='-'||event.key==='_'){event.preventDefault();zoomBy(1/1.4);}
    else if(event.key==='0'||event.key==='Home'){event.preventDefault();fit();}
  });
  const observer=new ResizeObserver(refresh);observer.observe(viewport);render();
  return {
    update(nextPlayer){
      const moved=nextPlayer.x!==player.x||nextPlayer.z!==player.z;
      player={x:nextPlayer.x,z:nextPlayer.z};
      if(following&&moved){view=centerMapView(view,fitted,player);render();}
      else marker.setAttribute('transform',`translate(${player.x} ${player.z}) scale(${view.width/(lastWidth||1000)})`);
    },
    refresh,
    destroy(){observer.disconnect();},
  };
}
