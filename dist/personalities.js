/** Pure, local dialogue: no timers, browser APIs, or network services. */
import { CHARACTERS } from './character-data.js';

export const EMOTIONS = Object.freeze([
  { id: 'happy', label: 'Happy', icon: '😊' },
  { id: 'excited', label: 'Excited', icon: '🤩' },
  { id: 'curious', label: 'Curious', icon: '🤔' },
  { id: 'surprised', label: 'Surprised', icon: '😮' },
  { id: 'sleepy', label: 'Sleepy', icon: '😴' },
  { id: 'sad', label: 'Sad', icon: '😔' },
].map(Object.freeze));

const PERSONAL = {
  0: {
    happy: ['Zero blocks, and a big hello!', 'Zero has no blocks, but plenty of smiles.', 'Nothing to count? That is my cue!'],
    excited: ['Zero blocks! I’m still ready for an adventure!'],
    curious: ['What happens when we add zero to a number?'],
    surprised: ['Oh! Zero blocks, and one big surprise!'],
    sleepy: ['Zero blocks to tuck in. Time for a little rest.'],
    sad: ['Zero blocks or many, everyone belongs here.'],
  },
  1: {
    happy: ['One little block, one big adventure!', 'Every adventure starts with one step.', 'I may be small, but I can explore!'],
    excited: ['One, two, whee! Let’s go exploring!'],
    curious: ['What can one little block discover today?'],
    surprised: ['Oh! That is one big surprise!'],
    sleepy: ['One little yawn. Time for a tiny rest.'],
    sad: ['I feel small today. One kind friend can help.'],
  },
  2: {
    happy: ['Everything is twice as fun with a friend!', 'Two blocks, two feet, and lots to see!', 'One and one makes two. That’s me!'],
    excited: ['Two cheers for a brand new adventure!'],
    curious: ['Can we spot two things that go together?'],
    surprised: ['Oh! I had to look twice!'],
    sleepy: ['Two sleepy eyes need a little rest.'],
    sad: ['A quiet walk together would cheer me up.'],
  },
  3: {
    happy: ['Three cheers for our lovely town!', 'My crown makes every walk a parade.', 'One, two, three! Come imagine with me!'],
    excited: ['Ta-da! Three cheers and a royal hop!'],
    curious: ['Could we imagine three new adventures?'],
    surprised: ['Oh my crown! What a surprise!'],
    sleepy: ['Even a crown needs a bedtime story.'],
    sad: ['My sparkle feels dim. A kind word helps.'],
  },
  4: {
    happy: ['Four blocks and a whole town of friends!', 'I love a lovely little square.', 'Four cheers for green and growing things!'],
    excited: ['Four, three, two, one… adventure time!'],
    curious: ['Can you find something with four corners?'],
    surprised: ['Oh! That surprised all four of my blocks!'],
    sleepy: ['A soft, square cushion sounds lovely.'],
    sad: ['I feel a little blue in my green blocks.'],
  },
  5: {
    happy: ['High five, little explorer!', 'Five blocks and a sky full of dreams!', 'A friendly wave makes my stars sparkle.'],
    excited: ['High five! Let’s reach for the stars!'],
    curious: ['Can we find five wonderful things today?'],
    surprised: ['Wow! That deserves a high five!'],
    sleepy: ['Five sleepy fingers, one little yawn.'],
    sad: ['A gentle high five would brighten my day.'],
  },
  6: {
    happy: ['Six dots! I’m ready for a friendly game.', 'Roll a die and count the dots with me!', 'Six blocks make a splendid team!'],
    excited: ['Six cheers! Who is ready for a game?'],
    curious: ['How many dots can you find on a die?'],
    surprised: ['Oh! Six dots! What a lucky roll!'],
    sleepy: ['Game time can wait. My six dots feel sleepy.'],
    sad: ['A game with a friend could cheer me up.'],
  },
  7: {
    happy: ['Seven rainbow colors make my day!', 'A rainbow of friends is my kind of luck.', 'Red to violet, every color belongs!'],
    excited: ['Lucky me! A whole rainbow of adventures!'],
    curious: ['Where could we find all seven rainbow colors?'],
    surprised: ['Oh! A colorful little surprise!'],
    sleepy: ['My rainbow needs a soft, cloudy nap.'],
    sad: ['Cloudy feelings pass. My colors are still here.'],
  },
  8: {
    happy: ['Eight blocks and lots of helping hands!', 'Need a hand? I have plenty to share!', 'Many hands make a cheerful team!'],
    excited: ['All my hands are waving hello!'],
    curious: ['What could we build with so many helping hands?'],
    surprised: ['Oh! Every one of my hands is surprised!'],
    sleepy: ['All my helping hands could use a rest.'],
    sad: ['Even helpers need a little help sometimes.'],
  },
  9: {
    happy: ['Three rows of three. A perfect little square!', 'Nine blocks, neatly together!', 'Three by three, that’s square little me!'],
    excited: ['Nine cheers! Our square is ready for adventure!'],
    curious: ['Can you count my three rows of three?'],
    surprised: ['Oh! That surprised all nine of my blocks!'],
    sleepy: ['Three rows of sleepy blocks. Yaaawn.'],
    sad: ['My square feels quiet. A friend can sit with me.'],
  },
  10: {
    happy: ['Count to ten, then explore again!', 'Five rows of two blocks. That makes ten!', 'Ten little stars for ten wonderful friends!'],
    excited: ['Ten, nine, eight… let’s blast off into fun!'],
    curious: ['What shall we count all the way to ten?'],
    surprised: ['Wow! Ten out of ten for that surprise!'],
    sleepy: ['I’ll count ten gentle breaths and rest.'],
    sad: ['I’ll take a breath. It’s okay to feel quiet.'],
  },
  11: {
    happy: ['Eleven friends make a whole football team!', 'Pass the ball! Everyone gets a turn.', 'A friendly football game makes my day.'],
    excited: ['Goal! Three cheers for our whole team!'],
    curious: ['How many passes can our football team make?'],
    surprised: ['Wow! That football took a surprising bounce!'],
    sleepy: ['Half-time! My football boots could use a rest.'],
    sad: ['I missed a goal. My team can help me try again.'],
  },
  12: {
    happy: ['Three by four, or two by six. Super rectangles!', 'Twelve blocks, so many rectangles to explore!', 'A super rectangle is ready to help!'],
    excited: ['Super rectangles to the rescue!'],
    curious: ['How many rectangles can my twelve blocks make?'],
    surprised: ['Oh! Another way to make a twelve-block rectangle!'],
    sleepy: ['Even super rectangles need a cozy rest.'],
    sad: ['Even a super rectangle needs a little kindness.'],
  },
  13: {
    happy: ['Thirteen blocks, and another chance to try!', 'A wobble won’t stop my next adventure.', 'Lucky or not, I can keep trying!'],
    excited: ['Thirteen cheers! I’m ready to try again!'],
    curious: ['What can I learn from that little wobble?'],
    surprised: ['Oops! A surprise wobble. I’ll find my balance.'],
    sleepy: ['I’ll rest now and try again after a little nap.'],
    sad: ['That tumble felt tough. I can rest and try again.'],
  },
  14: {
    happy: ['Fourteen blocks, ready for a rainbow ride!', 'My skateboard and I love a gentle roll.', 'Two sevens make fourteen rainbow blocks!'],
    excited: ['Whee! A rainbow ride on my skateboard!'],
    curious: ['Where will a gentle skateboard ride take me?'],
    surprised: ['Whoa! My skateboard found a little bump!'],
    sleepy: ['I’ll park my skateboard and take a little rest.'],
    sad: ['A quiet rainbow moment could brighten my day.'],
  },
  15: {
    happy: ['My staircase has five steps and fifteen blocks!', 'One plus two plus three plus four plus five makes fifteen!', 'Step Squad, let’s help each other climb!'],
    excited: ['Step Squad, up we go! One happy step at a time!'],
    curious: ['How do five growing steps make fifteen blocks?'],
    surprised: ['Oh! What a surprising view from my top step!'],
    sleepy: ['Fifteen sleepy blocks. Time for a staircase rest.'],
    sad: ['A small step is enough today. My squad is here.'],
  },
  16: {
    happy: ['Sixteen blocks, ready for a square dance!', 'A square party is my kind of celebration.', 'Four by four, let’s square-dance across the floor!'],
    excited: ['Sixteen cheers! Time for a super square dance!'],
    curious: ['What patterns can we make at our square party?'],
    surprised: ['Oh! A surprise guest at my square dance!'],
    sleepy: ['Sixteen sleepy blocks. The square dance can wait.'],
    sad: ['Even a square dancer can take a quiet moment.'],
  },
  17: {
    happy: ['Seventeen blocks, and a world of colors to paint!', 'My next painting starts with one bright idea.', 'A rainbow and a paintbrush make me smile!'],
    excited: ['Seventeen cheers! Let’s paint a colorful adventure!'],
    curious: ['Which colors could I mix for my next painting?'],
    surprised: ['Oh! My paintbrush made a wonderful new color!'],
    sleepy: ['My paintbrush can rest until tomorrow.'],
    sad: ['I can paint my feelings, one gentle color at a time.'],
  },
  18: {
    happy: ['Eighteen blocks, ready for a super rectangle rescue!', 'So many rectangles, so many ways to help!', 'Three by six or two by nine: rectangle time!'],
    excited: ['Eighteen cheers! Super rectangles to the rescue!'],
    curious: ['Which rectangle will help our friends today?'],
    surprised: ['Wow! A new rectangle to try with eighteen blocks!'],
    sleepy: ['This super rectangle is ready for a rest.'],
    sad: ['Even a rectangle hero can ask a friend for help.'],
  },
  19: {
    happy: ['Nineteen blocks, and so many shapes to imagine!', 'A surprising shape can be a work of art.', 'One less than twenty, full of creative ideas!'],
    excited: ['Nineteen cheers! Let’s invent a brand new shape!'],
    curious: ['What creative shape could my nineteen blocks make?'],
    surprised: ['Oh! That unexpected shape gives me a new idea!'],
    sleepy: ['My shape ideas can wait for a little rest.'],
    sad: ['My shape is my own. A kind friend helps me remember.'],
  },
  20: {
    happy: ['Twenty blocks, ready to dance through town!', 'Two tens make a wonderful dancing team!', 'A little dance puts a spring in my twenty blocks.'],
    excited: ['Twenty cheers! Let’s dance into our next adventure!'],
    curious: ['Can we invent a dance with two teams of ten?'],
    surprised: ['Oh! That surprise deserves a little dance!'],
    sleepy: ['Twenty dancing blocks need a quiet rest.'],
    sad: ['A gentle dance with a friend might brighten my day.'],
  },
  21: {
    happy: ['Twenty-one blocks, and a backpack full of adventures!', 'My backpack and I are ready to explore.', 'Three by seven, ready for a traveler’s adventure!'],
    excited: ['Backpack ready! Twenty-one cheers for a new journey!'],
    curious: ['Which path should this curious traveler explore next?'],
    surprised: ['Oh! A surprising sight on my backpack adventure!'],
    sleepy: ['My backpack and I could use a little rest.'],
    sad: ['A traveler can rest and ask a friend for company.'],
  },
  22: {
    happy: ['Twenty-two blocks, with two perched up top!', 'My two top blocks are ready for a new adventure.', 'Twenty and two make a cheerful crew!'],
    excited: ['Twenty-two cheers! My two top blocks are ready!'],
    curious: ['What can my two top blocks spot from up here?'],
    surprised: ['Oh! Both of my two top blocks are surprised!'],
    sleepy: ['Twenty-two sleepy blocks need a cozy pause.'],
    sad: ['My two top blocks feel quiet. A kind friend helps.'],
  },
  23: {
    happy: ['Twenty-three blocks, with a sunny yellow side!', 'My three yellow blocks bring a little sunshine.', 'Twenty and three, come exploring with me!'],
    excited: ['Twenty-three cheers! My yellow blocks are glowing!'],
    curious: ['What can my three yellow blocks discover today?'],
    surprised: ['Oh! That surprised all three of my yellow blocks!'],
    sleepy: ['My three yellow blocks could use a gentle rest.'],
    sad: ['Even sunny yellow blocks have quiet days.'],
  },
  24: {
    happy: ['Twenty-four blocks, with green at my center!', 'Three by eight, ready for a rectangle adventure!', 'This rectangle has a little green heart for friends.'],
    excited: ['Twenty-four cheers! Another rectangle adventure!'],
    curious: ['How many rectangles can my twenty-four blocks make?'],
    surprised: ['Wow! A new rectangle for my twenty-four blocks!'],
    sleepy: ['This green-centered rectangle could use a rest.'],
    sad: ['A rectangle friend can share a quiet moment with me.'],
  },
  25: {
    happy: ['Twenty-five blocks, ready for a square celebration!', 'Five by five, with a bright bottom row!', 'A big square and a high five for every friend!'],
    excited: ['Twenty-five cheers! A whole square full of joy!'],
    curious: ['Can we find five things along each side of my square?'],
    surprised: ['Oh! That surprised all twenty-five of my blocks!'],
    sleepy: ['Five rows of sleepy blocks. Time for a square rest.'],
    sad: ['My square can feel quiet. A gentle high five helps.'],
  },
  26: {
    happy: ['Twenty-six blocks, ready for a friendly mission!', 'My hat and shades are ready for an adventure.', 'Six purple blocks and a mission to help our friends!'],
    excited: ['Agent Twenty-Six is ready! Let’s solve a friendly puzzle!'],
    curious: ['What clues can this curious agent find around town?'],
    surprised: ['Oh! That clue surprised the agent under this hat!'],
    sleepy: ['Even a friendly agent needs a little rest.'],
    sad: ['This agent can ask a trusted friend for a little help.'],
  },
  27: {
    happy: ['Twenty-seven blocks, with depth to discover!', 'Three by three by three. A whole cube of possibilities!', 'A cube-shaped friend loves building new ideas!'],
    excited: ['Twenty-seven cheers! A whole cube full of adventures!'],
    curious: ['What can we discover on every side of my cube?'],
    surprised: ['Wow! A surprise around the corner of my cube!'],
    sleepy: ['This little cube could use a quiet rest.'],
    sad: ['A friend beside my cube can help me feel less alone.'],
  },
  28: {
    happy: ['Twenty-eight blocks and five windows for wonder!', 'My frame lets little glimpses of town shine through.', 'Twenty and eight make a bright magenta team!'],
    excited: ['Twenty-eight cheers! Peek through my playful frame!'],
    curious: ['What can we spot through the holes in my frame?'],
    surprised: ['Oh! A surprising view through my frame!'],
    sleepy: ['This frame of twenty-eight blocks is feeling sleepy.'],
    sad: ['A kind friend can share a quiet view through my frame.'],
  },
  29: {
    happy: ['Twenty-nine blocks, and lots of thoughtful ideas!', 'Nine gray blocks and twenty golden reasons to smile.', 'My gray blocks love a gentle moment to think.'],
    excited: ['Twenty-nine cheers! I have a bright new idea!'],
    curious: ['What can my nine gray blocks help us figure out?'],
    surprised: ['Oh! That surprised all nine of my gray blocks!'],
    sleepy: ['My gray blocks are ready for a quiet rest.'],
    sad: ['Gray blocks can have bright feelings again, in their own time.'],
  },
  30: {
    happy: ['Thirty cheers for a kind and colorful town!', 'My crown makes every friendly walk feel royal.', 'Three by ten, ready for a royal adventure!'],
    excited: ['Thirty royal cheers! Let’s celebrate together!'],
    curious: ['What can this curious crowned friend discover today?'],
    surprised: ['Oh my crown! A surprise for all thirty blocks!'],
    sleepy: ['Even a crown and thirty blocks need a cozy rest.'],
    sad: ['My crown can rest. A kind friend matters more today.'],
  },
};

