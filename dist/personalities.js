/** Pure, local dialogue: no timers, browser APIs, or network services. */
export const EMOTIONS = Object.freeze([
  { id: 'happy', label: 'Happy', icon: '😊' },
  { id: 'excited', label: 'Excited', icon: '🤩' },
  { id: 'curious', label: 'Curious', icon: '🤔' },
  { id: 'surprised', label: 'Surprised', icon: '😮' },
  { id: 'sleepy', label: 'Sleepy', icon: '😴' },
  { id: 'sad', label: 'Sad', icon: '😔' },
].map(Object.freeze));

const PERSONAL = {
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
    happy: ['Count to ten, then explore again!', 'Ten blocks, two rows of five bright smiles!', 'Ten little stars for ten wonderful friends!'],
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
};

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
    happy: ['Hello, mountains! Your peaks make a lovely pattern.', 'A mountain view makes our adventure feel grand.'],
    excited: ['Wow! So many mighty mountain peaks to count!', 'Hooray for mountains and big, bright adventures!'],
    curious: ['How many mountain peaks can we spot together?', 'Why do faraway mountains look so small?'],
    surprised: ['Oh! That mountain is taller than all of us together!', 'Wow! Another mountain peak peeking into the sky!'],
    sleepy: ['A quiet mountain view is wonderfully peaceful.', 'The clouds above those mountains look sleepy.'],
    sad: ['A calm mountain view gives me space to breathe.', 'A friend beside me makes the mountains feel welcoming.'],
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
 */
export function chooseRemark(number, context = {}, random = Math.random) {
  const mood = EMOTIONS.some(item => item.id === context.emotion) ? context.emotion : 'happy';
  const personality = PERSONAL[number] || PERSONAL[1];
  const place = PLACES[context.place];
  const candidates = place
    ? [...place[mood]]
    : [...personality[mood], ...(mood === 'happy' ? [] : MOOD_LINES[mood])];

  if (!place) {
    if (context.moving) candidates.push(MOVING_LINES[mood]);
    if (typeof context.nearbyName === 'string' && context.nearbyName.trim()) {
      candidates.push(FRIEND_LINES[mood](context.nearbyName.trim().slice(0, 20)));
    }
  }

  const alternatives = candidates.filter(text => text !== context.lastText);
  const pool = alternatives.length ? alternatives : candidates;
  const sample = Number(random());
  const unit = Number.isFinite(sample) ? Math.max(0, Math.min(sample, 1)) : 0;
  return { text: pool[Math.min(pool.length - 1, Math.floor(unit * pool.length))], emotion: mood };
}
