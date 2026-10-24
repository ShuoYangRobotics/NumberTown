# Numberblock Town

A cheerful isometric town starring ten colorful Numberblock friends inspired by the provided references. The expanded neighborhood has cottages, shops, a new town square, and a library with a reading garden. Buildings, roads, trees, water, and characters are drawn directly with Canvas; no image assets or runtime dependencies are needed.

## Play

Serve `dist/` with any static server, for example `python3 -m http.server 5180 --directory dist`, and open `http://localhost:5180`.

- **WASD / arrow keys:** walk around the town.
- **1–9 / 0 / character cards:** choose a friend (0 selects Ten). Each friend keeps their own position.
- **Space:** hop.
- **E / feeling menu:** change the selected friend's expression. Feelings also change naturally while exploring.
- **Town square / Library / Gardens:** visit a destination immediately, or walk there along the connected streets.
- **+ / −:** zoom.
- **House icon:** bring the selected friend to the new town square.
- Touch screens have a direction pad and Hop button.

Buildings, trees, water, and the rounded island edges block movement. Wider friends have wider collision footprints. Characters can walk on roads or grass. Friends share short, personality-specific thoughts periodically, and react to their location and feelings. Speech bubbles always appear; optional spoken words use browser speech synthesis when sound is enabled and a voice is available. Voices and sound effects start muted. The question-mark button opens the controls. Focus loss clears held movement keys. Aside from optional Google Fonts and browser-dependent voices, the game works offline once served.

Six uses a 2×3 block layout, Seven a 1×7 rainbow stack, Eight 2×4, Nine 3×3, and Ten 2×5. Happy, excited, curious, surprised, sleepy, and sad expressions are available for every character.

## Source

- `dist/game.js`: game loop, camera, input, character selection, audio, and UI.
- `dist/town.js`: town artwork and collision geometry.
- `dist/characters.js`: animated character artwork.
- `dist/personalities.js`: emotions and contextual character dialogue.
- `dist/physics.js`: movement projection and collisions.

Run `npm test` or `node --test tests/*.test.js` for the movement and collision checks.