const CHARACTER_NUMBERS = new Set(CHARACTERS.map(character => character.number));
const characterNumber = number => {
  const value = typeof number === 'number' || typeof number === 'string' && number.trim() !== '' ? Number(number) : NaN;
  return Number.isInteger(value) && CHARACTER_NUMBERS.has(value) ? value : 1;
};

/** Validate and measure unit-cube positions, including genuine depth. */
function measureArrangement(number, definition) {
  if (number === 0 || !definition || !Array.isArray(definition.cells) || definition.cells.length !== number
    || (definition.number !== undefined && definition.number !== number)) return null;
  if (definition.cells.some(cell => !cell || typeof cell !== 'object')) return null;
  const cells = definition.cells.map(cell => ({ x: cell.x, y: cell.y, z: cell.z ?? 0 }));
  if (cells.some(cell => ![cell.x, cell.y, cell.z].every(Number.isSafeInteger))) return null;
  const coordinates = new Set(cells.map(cell => `${cell.x},${cell.y},${cell.z}`));
  if (coordinates.size !== number) return null;
  const minX = Math.min(...cells.map(cell => cell.x)), minY = Math.min(...cells.map(cell => cell.y));
  const minZ = Math.min(...cells.map(cell => cell.z));
  const width = Math.max(...cells.map(cell => cell.x)) - minX + 1;
  const height = Math.max(...cells.map(cell => cell.y)) - minY + 1;
  const depth = Math.max(...cells.map(cell => cell.z)) - minZ + 1;
  if (width > number || height > number || depth > number) return null;
  const has = (x, y, z = 0) => coordinates.has(`${x + minX},${y + minY},${z + minZ}`);
  return { width, height, depth, cells, minX, has };
}

