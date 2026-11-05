# Developing NumberTown

Start with the [local launch instructions](../README.md#run-locally). Playing requires Python 3.9+ and a WebGL 2 browser. Node.js 22+ is needed only for the JavaScript tests; npm is an optional command wrapper.

## Source and local workflow

**`dist/` is the authoritative, hand-edited source.** The browser loads these HTML, CSS, and JavaScript files directly. There is no duplicate `src/` tree, transpiler, bundler, or generated build step. Edit the files in `dist/` and refresh the browser.

`serve.py` uses only the Python standard library. It serves the `dist/` beside the script, independently of the current working directory, and defaults to `127.0.0.1:5181`. Run it from the repository root with `python3 serve.py`, or pass its absolute path from another directory. Use `--port 5182` for another local port and Ctrl+C to stop it. `npm start` invokes this same launcher.

The renderer is vendored in `dist/vendor/`: Three.js r180 and its MIT license. The game uses local modules and procedural geometry, so it needs no package installation or external asset downloads. Keep the vendored modules and license together when updating the renderer.

## Source map

Paths below are relative to the repository root.

| File | Responsibility |
| --- | --- |
| `serve.py` | Local HTTP launcher and command-line options |
| `package.json` | Optional start and JavaScript test commands |
| `dist/index.html`, `dist/styles.css` | Game controls, dialogs, layout, and responsive styling |
| `dist/game.js` | Scene setup, camera, input, selection, game loop, and interface integration |
| `dist/character-data.js` | Number identities, cube layouts, display dimensions, and collision sizes |
| `dist/characters3d.js` | Character geometry, expressions, accessories, and animation |
| `dist/arrangements.js` | Factor rectangles, connected irregular forms, seeded random growth, and safe shape placement |
| `dist/character-shortcut.js` | Tab-and-number selection, validation, and focus behavior |
| `dist/geography.js` | Shared world bounds, river course, coast, bridges, hills, and activity offsets |
| `dist/world-data.js` | Buildings, roads, scenery obstacles, destinations, and spawn positions |
| `dist/world3d.js` | Town geometry, spinning cube statue, pond, vegetation, and furniture |
| `dist/terrain-data.js`, `dist/terrain.js` | Walking heights and collision data; river, bridges, hill, beach, and sea rendering |
| `dist/mountain-route.js` | Summit route, elevations, boundaries, landmarks, and progress |
| `dist/mountain-summit.js` | Mountain surfaces, paving, summit deck, and scenery |
| `dist/park.js` | Ferris wheel, upright cabins, and park scenery |
| `dist/football.js` | Pitch and ball geometry, kicks, dribbling, physics, scoring, and reset |
| `dist/water-ball.js` | Beach ball geometry, pickup, carrying, throw arcs, buoyancy, shoreward current, and sand drag |
| `dist/sea-life.js` | Fish schools, sea stars, and turtles with swimming, beach approach, and basking cycles |
| `dist/swimming.js` | Absolute swimming altitude, Z/X controls, seabed and surface limits |
| `dist/underwater-garden.js` | Garden road loop, marine plants, crabs, corals and sea urchins |
| `dist/train-park.js` | Eastern landscapes, animals, track, occupied train movement and boarding |
| `dist/animal-facts.js` | Animal facts and proximity encounters with depth checks and cooldowns |
| `dist/water-view.js` | Depth, complete character immersion, and underwater camera transitions |
| `dist/ground-marker.js` | Selection ring and shadow that follow sloping ground |
| `dist/town-map.js`, `dist/map-view.js` | Large map, bounded pan/zoom, follow marker, responsive destinations, and label visibility |
| `dist/road-flowers.js` | Deterministic verge planting clear of roads, doors, water, and activities |
| `dist/town-pets.js` | Twenty instanced cats/dogs, validated road graph, wandering, and approach greetings |
| `dist/assets/audio/` | Bundled CC0 dog recording and source/license credits |
| `dist/numberblobs.js` | Ninety instanced bouncing residents, shared road graph, home entrance routes, and proximity greetings |
| `dist/numberblob-dialogue.js` | Thirty shuffled responses, readable math, and separate robot speech profiles |
| `dist/pet-sounds.js` | Recorded dog barks, generated meows, gesture-based activation, and cancellation of playing/pending audio |
| `dist/camera-clearance.js` | Roof and wall sight lines; gentle automatic camera lift |
| `dist/navigation.js` | Camera-relative movement, collision checks, and safe positions |
| `dist/roaming.js` | Destination choice, route planning, and unselected character movement |
| `dist/scenic-stay.js` | Hill and mountain regions where user-controlled friends retain their position |
| `dist/personalities.js` | Emotions, contextual dialogue, and truthful math facts for the current form |
| `dist/voice-profiles.js` | Stable per-number pitch, rate, volume and available English voice selection |
| `references/characters/` | Available original user-supplied character references and archive index |
| `dist/math-conversations.js`, `dist/number-encounters.js` | Exact pair arithmetic, spatial meetings, and conversation cooldowns |
| `dist/speech.js` | Conversion of written equations into spoken operator words |
| `dist/vendor/` | Pinned Three.js modules and license |
| `tests/` | JavaScript behavior and geometry checks; Python launcher checks |

## Working with game data

World coordinates use **+x east, +z south, and y up**. The world is 1,360 units wide, from x = −320 to 1040; z runs from −90 to 690, making its full north–south span 780 units. Shared geographic data drives rendering, collision boundaries, and the map. Keep these representations aligned when changing a place. The town island ends at the coastline; the bay has its own sloping sand geometry and a transparent water surface. The seabed uses the same height function as walking and wildlife, reaching −18 beyond the 120-unit descent.

Characters are identified by their **number**, from 0 through 50. The cast has 51 entries, so its length is not its highest number. Zero has no occupied cube cells but has finite display and navigation dimensions. One through Fifty have exactly their number of unit cubes.

Arrangement changes preserve number identity, exact cube count and the color/outline multiset. Every arrangement uses unique integer grid cells connected through cube faces. `createCrazyArrangement(number, seed)` generates a deterministic bounded random form; Shift + T supplies a fresh seed. Shape metadata labels irregular bodies without treating their bounding rectangle as a filled body. Arrangement changes preserve number identity and cube colors. Use the current definition for geometry, collision size, and shape-specific speech. Math facts distinguish a number property, such as 27 being a cube number, from the shape currently being shown. The game limits number dialogue to the selected character; nearby cats and dogs have their own brief greeting bubbles and calls. Pet and number movement share dynamic collision avoidance without adding moving pets to cached static navigation grids. Animal encounters share the same speech pipeline, with global and per-species cooldowns. Swimming stores the absolute feet height in `swimY`; camera, carrying, immersion and character rendering all use that height. Empty trains never advance their motion clock. Switching characters and fast travel disembark before changing the active friend or position.

## Tests

Run commands from the repository root. No dependency installation is required.

With **Node.js 22+**, run the JavaScript suite:

```sh
npm test
```

The equivalent command without npm is:

```sh
node --test --test-concurrency=1 tests/*.test.js
```

Tests cover character geometry and arrangements, counts, controls, collision and terrain behavior, roaming and scenic stays, football, beach ball physics, shallow-water boundaries, park animation, math facts, and speech conversion. Test files run sequentially so CPU-heavy suites do not compete with roaming frame-budget checks.

Run the Python launcher tests with Python 3.9+:

```sh
python3 -m unittest discover -s tests -p 'test_*.py'
```

## Browser checks

Open [http://127.0.0.1:5181/?debug=1](http://127.0.0.1:5181/?debug=1) for coordinates, camera angles, shape and cube counts, rendering statistics, roaming/staying state, beach ball position and carrier, and runtime errors. Adjust the port in the URL if you started a different one.

For interface or rendering changes, check the affected behavior in the browser as well as the relevant tests. Useful checks include Zero and a wide transformed character, number entry and keyboard focus, touch controls at a narrow viewport, collision near scenery, and the map’s destination buttons. Changes to character speech should keep the displayed equation intact and stop the previous voice when switching friends.

See the [playing guide](PLAYING.md) for the expected controls and activities.

The current geographic bounds are x = −320 to 1040, z = −90 to 690. `WORLD.width` remains the east boundary; use `WORLD.width - WORLD.minX` for the horizontal span. Houses/stores are generated in `world-data.js`, and each bank’s counts appear in `?debug=1` diagnostics. The train park’s authored scenery is offset through `TRAIN_PARK_OFFSET`, while all public coordinates and physics use world space.

Number encounters use body-edge distance and vertical separation. Only the active visible character speaks, with a shared 12-second quiet interval, a 45-second unordered-pair cooldown, and alternating solo/nearby math. Named voices must be recognized natural English voices; browser-default English is the fallback. Speaker identities are deduplicated across quality variants, preferring premium/enhanced local voices. Each of the 51 characters has a stable pitch/pace combination, within pitch 0.90–1.16 and rate 0.90–1.08, at full volume. Adjacent profiles contrast even with one installed voice.

Dog greetings use `dist/assets/audio/dog-bark.wav`, a bundled recording decoded once when sound is enabled. A pending greeting is canceled if sound is muted, the friend changes, or another pet call replaces it. The debug panel shows `pets.audio.bark` (`idle`, `loading`, `ready`, or `unavailable`) and pending/playing state. Fetch or decoding failure leaves the game and cat calls working.

Numberblob homes share `NUMBERBLOB_HOMES` entrance metadata with the hollow house models. Ordinary characters still collide with whole houses. A blob may ignore only its destination house obstacle while following its own validated doorway corridor; other walls, water and residents stay solid. The simulation reuses the pets’ road graph instead of running ninety path searches each frame. Numberblobs are residents, not selectable Numberblocks, and do not contribute to cube totals. Their thirty-response shuffled bag is shared across the town. Blob greetings and selected-character facts share the speech channel and alternate, with global/per-resident cooldowns. The debug panel exposes resident positions, movement and home visits under `numberblobs`.

The original user-supplied Numberblob pictures are archived unchanged in `references/numberblobs/`.
