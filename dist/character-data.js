/** Unit cubes: x grows right, y grows up from the feet, z grows toward the face. */
const WHITE = '#fffaf1';
const RED_EDGE = '#d9384a';
const RAINBOW = ['#ec3546', '#ff9d2e', '#f9dc31', '#35bb66', '#2ac6df', '#8654cb', '#bd63cb'];
const GOLD_EDGE = '#d49a37';
const GOLD = '#ffd58b';

function grid(columns, rows, color, outline) {
  return Array.from({ length: columns * rows }, (_, index) => {
    const x = index % columns, y = Math.floor(index / columns);
    return { x, y, color: typeof color === 'function' ? color(x, y) : color, ...(outline ? { outline } : {}) };
  });
}
function ten() { return grid(2, 5, WHITE, RED_EDGE); }
function character(number, name, color, dark, description, cells) {
  return Object.freeze({
    number, name, color, dark, description,
    cells: Object.freeze(cells.map(cell => Object.freeze({z:0,...cell}))),
    width: Math.max(...cells.map(cell => cell.x)) + 1,
    height: Math.max(...cells.map(cell => cell.y)) + 1,
    depth: Math.max(...cells.map(cell => cell.z ?? 0)) + 1,
  });
}

export const CHARACTERS = Object.freeze([
  character(1, 'One', '#ef5352', '#ae292f', 'Small, brave, and ready to explore.', grid(1, 1, '#ef5352')),
  character(2, 'Two', '#ffb349', '#a13786', 'Two blocks, twice the adventure.', grid(1, 2, '#ffb349')),
  character(3, 'Three', '#f6d649', '#d5433a', 'A little crown and a big imagination.', grid(1, 3, '#f6d649')),
  character(4, 'Four', '#61c981', '#278b52', 'A cheerful green friend.', grid(1, 4, '#61c981')),
  character(5, 'Five', '#4dc5df', '#187fb1', 'A star with a friendly high five.', grid(1, 5, '#4dc5df')),
  character(6, 'Six', '#9460d1', '#ce278c', 'Six spots and a playful purple smile.', grid(2, 3, '#9460d1')),
  character(7, 'Seven', '#9d59d2', '#a43fa5', 'Seven rainbow blocks, full of wonder.', grid(1, 7, (_, y) => RAINBOW[y])),
  character(8, 'Eight', '#f93e9b', '#713a2e', 'An eight-limbed, pink superhero.', grid(2, 4, '#f93e9b')),
  character(9, 'Nine', '#a5adae', '#344b58', 'A thoughtful friend, three by three.', grid(3, 3, (_, y) => ['#c3c8c6', '#afb5b4', '#969e9f'][y])),
  character(10, 'Ten', WHITE, '#c82c40', 'Ten bright blocks and two starry eyes.', ten()),
  character(11, 'Eleven', '#ef5352', '#4d7427', 'A football-loving friend, ten and one.', [...ten(), { x: 1, y: 5, color: '#ef5352' }]),
  character(12, 'Twelve', '#ffb349', '#9e2845', 'Three by four, with lots to discover.', grid(3, 4, (x, y) => x === 1 && (y === 1 || y === 2) ? '#ffb349' : WHITE, RED_EDGE)),
  character(13, 'Thirteen', '#f6d649', '#803b7e', 'Ten and three, full of happy surprises.', [...ten(), { x: 1, y: 5, color: '#f6d649' }, { x: 2, y: 5, color: '#f6d649' }, { x: 2, y: 4, color: '#f6d649' }]),
  character(14, 'Fourteen', '#61c981', '#278b52', 'Ten and four, ready for an adventure.', [...ten(), ...grid(2, 2, '#61c981').map(cell => ({ ...cell, y: cell.y + 5 }))]),
  character(15, 'Fifteen', '#4dc5df', '#233f80', 'A staircase of friends, step by step.', Array.from({ length: 5 }, (_, x) => Array.from({ length: x + 1 }, (_, y) => ({ x, y, color: x === 4 ? '#4dc5df' : WHITE, ...(x === 4 ? {} : { outline: RED_EDGE }) }))).flat()),
  character(16, 'Sixteen', '#7541c2', '#532989', 'A square sixteen with a purple smile and a cheer to share.', grid(4, 4, (x, y) => y === 0 || y === 1 && (x === 1 || x === 2) ? '#7541c2' : WHITE).map(cell => ({...cell,...(cell.color===WHITE?{outline:RED_EDGE}:{})}))),
  character(17, 'Seventeen', '#ad52d0', '#81369d', 'A rainbow artist who finds inspiration everywhere.', [
    ...ten().map(cell=>({...cell,x:cell.x+1})),
    ...[[0,3],[0,4],[0,5],[1,5],[2,5],[3,5],[3,6]].map(([x,y],index)=>({x,y,color:index===6?'#bc79df':index===5?'#8038d2':RAINBOW[index]})),
  ]),
  character(18, 'Eighteen', '#f132c4', '#832276', 'A bright rectangular friend, ready to try something new.', grid(3,6,(x,y)=>y===0||x===2?'#f132c4':WHITE).map(cell=>({...cell,...(cell.color===WHITE?{outline:RED_EDGE}:{})}))),
  character(19, 'Nineteen', '#a6adab', '#3e494c', 'Ten and nine, with a thoughtful face and a tall perspective.', [
    ...grid(1,10,WHITE,RED_EDGE),
    ...grid(1,9,(_,y)=>['#b4bcba','#a7afad','#969f9d'][Math.floor(y/3)]).map(cell=>({...cell,x:1})),
  ]),
  character(20, 'Twenty', '#f7c96b', '#805070', 'Twenty golden blocks, a top hat, and a little showtime sparkle.', grid(2,10,(x,y)=>x===0?(y%2?'#ffd080':'#ffc56b'):'#ffe09a','#c58b35')),
  character(21, 'Twenty-One', GOLD, '#68482c', 'An adventurous explorer with a backpack full of possibilities.', grid(3,7,(x,y)=>x===1&&y===3?'#ed292d':GOLD,GOLD_EDGE)),
  character(22, 'Twenty-Two', GOLD, '#305b86', 'Two little orange blocks and twenty golden reasons to smile.', [
    ...grid(4,5,GOLD,GOLD_EDGE),
    {x:1,y:5,color:'#ff9f19',outline:GOLD_EDGE},{x:2,y:5,color:'#ff9f19',outline:GOLD_EDGE},
  ]),
  character(23, 'Twenty-Three', GOLD, '#a92c4c', 'A tall golden friend with three bright yellow blocks.', [
    ...grid(2,10,GOLD,GOLD_EDGE),...grid(1,3,'#f6db2c',GOLD_EDGE).map(cell=>({...cell,x:2})),
  ]),
  character(24, 'Twenty-Four', GOLD, '#215791', 'Twenty-four hours of wonder, from sunny mornings to starry nights.', grid(3,8,(x,y)=>x===1&&y>=2&&y<=5?'#77c627':GOLD,GOLD_EDGE)),
  character(25, 'Twenty-Five', GOLD, '#285780', 'A five-by-five square with a bright blue smile.', grid(5,5,(_,y)=>y===0?'#37c5dc':GOLD,GOLD_EDGE)),
  character(26, 'Twenty-Six', GOLD, '#7025a6', 'A cool secret agent with twenty golden cubes and six purple ones.', [
    ...grid(4,6,(x,y)=>y===0||y===1&&(x===0||x===3)?'#7c26c4':GOLD,GOLD_EDGE),
    {x:1,y:6,color:GOLD,outline:GOLD_EDGE},{x:2,y:6,color:GOLD,outline:GOLD_EDGE},
  ]),
  character(27, 'Twenty-Seven', GOLD, '#753d83', 'Three by three by three: a golden cube with a rainbow secret.', Array.from({length:27},(_,i)=>{
    const x=i%3,y=Math.floor(i/3)%3,z=Math.floor(i/9);
    const rainbow=['2,0,0','2,1,0','2,2,0','2,2,1','2,1,1','2,0,1','1,2,0'].indexOf(`${x},${y},${z}`);
    return{x,y,z,color:rainbow<0?GOLD:RAINBOW[rainbow],outline:GOLD_EDGE};
  })),
  character(28, 'Twenty-Eight', GOLD, '#ae36b4', 'A tall windowed friend with twenty golden cubes and a pink eight.', grid(3,11,(_,y)=>y>=8?'#ef2ad7':GOLD,GOLD_EDGE).filter(c=>!(c.x===1&&[1,3,5,7,9].includes(c.y)))),
  character(29, 'Twenty-Nine', GOLD, '#545654', 'Twenty and nine, collecting little number discoveries.', [
    ...grid(2,10,GOLD,GOLD_EDGE),...grid(1,9,(_,y)=>['#b7b9b8','#979b99','#626866'][Math.floor(y/3)],'#666b67').map(c=>({...c,x:2})),
  ]),
  character(30, 'Thirty', '#f7e548', '#b6a326', 'Three golden tens and a crown full of cheerful ideas.', grid(3,10,'#f7e548','#c8af28')),
]);

export function getCharacterDefinition(number) {
  const value = Number(number);
  const index = Number.isFinite(value) ? Math.max(1, Math.min(CHARACTERS.length, Math.round(value))) - 1 : 0;
  return CHARACTERS[index];
}

/** Body width/height; depth and radius include Twenty-One's substantial backpack.
 * The asymmetric pack extends 2.1 units behind the body center. All number cubes
 * remain exactly one unit deep, regardless of the collision footprint.
 */
export function getCharacterMetrics(numberOrDefinition) {
  const data = typeof numberOrDefinition === 'object' && numberOrDefinition?.cells ? numberOrDefinition : getCharacterDefinition(numberOrDefinition);
  const { number: id, width, height } = data, bodyDepth = data.depth ?? Math.max(...data.cells.map(c=>c.z??0))+1;
  const transformed=data.transformed===true||data.formId&&data.formId!=='original';
  const packScale=id===21&&transformed?Math.min(1,width/3,height/7):1;
  const rearExtent = bodyDepth/2 + (id===21?1.6*packScale:0);
  return { width, height, depth: rearExtent + bodyDepth/2, radius: Math.hypot(width / 2, rearExtent) };
}
