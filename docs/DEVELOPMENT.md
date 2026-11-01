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
| `dist/arrangements.js` | Factor rectangles, original forms, and safe placement when changing shape |
| `dist/character-shortcut.js` | Tab-and-number selection, validation, and focus behavior |
| `dist/geography.js` | Shared world bounds, river course, coast, bridges, hills, and activity offsets |
| `dist/world-data.js` | Buildings, roads, scenery obstacles, destinations, and spawn positions |
| `dist/world3d.js` | Town geometry, spinning cube statue, pond, vegetation, and furniture |
| `dist/terrain-data.js`, `dist/terrain.js` | Walking heights and collision data; river, bridges, hill, beach, and sea rendering |
| `dist/mountain-route.js` | Summit route, elevations, boundaries, landmarks, and progress |
| `dist/mountain-summit.js` | Mountain surfaces, paving, summit deck, and scenery |
| `dist/park.js` | Ferris wheel, upright cabins, and park scenery |
| `dist/football.js` | Pitch and ball geometry, kicks, dribbling, physics, scoring, and reset |
| `dist/town-map.js` | Map geometry, destination buttons, and player marker |
| `dist/navigation.js` | Camera-relative movement, collision checks, and safe positions |
| `dist/roaming.js` | Destination choice, route planning, and unselected character movement |
| `dist/personalities.js` | Emotions, contextual dialogue, and truthful math facts for the current form |
| `dist/speech.js` | Conversion of written equations into spoken operator words |
| `dist/vendor/` | Pinned Three.js modules and license |
| `tests/` | JavaScript behavior and geometry checks; Python launcher checks |

## Working with game data

World coordinates use **+x east, +z south, and y up**. The world is 440 units wide; z runs from −90 to 460, making its full north–south span 550 units. Shared geographic data drives rendering, collision boundaries, and the map. Keep these representations aligned when changing a place.

Characters are identified by their **number**, from 0 through 30. The cast has 31 entries, so its length is not its highest number. Zero has no occupied cube cells but has finite display and navigation dimensions. One through Thirty have exactly their number of unit cubes.

Arrangement changes preserve number identity and cube colors. Use the current definition for geometry, collision size, and shape-specific speech. Math facts distinguish a number property, such as 27 being a cube number, from the shape currently being shown. The game limits spoken dialogue and bubbles to the selected character.

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

Tests cover character geometry and arrangements, counts, controls, collision and terrain behavior, roaming, football, park animation, math facts, and speech conversion. Test files run sequentially so CPU-heavy suites do not compete with roaming frame-budget checks.

Run the Python launcher tests with Python 3.9+:

```sh
python3 -m unittest discover -s tests -p 'test_*.py'
```

## Browser checks

Open [http://127.0.0.1:5181/?debug=1](http://127.0.0.1:5181/?debug=1) for coordinates, camera angles, shape and cube counts, rendering statistics, roaming state, and runtime errors. Adjust the port in the URL if you started a different one.

For interface or rendering changes, check the affected behavior in the browser as well as the relevant tests. Useful checks include Zero and a wide transformed character, number entry and keyboard focus, touch controls at a narrow viewport, collision near scenery, and the map’s destination buttons. Changes to character speech should keep the displayed equation intact and stop the previous voice when switching friends.

See the [playing guide](PLAYING.md) for the expected controls and activities.
