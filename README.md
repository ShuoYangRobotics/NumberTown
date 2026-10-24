# Numberblock Town

A small, cheerful isometric town starring five colorful Numberblock friends inspired by the provided reference. The houses, roads, trees, pond, and characters are drawn directly with Canvas; no image assets or runtime dependencies are needed.

## Play

Serve `dist/` with any static server, for example `python3 -m http.server 5180 --directory dist`, and open `http://localhost:5180`.

- **WASD / arrow keys:** walk around the town.
- **1–5 / character cards:** choose a friend. Each friend keeps their own position.
- **Space:** hop.
- **+ / −:** zoom.
- **House icon:** bring the selected friend back to the town square.
- Touch screens have a direction pad and Hop button.

Buildings, trees, water, and the island edges block movement. Characters can walk on roads or grass. Sound effects are optional and start muted. The question-mark button opens the controls. Focus loss clears held movement keys. Aside from optional Google Fonts, the game works entirely offline once served.

## Source

- `dist/game.js`: game loop, camera, input, character selection, audio, and UI.
- `dist/town.js`: town artwork and collision geometry.
- `dist/characters.js`: animated character artwork.
- `dist/physics.js`: movement projection and collisions.

Run `npm test` or `node --test tests/*.test.js` for the movement and collision checks.
