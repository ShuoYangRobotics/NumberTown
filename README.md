# NumberTown

A cozy, fully 3D browser playground with thirty Numberblock friends in a world spanning **440 × 550** units, including the new northern mountain terrain. NumberTown has exactly **70 houses—50 on the west bank and 20 on the east bank—plus 10 stores and 3 public buildings**: the library, school, and town hall. A continuous river flows from the northern mountain gorge through town to the southern beach and sea. Three bridges connect the two banks.

Connected streets lead to an enlarged town square with a colorful Rubik’s cube statue, a larger duck pond, the east-bank Ferris wheel park and football pitch, and a hilltop lookout over the beach and sea. A winding paved route now climbs one northern mountain to a high summit viewing deck.

The game runs locally with a vendored Three.js renderer; no build step, account, or external asset downloads are required.

## Run locally

```sh
python3 -m http.server 5181 --bind 127.0.0.1 --directory dist
```

Run the command from this `numbertown-mountain-summit` worktree and open [http://127.0.0.1:5181](http://127.0.0.1:5181) in a browser supporting WebGL 2. `npm start` runs the same isolated preview. The previous server on port **5180** has been stopped. Use a web server rather than opening the HTML file directly, since the game uses JavaScript modules.

## Play

| Control | Action |
| --- | --- |
| WASD or arrow keys | Walk relative to the current camera view |
| Shift + movement | A faster stroll |
| Drag the world / Q and R | Orbit the camera; vertical dragging changes elevation |
| Mouse wheel / + and − | Zoom |
| C | Restore the starting view |
| Space | Hop |
| F / Kick button | Kick the nearby football in the direction your character faces |
| E / feeling menu | Change expression |
| T / Change shape | Cycle through factor rectangles and back to the original shape |
| K / Tell me a math fact | Hear a number fact from the selected friend |
| M / map button | Open or close the town map |
| 1–9 and 0 | Choose One through Ten |
| Shift + 1–9 and 0 | Choose Eleven through Twenty |
| Tab + number | Hold Tab, type 1–30, then release Tab to choose a friend |
| Tab, number, Enter / number field + Go | Choose any friend without holding keys together |
| Character cards, previous/next, or click a character | Choose any friend |
| Place buttons | Travel to a town destination or activity |
| Follow trail / Walk down | Walk the mountain route automatically; Pause walk stops the guide |
| View sea button on the scenic deck | Turn the camera toward the beach and sea |

The compact bottom bar keeps all thirty numbered thumbnails in a scrolling row. From the game, **Tab** focuses the number field; **Escape** cancels. While using other controls or a dialog, Tab and Shift + Tab still move keyboard focus normally. Drag or use **Q / R** to look around; the small **− / +** control adjusts zoom.

Touch screens have a direction pad, hop button, and Kick control. Drag with one finger to orbit; pinch with two to zoom. **WASD, arrow keys, or the direction pad take over from a guided walk immediately.** Opening Help or the map, choosing another friend, or losing window focus stops the guided walk and clears held inputs. Choose Follow trail or Walk down again to continue.

## Explore and play

- **Town square and pond:** meet by the colorful Rubik’s cube statue in the larger square, then visit the expanded duck pond and gardens.
- **Ferris wheel park:** on the east bank, a rotating wheel carries 18 colorful cabins that remain upright as it turns. Walk through the landscaped park, count the cabins, and visit its picnic area.
- **Football:** the east-bank striped pitch has two goals, nets, bleachers, and a rolling black-and-white ball. Walk into the ball to dribble gently, or press **F** / tap **Kick** for a stronger kick. A whole ball crossing between the posts scores a goal. After a brief pause, the ball returns to the center and keeps the score. Shots outside the goal mouth bounce back into play.
- **Sunny Hill and coast:** follow the winding trail up the climbable 12-metre hill to the viewing deck. Use **View sea** to frame the beach and sea, or orbit freely to explore the view.
- **River and bridges:** follow one continuous river from the mountain gorge to its mouth at the sea. The North, Market, and Coast bridges connect the west and east neighborhoods. Walking follows the bridge and hillside elevations.
- **Northern mountain summit:** choose the mountain trail destination, then follow the winding paved route with **WASD** or the direction pad, or choose **Follow trail** for a guided ascent. The progress bar tracks the climb to the high viewing deck, where you can orbit the camera to enjoy the town, river, and distant coast. **Walk down** guides the return, and **Pause walk** stops either direction. Movement keys or the direction pad take over whenever you like. This marked route opens one summit; the other mountain slopes remain blocked. The lower Sunny Hill trail is still available separately.
- **Town map:** press **M** to find both neighborhoods, the three crossings, and the activity areas in the larger world.

All bodies are made from **exactly the corresponding number of equal 1×1×1 cubes**. Every cube has real depth and is visible from any angle; the world has a perspective camera, volumetric buildings, and dynamic lighting and shadows. Unselected friends stroll between randomly chosen destinations, pause to look around, and continue on another trip. Their routes avoid scenery and cross the river on bridges. Selecting a friend immediately gives you control at their current location. Collisions account for their different widths, using a conservative circular footprint to allow safe turns.

Eleven has a two-by-five body plus one red cube. Twelve is three by four. Thirteen has three yellow cubes extending above and beside a ten-block body. Fourteen has four green blocks above ten white ones. Fifteen is a 1+2+3+4+5 staircase, with a cyan last column. Sixteen is a 4×4 square with six purple cubes. Seventeen has ten white cubes and seven rainbow cubes around its top. Eighteen is a 3×6 rectangle with eight magenta cubes. Nineteen has a white column of ten and a gray column of nine. Twenty is a golden 2×10 rectangle with purple glasses, a top hat, and a bow tie. Twenty-One is a 3×7 explorer with a red center cube, a feathered hat, a hiking staff, and a fully modeled olive backpack with straps, pockets, and rolled camping gear. Twenty-Two adds two orange top cubes to a 4×5 body. Twenty-Three adds three yellow cubes beside a 2×10 body. Twenty-Four is 3×8 with four green center cubes and sun/moon staffs. Twenty-Five is a 5×5 square with a cyan bottom row. Twenty-Six has a golden body, six purple cubes, sunglasses, a black hat, and a tie. Twenty-Seven is a true 3×3×3 cube with twenty-seven unit blocks. Twenty-Eight is a 3×11 frame with five open windows: 33 − 5 = 28. Twenty-Nine has two golden columns of ten and one gray column of nine. Thirty has three yellow columns of ten and a three-point crown. These layouts follow the supplied references. Select Twenty-One and choose **View backpack** for a close rear view; **View face** turns back.

**Press T** (or **Change shape**) to cycle the selected number through every factor rectangle, including tall and wide orientations, and back to its original reference shape. Cubes keep their exact size and colors. Faces and arms move near the lower third of each rectangle, with smaller features for one-cube-high or one-cube-wide forms. Collision checks, walking routes, and camera framing use the current shape. If a form needs more open space, the game explains this; another T press tries the next form. The selected character’s shape facts describe its current arrangement.

Happy, excited, curious, surprised, sleepy, and sad expressions are available for every friend. Only the selected friend speaks and shows speech bubbles; unselected friends wander quietly. The selected friend periodically shares math facts. Every number also shares correct facts about addition, subtraction, multiplication, division, parity, and its possible shapes. Sixteen, for example, describes its 4×4 square and 12 + 4 = 16. Use **K** or **Tell me a math fact** to hear another. Voices are optional, initially muted, and use the browser's English speech synthesis when available. Equations are converted to spoken words: **2 × 10 = 20** is read as ‘2 times 10 equals 20,’ and subtraction uses ‘minus.’ Switching characters immediately stops the previous voice.

## Source

- `dist/game.js`: Three.js scene, perspective camera, input, selection, dialogue, and interface.
- `dist/arrangements.js`: exact factor rectangles, original-shape restoration, and safe local placement.
- `dist/character-shortcut.js`: Tab-and-number selection with input validation and normal menu focus navigation.
- `dist/character-data.js`: exact unit-cube layouts and dimensions for all thirty characters.
- `dist/characters3d.js`: mesh bodies, faces, accessories, and animation.
- `dist/geography.js`: shared world dimensions, river course, bridges, coast, mountain range, hill, and activity locations.
- `dist/world-data.js`: town layout, obstacles, destinations, and safe spawn positions.
- `dist/world3d.js`: buildings, paths, square, Rubik’s cube statue, duck pond, vegetation, and furniture.
- `dist/park.js`: Ferris wheel, 18 upright cabins, and park scenery.
- `dist/football.js`: pitch, goals, ball rendering, kicking, dribbling, scoring, and restarts.
- `dist/terrain-data.js`: terrain landmarks, obstacles, and walking heights for the hill, deck, and three bridges.
- `dist/terrain.js`: mountain gorge, continuous river, three bridges, hill trail, lookout, beach, and sea geometry.
- `dist/mountain-route.js`: shared summit, paved route, walking heights, boundaries, and progress data.
- `dist/mountain-summit.js`: mountain surfaces, paved spiral, summit deck, and summit scenery.
- `dist/town-map.js`: town map and destination display.
- `dist/navigation.js`: camera-relative motion and collision handling.
- `dist/roaming.js`: destination choice, route planning, and movement for unselected friends.
- `dist/personalities.js`: six emotions and character-specific math facts and dialogue.
- `dist/speech.js`: arithmetic-to-English conversion for clearly spoken equations.
- `dist/vendor/`: pinned Three.js r180 and its MIT license.

Run `npm test` or `node --test --test-concurrency=1 tests/*.test.js` for the geometry, building counts, movement, routes, roaming, terrain, park animation, football physics, and dialogue checks. The suites run sequentially so the roaming timing checks do not compete with other CPU-heavy test files. Append `?debug=1` to the local URL to show live coordinates, camera angles, cube counts, rendering statistics, and errors for browser debugging.

The public source repository is [ShuoYangRobotics/NumberTown](https://github.com/ShuoYangRobotics/NumberTown). This 4.5 preview is developed and tested locally in an isolated worktree.
