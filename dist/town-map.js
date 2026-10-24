import {WORLD,BUILDINGS,ROAD_SEGMENTS} from './world-data.js';
import {HILL,RIVER,HILL_TRAIL,riverX} from './terrain-data.js';
import {FIELD} from './football.js';

/** The map is drawn from the same positions as the playable world. */
export function mountTownMap(container,places,onVisit){
  const roads=ROAD_SEGMENTS.map(r=>`<path d="M${r.x1} ${r.z1}L${r.x2} ${r.z2}" stroke-width="${r.width}"/>`).join('');
  const buildings=BUILDINGS.map(b=>`<rect x="${b.x-b.w/2}" y="${b.z-b.d/2}" width="${b.w}" height="${b.d}" rx="1" fill="${b.roof}" stroke="#fff9" stroke-width=".7"><title>${b.kind==='house'?'House '+b.name:b.name}</title></rect>`).join('');
  const river=Array.from({length:RIVER.endZ-RIVER.startZ+1},(_,i)=>`${i?'L':'M'}${riverX(RIVER.startZ+i)} ${RIVER.startZ+i}`).join(' ');
  const cabinDots=Array.from({length:18},(_,i)=>{const a=i/18*Math.PI*2;return `<circle cx="${249+Math.sin(a)*15}" cy="${46+Math.cos(a)*15}" r="2" fill="${['#e7a277','#94bba8','#bd9abd'][i%3]}"/>`;}).join('');
  container.innerHTML=`<svg viewBox="0 0 ${WORLD.width} ${WORLD.depth}" role="img" aria-label="NumberTown map: fifty houses and ten stores, wheel park in the northeast, football in the east, hill and river in the south.">
    <rect width="300" height="250" rx="8" fill="#dce6c9"/>
    <g fill="none" stroke="#f6efd8" stroke-linecap="round">${roads}</g>
    ${buildings}
    <rect x="208" y="8" width="80" height="88" rx="10" fill="#bfd4ac"/>
    <circle cx="249" cy="46" r="15" fill="#e7eacb" stroke="#789989"/>${cabinDots}
    <text x="248" y="78">WHEEL PARK</text>
    <rect x="${FIELD.minX}" y="${FIELD.minZ}" width="${FIELD.width}" height="${FIELD.depth}" fill="#8ab27c" stroke="#faffed" stroke-width="1.2"/>
    <path d="M216 149H274" stroke="#faffed"/><circle cx="245" cy="149" r="9" fill="none" stroke="#faffed"/>
    <text x="245" y="203">FOOTBALL</text>
    <circle cx="${HILL.x}" cy="${HILL.z}" r="${HILL.radius}" fill="#a9c18a"/>
    <circle cx="100" cy="212" r="21" fill="#b9ce99"/>
    <path d="M${HILL_TRAIL.map(p=>p.join(' ')).join('L')}" fill="none" stroke="#f4e5c1" stroke-width="3"/>
    <rect x="93" y="206" width="14" height="12" fill="#c6a16e" stroke="#faf0d0"/>
    <text x="100" y="238">SUNNY HILL</text>
    <path d="${river}" fill="none" stroke="#7ebcc9" stroke-width="${RIVER.width}"/>
    <path d="M${riverX(190)-14.5} 190h29" stroke="#d2ad7a" stroke-width="10"/>
    <text x="176" y="232" transform="rotate(-90 176 232)">RIVER</text>
    <text x="60" y="9">OLD TOWN</text><text x="148" y="7">RAINBOW LANES</text>
    <g id="map-player" transform="translate(48 47)"><circle r="4.8" fill="#fdf6d9"/><circle r="3" fill="#d96658" stroke="#fff" stroke-width=".8"/></g>
  </svg><p class="map-key"><span class="map-dot"></span> You are here <span>Choose a place to visit ↓</span></p><div class="map-places"></div>`;
  for(const place of places.filter(p=>p.id!=='lookout')){
    const button=document.createElement('button');button.type='button';button.textContent=place.name;
    button.addEventListener('click',()=>onVisit(place));container.querySelector('.map-places').append(button);
  }
  return {update(player){container.querySelector('#map-player').setAttribute('transform',`translate(${player.x} ${player.z})`);}};
}