/** Derive short facts from arithmetic and the CURRENT unit-cube layout. */
function buildMathFacts(number, definition) {
  const facts = new Set([`I have ${number} ${number === 0 ? 'blocks' : number === 1 ? 'block' : 'equal blocks'}.`]);
  if (number === 0) {
    facts.add('0 + 0 = 0.');
    facts.add('0 - 0 = 0.');
    // Zero has no occupied cubes or positive-sized factor rectangles. Its
    // identities can have a nonzero result, and every divisor must be nonzero.
    for (const value of [2, 5]) {
      facts.add(`${value} + 0 = ${value}.`);
      facts.add(`0 + ${value} = ${value}.`);
      facts.add(`${value} - 0 = ${value}.`);
      facts.add(`${value} - ${value} = 0.`);
      facts.add(`${value} × 0 = 0.`);
      facts.add(`0 × ${value} = 0.`);
      facts.add(`0 divided by ${value} is 0.`);
    }
    facts.add('0 is even: 0 pairs of blocks.');
    facts.add('0 is neither prime nor composite.');
    facts.add('0 is a square number: 0 × 0 = 0.');
    facts.add('0 is a cube number: 0 × 0 × 0 = 0.');
    return Object.freeze([...facts]);
  }
  const add = (a, b) => facts.add(`${a} + ${b} = ${number}.`);
  add(Math.floor(number / 2), Math.ceil(number / 2));
  if (number >= 10) add(10, number - 10);
  if (number > 20) add(20, number - 20);
  if (number > 1) add(number - 1, 1);
  if (number > 1 && Number.isInteger(Math.sqrt(number))) add(number - Math.sqrt(number), Math.sqrt(number));
  facts.add(`${number + 1} - 1 = ${number}.`);
  facts.add(`${number * 2} divided by 2 is ${number}.`);
  facts.add(number % 2 === 0
    ? `${number} is even: ${number / 2} pairs of blocks.`
    : `${number} is odd: ${Math.floor(number / 2)} pairs and 1 left over.`);

  const factors = [];
  for (let a = 1; a * a <= number; a++) {
    if (number % a === 0) factors.push([a, number / a]);
  }
  const shape = measureArrangement(number, definition);
  if (shape?.depth === 1 && shape.width * shape.height === number) {
    const { width, height } = shape;
    facts.add(`I am a ${width} by ${height} ${width === height ? 'square' : 'rectangle'}!`);
  }
  if (shape && shape.depth > 1 && shape.width * shape.height * shape.depth === number
    && shape.width === shape.height && shape.height === shape.depth) {
    facts.add(`I am a ${shape.width} by ${shape.height} by ${shape.depth} cube!`);
  }
  for (const [a, b] of factors) {
    facts.add(`${a} × ${b} = ${number}.`);
    facts.add(`I can arrange into a ${a} by ${b} ${a === b ? 'square' : 'rectangle'}!`);
  }
  if (number === 1) facts.add('1 is neither prime nor composite.');
  else if (factors.length === 1) facts.add(`${number} is prime: its only factors are 1 and ${number}.`);
  else {
    const [a, b] = factors[1];
    facts.add(`${number} is composite: ${a} × ${b} = ${number}.`);
  }
  const root = Math.sqrt(number);
  if (Number.isInteger(root)) facts.add(`${number} is a square number: ${root} × ${root} = ${number}.`);
  const cubeRoot = Math.round(Math.cbrt(number));
  if (cubeRoot ** 3 === number) facts.add(`${number} is a cube number: ${cubeRoot} × ${cubeRoot} × ${cubeRoot} = ${number}.`);

  if (shape?.depth === 1) {
    const columns = Array.from({ length: shape.width }, (_, x) => shape.cells.filter(cell => cell.x === x + shape.minX).length);
    if (columns.length > 1 && columns.every((height, x) => height === x + 1
      && Array.from({ length: height }, (_, y) => shape.has(x, y)).every(Boolean))) {
      facts.add(`My ${columns.length} steps have ${columns.join(' + ')} = ${number} blocks.`);
    }
    if (number === 28 && shape.width === 3 && shape.height === 11) {
      const holes = [];
      for (let x = 0; x < shape.width; x++) for (let y = 0; y < shape.height; y++) {
        if (!shape.has(x, y)) holes.push({ x, y });
      }
      // Each hole is a single empty cell surrounded by the frame's blocks.
      if (holes.length === 5 && holes.every(({ x, y }) => x > 0 && x < shape.width - 1 && y > 0 && y < shape.height - 1
        && shape.has(x - 1, y) && shape.has(x + 1, y) && shape.has(x, y - 1) && shape.has(x, y + 1))) {
        facts.add(`My ${shape.width} by ${shape.height} frame has ${holes.length} holes.`);
        facts.add(`${shape.width * shape.height} - ${holes.length} = ${number}.`);
      }
    }
  }
  return Object.freeze([...facts]);
}

