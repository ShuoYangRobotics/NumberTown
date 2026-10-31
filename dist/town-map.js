import {WORLD,BUILDINGS,ROAD_SEGMENTS,POND,SQUARE} from './world-data.js';
import {HILL,DECK,BRIDGES,HILL_TRAIL,COAST,riverX,riverWidth} from './geography.js';
import {FIELD} from './football.js';
import {PARK} from './park.js';
import {MOUNTAIN_TRAIL,SUMMIT_DECK} from './mountain-route.js';

/** A true plan of the playable geography, built from the world data. */
export function mountTownMap(container,places,onVisit){
  const roads=ROAD_SEGMENTS.map(r=>`<path d="M${r.x1} ${r.z1}L${r.x2} ${r.z2}" stroke-width="${r.width}"/>`).join('');
  const buildings=BUILDINGS.map(b=>`<rect x="${b.x-b.w/2}" y="${b.z-b.d/2}" width="${b.w}" height="${b.d}" rx="1" fill="${b.roof}" stroke="#fff9" stroke-width=".8"><title>${b.kind==='house'?`${b.bank} bank house ${b.name}`:b.name}</title></rect>`).join('');
  const riverPoints=[];
  for(let z=WORLD.minZ;z<=WORLD.depth;z+=2)riverPoints.push([z,riverX(z),riverWidth(z)/2]);
  const riverPath=riverPoints.map(([z,x,w],i)=>`${i?'L':'M'}${x-w} ${z}`).join(' ')+riverPoints.slice().reverse().map(([z,x,w])=>`L${x+w} ${z}`).join(' ')+'Z';
  const cabinDots=Array.from({length:PARK.cabinCount},(_,i)=>{const a=i/PARK.cabinCount*Math.PI*2;return `<circle cx="${PARK.x+Math.sin(a)*16}" cy="${PARK.z+Math.cos(a)*16}" r="2.1" fill="${['#e7a277','#94bba8','#bd9abd'][i%3]}"/>`;}).join('');
  const ridges=[...Array(9)].map((_,i)=>{const x=10+i*50;if(Math.abs(x-240)<30)return '';return `<path d="M${x-37} 66L${x} ${-66+i%3*8}L${x+37} 66Z" fill="${i%2?'#9caeb1':'#b0bfc0'}"/><path d="M${x-8} ${-42+i%3*8}L${x} ${-66+i%3*8}L${x+8} ${-42+i%3*8}L${x+2} ${-46+i%3*8}L${x-3} ${-39+i%3*8}Z" fill="#eff3e8"/>`;}).join('');
  const bridgePaths=BRIDGES.map(b=>`<path d="M${b.x-b.span/2} ${b.z}h${b.span}" stroke="#bd9668" stroke-width="${b.width}"/><path d="M${b.x-b.span/2} ${b.z}h${b.span}" stroke="#ead1a1" stroke-width="${b.width-3}"/>`).join('');
  const cube=['#ed7268','#f0c95d','#79b8a2','#f3ebd4','#78a3c9','#e9a867','#7fa8c9','#e9aa62','#e77d76'].map((c,i)=>`<rect x="${SQUARE.x-6+(i%3)*4}" y="${SQUARE.z-6+Math.floor(i/3)*4}" width="3.6" height="3.6" rx=".4" fill="${c}"/>`).join('');
  container.innerHTML=`<svg viewBox="0 ${WORLD.minZ} ${WORLD.width} ${WORLD.depth-WORLD.minZ}" role="img" aria-label="NumberTown: fifty west-bank houses, twenty east-bank houses, three river bridges, eastern park and football, a winding path to a northern summit deck, and a southern beach and sea.">
    <rect y="${WORLD.minZ}" width="${WORLD.width}" height="${WORLD.depth-WORLD.minZ}" rx="8" fill="#dce6c9"/>
    <rect x="0" y="${COAST.beachStart}" width="${WORLD.width}" height="${WORLD.depth-COAST.beachStart}" fill="#efdeb0"/>
    <rect x="0" y="${COAST.seaStart}" width="${WORLD.width}" height="${WORLD.depth-COAST.seaStart}" fill="#87bfcb"/>
    <path d="M0 ${COAST.seaStart+2}H${WORLD.width}" stroke="#eaf4dd" stroke-width="3"/>
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
    <text x="${SUMMIT_DECK.x}" y="${SUMMIT_DECK.z-14}" style="fill:#fff8e5;font-weight:800">SUMMIT DECK</text>
    <path d="${riverPath}" fill="#85bdca"/>
    ${bridgePaths}
    <text class="map-area" x="112" y="74">WEST BANK · 50 HOMES</text>
    <text class="map-area" x="343" y="74">EAST BANK · 20 HOMES</text>
    <text x="340" y="-49">HIGH MOUNTAINS</text>
    <text x="220" y="389">LONG BEACH</text><text class="map-sea" x="220" y="430">THE SOUTHERN SEA</text>
    <g id="map-player" transform="translate(${SQUARE.x} ${SQUARE.z})"><circle r="5.8" fill="#fdf6d9"/><circle r="3.6" fill="#d96658" stroke="#fff" stroke-width=".9"/></g>
  </svg><p class="map-key"><span class="map-dot"></span> You are here <span>Choose a place to visit ↓</span></p><div class="map-places"></div>`;
  for(const place of places.filter(p=>p.id!=='lookout')){
    const button=document.createElement('button');button.type='button';button.textContent=place.name;
    button.addEventListener('click',()=>onVisit(place));container.querySelector('.map-places').append(button);
  }
  return {update(player){container.querySelector('#map-player').setAttribute('transform',`translate(${player.x} ${player.z})`);}};
}