const MATH_FACTS = new Map(CHARACTERS.map(character => [character.number, buildMathFacts(character.number, character)]));

/**
 * Read-only facts for the original shape by default. Pass the current character
 * definition as arrangement after transforming. Malformed arrangements retain
 * numeric facts but omit current-shape claims; invalid numbers use One.
 */
export function getMathFacts(number, arrangement) {
  const normalized = characterNumber(number);
  return arrangement === undefined ? MATH_FACTS.get(normalized) : buildMathFacts(normalized, arrangement);
}

const PLACES = {
  library: {
    happy: ['The library is full of stories to share.', 'Every book is a little adventure!', 'Let’s pick a book and read together.'],
    excited: ['So many books! I can’t wait to choose one!', 'A new story! My inside voice says hooray!'],
    curious: ['What will we discover in this library book?', 'I wonder what is on the next page.'],
    surprised: ['Oh! This story has a surprising ending!', 'Wow! There are so many books here!'],
    sleepy: ['A cozy library story sounds lovely.', 'One gentle bedtime story, please.'],
    sad: ['A comforting story might help me feel better.', 'We can share a quiet book and a kind moment.'],
  },
  'town-square': {
    happy: ['The town square is better with friends!', 'Let’s meet by the fountain and say hello.', 'So many friendly faces in our town square!'],
    excited: ['Hooray! Let’s have a town square parade!', 'Friends, fountains, and fun! I love this square!'],
    curious: ['Who will we meet in the town square today?', 'How many friends can fit around the fountain?'],
    surprised: ['Oh! Look who is in the town square!', 'Wow! The fountain sparkles in the sunlight!'],
    sleepy: ['A quiet bench by the fountain looks cozy.', 'I’ll rest and listen to the gentle fountain.'],
    sad: ['I could use a friend beside me in the square.', 'A quiet moment by the fountain might help.'],
  },
  pond: {
    happy: ['Hello, little ducks! What a lovely pond.', 'The pond is full of happy little ripples.', 'Quack, quack! The ducks are saying hello.'],
    excited: ['Look! A whole parade of waddling ducks!', 'Quack, quack, hooray! Pond adventures!'],
    curious: ['How do ducks make such tiny ripples?', 'I wonder how many ducks live at this pond.'],
    surprised: ['Oh! That duck made a big splash!', 'Wow! A little duck popped up beside us!'],
    sleepy: ['The gentle pond ripples make me sleepy.', 'Even the ducks look ready for a little rest.'],
    sad: ['Watching the gentle ducks helps me feel calm.', 'I’ll take a quiet breath beside the pond.'],
  },
  garden: {
    happy: ['Hello, flowers! You make our town so colorful.', 'Our garden grows a little joy every day.', 'Flowers and friends make a lovely garden.'],
    excited: ['So many flowers! A garden full of color!', 'Look at all those bright, beautiful blossoms!'],
    curious: ['How do these tiny seeds grow into flowers?', 'How many different flowers can we find?'],
    surprised: ['Oh! A new flower has opened!', 'Wow! That blossom is as bright as sunshine!'],
    sleepy: ['The flowers look ready for a gentle doze.', 'A quiet garden rest sounds just right.'],
    sad: ['A gentle moment with the flowers might help.', 'Growing takes time. Feeling better can, too.'],
  },
  park: {
    happy: ['A big green park for little adventures!', 'Trees, paths, and friends. I love our park!'],
    excited: ['Hooray! A whole park to explore together!', 'Let’s count the trees on our park adventure!'],
    curious: ['How many shades of green can we find in the park?', 'I wonder which park path we should explore.'],
    surprised: ['Oh! That tree is taller than all my blocks!', 'Wow! Our park has so many little paths!'],
    sleepy: ['A shady park bench looks wonderfully cozy.', 'The park trees are whispering a sleepy song.'],
    sad: ['A gentle walk in the park might help today.', 'I can share a quiet park bench with a friend.'],
  },
  football: {
    happy: ['Pass the football! Everyone gets a turn.', 'Playing together is the best part of football!'],
    excited: ['Goal! Hooray for our whole team!', 'A friendly football match! Let’s get kicking!'],
    curious: ['Which way will the football roll next?', 'How many passes can we make before a goal?'],
    surprised: ['Oh! What a surprising bounce from that ball!', 'Wow! That ball rolled right into the goal!'],
    sleepy: ['Half-time! The football can rest for a moment.', 'A little rest, then another friendly game of football.'],
    sad: ['Missed a goal? We can help each other try again.', 'Our football team has room for every feeling.'],
  },
  hill: {
    happy: ['One little hill, so many wonderful views!', 'Every step up this hill is an adventure.'],
    excited: ['Up the hill we go! Look at that lovely view!', 'Hooray! A whole town to spot from the hill!'],
    curious: ['What can we see from the top of this hill?', 'How many steps will take us up this hill?'],
    surprised: ['Wow! The view from this hill goes on and on!', 'Oh! Our town looks tiny from up this hill!'],
    sleepy: ['That hill climb calls for a little rest.', 'A quiet moment with this hilltop view sounds nice.'],
    sad: ['One small step up the hill is enough today.', 'A friend and a gentle hilltop breeze might help.'],
  },
  river: {
    happy: ['Hello, river! Your ripples look like little smiles.', 'The river has a lovely, gentle song.'],
    excited: ['Look at those sparkly river ripples!', 'A river adventure! Let’s explore the bank together.'],
    curious: ['Where do all these river ripples go?', 'How many sparkles can we spot on the river?'],
    surprised: ['Oh! That river sparkle looks like a tiny star!', 'Wow! The river winds all the way around that bend!'],
    sleepy: ['The gentle river sounds make me feel cozy.', 'I’ll rest by the river and listen to its song.'],
    sad: ['A quiet moment beside the river might help.', 'I can take a gentle breath and watch the river flow.'],
  },
  beach: {
    happy: ['Hello, sea! Let’s count the waves from the beach.', 'Warm sand and sea breezes make a lovely adventure.'],
    excited: ['Hooray! A whole beach of sandy possibilities!', 'Wave hello to the waves! We made it to the sea!'],
    curious: ['How many waves can we count along the shore?', 'I wonder where the river meets the sea.'],
    surprised: ['Wow! The sea stretches so far beyond the beach!', 'Oh! That wave made a sparkly line along the shore!'],
    sleepy: ['The gentle waves sound like a sleepy sea song.', 'A quiet rest on the beach sounds lovely.'],
    sad: ['A calm moment by the sea might help me feel better.', 'I can take a gentle breath and listen to the waves.'],
  },
  mountains: {
    happy: ['One paved mountain trail leads up to a high viewing deck.', 'A mountain view makes our adventure feel grand.'],
    excited: ['Wow! So many mighty mountain peaks to count!', 'Hooray! Let’s explore the paved mountain trail!'],
    curious: ['Which mountain trail leads to our summit deck?', 'Why do faraway mountains look so small?'],
    surprised: ['Oh! That mountain is taller than all of us together!', 'Wow! Another mountain peak peeking into the sky!'],
    sleepy: ['A quiet mountain view is wonderfully peaceful.', 'The clouds above those mountains look sleepy.'],
    sad: ['A calm mountain view gives me space to breathe.', 'A friend beside me makes the mountains feel welcoming.'],
  },
  'mountain-trail': {
    happy: ['Step by step, this paved trail takes us up the mountain!', 'A winding mountain path is a lovely adventure.'],
    excited: ['Up we go! Let’s follow the mountain trail together!', 'Hooray! Another bend in our paved mountain path!'],
    curious: ['Where does the next bend in this mountain trail lead?', 'How many turns will take us to the summit deck?'],
    surprised: ['Oh! The view changes at every turn of this trail!', 'Wow! This paved trail climbs higher than I expected!'],
    sleepy: ['Slow steps on the mountain trail. I could use a rest.', 'A quiet pause beside the paved path sounds lovely.'],
    sad: ['One small step along the mountain trail is enough today.', 'A friend beside me makes this mountain path feel easier.'],
  },
  summit: {
    happy: ['From the summit, our river winds all the way to the sea!', 'We made it to the high deck. What a wonderful view!'],
    excited: ['Hooray! We reached the mountain summit together!', 'Look at that view! Our summit adventure was worth the climb!'],
    curious: ['How many rooftops can we count from the summit deck?', 'Can you follow the river from this high viewing deck?'],
    surprised: ['Wow! The whole town looks tiny from this summit!', 'Oh! I can see so far from this high viewing deck!'],
    sleepy: ['A peaceful summit view is a lovely reward for our climb.', 'Time for a little rest on the high viewing deck.'],
    sad: ['A quiet summit moment with a friend might help me feel better.', 'It is okay to rest on the deck and enjoy the view slowly.'],
  },
  lookout: {
    happy: ['From this lookout, we can see the town and the sea!', 'What a lovely view of the sea beyond our town.'],
    excited: ['We made it! Look at that sparkling sea view!', 'Hooray! The lookout shows a whole world to explore!'],
    curious: ['Can you spot where the river reaches the sea?', 'How many rooftops can we count from this lookout?'],
    surprised: ['Wow! The sea looks enormous from up here!', 'Oh! Our town looks like a tiny toy from this lookout!'],
    sleepy: ['A quiet sea view is a lovely reward for our climb.', 'I’ll rest at the lookout and enjoy the gentle sea breeze.'],
    sad: ['A kind friend and this peaceful sea view might help.', 'It is okay to rest and take in the lookout view.'],
  },
};

const MOOD_LINES = {
  happy: ['What a lovely day to be together!', 'There is so much to enjoy in our town.'],
  excited: ['Hooray! I’m ready for another adventure!', 'I feel like doing a happy little hop!'],
  curious: ['I wonder what we will discover next.', 'Let’s look closely. What can we notice?'],
  surprised: ['Oh! I wasn’t expecting that!', 'Well, that was a lovely little surprise!'],
  sleepy: ['Yaaawn. A little rest would feel nice.', 'Slow steps today. I’m feeling cozy.'],
  sad: ['I feel a little sad. A kind friend helps.', 'It is okay to have a quiet moment.'],
};

const MOVING_LINES = {
  happy: 'Step by step, there is so much to see!',
  excited: 'Here we go! Adventure is just around the corner!',
  curious: 'I wonder where this little road will lead.',
  surprised: 'Oh! I nearly walked past that!',
  sleepy: 'Slow, sleepy steps. Let’s find a cozy spot.',
  sad: 'A gentle walk might help me feel a little better.',
};

const FRIEND_LINES = {
  happy: name => `Hello, ${name}! Lovely to see you.`,
  excited: name => `${name}! Hooray, a friend to explore with!`,
  curious: name => `${name}, what shall we discover together?`,
  surprised: name => `Oh! Hello, ${name}! You surprised me.`,
  sleepy: name => `${name}, let’s find a quiet spot to rest.`,
  sad: name => `${name}, could you keep me company for a moment?`,
};

/**
 * Return one brief remark with a matching facial emotion. An explicit valid
 * emotion always wins, including at landmarks. Unknown characters use One's
 * personality. A caller-owned lastText prevents immediate repetition without
 * sharing mutable state between characters; random is injectable for tests.
 * math:true guarantees an arithmetic/shape fact and adds kind:'math', while
 * retaining the requested emotion even when a place or walking context exists.
 */
export function chooseRemark(number, context = {}, random = Math.random) {
  const mood = EMOTIONS.some(item => item.id === context.emotion) ? context.emotion : 'happy';
  const personality = PERSONAL[characterNumber(number)] || PERSONAL[1];
  const place = PLACES[context.place];
  const candidates = context.math === true ? [...getMathFacts(number, context.arrangement)] : place
    ? [...place[mood]]
    : [...personality[mood], ...(mood === 'happy' ? [] : MOOD_LINES[mood])];

  if (!place && context.math !== true) {
    if (context.moving) candidates.push(MOVING_LINES[mood]);
    if (typeof context.nearbyName === 'string' && context.nearbyName.trim()) {
      candidates.push(FRIEND_LINES[mood](context.nearbyName.trim().slice(0, 20)));
    }
  }

  const alternatives = candidates.filter(text => text !== context.lastText);
  const pool = alternatives.length ? alternatives : candidates;
  const sample = Number(random());
  const unit = Number.isFinite(sample) ? Math.max(0, Math.min(sample, 1)) : 0;
  return { text: pool[Math.min(pool.length - 1, Math.floor(unit * pool.length))], emotion: mood, ...(context.math === true ? { kind: 'math' } : {}) };
}
