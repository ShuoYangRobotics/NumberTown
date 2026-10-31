# NumberTown

A cozy, fully 3D browser playground with fifteen Numberblock friends in a world spanning **440 × 550** units, including the new northern mountain terrain. NumberTown has exactly **70 houses—50 on the west bank and 20 on the east bank—plus 10 stores and 3 public buildings**: the library, school, and town hall. A continuous river flows from the northern mountain gorge through town to the southern beach and sea. Three bridges connect the two banks.

Connected streets lead to an enlarged town square with a colorful Rubik’s cube statue, a larger duck pond, the east-bank Ferris wheel park and football pitch, and a hilltop lookout over the beach and sea. A winding paved route now climbs one northern mountain to a high summit viewing deck.

The game runs locally with a vendored Three.js renderer; no build step, account, or external asset downloads are required.

## Run locally

```sh
python3 -m http.server 5181 --bind 127.0.0.1 --directory dist
```

Run the command from this `numbertown-mountain-summit` worktree and open [http://127.0.0.1:5181](http://127.0.0.1:5181) in a browser supporting WebGL 2. `npm start` runs the same isolated preview. The original `numberblock-town` project and its preview on port **5180** remain unchanged. Use a web server rather than opening the HTML file directly, since the game uses JavaScript modules.

## Play

| Control | Action |
| --- | --- |
| WASD or arrow keys | Walk relative to the current camera view |
| Shift + movement | A faster stroll |
| Drag the world / Q and R | Orbit the camera; vertical dragging changes elevation |
| Mouse wheel / + and − | Zoom |
| C / camera reset button | Restore the starting view |
| Space | Hop |
| F / Kick button | Kick the nearby football in the direction your character faces |
| E / feeling menu | Change expression |
| M / map button | Open or close the town map |
| 1–9 and 0 | Choose One through Ten |
| Shift + 1–5 | Choose Eleven through Fifteen |
| Character cards, previous/next, or click a character | Choose any friend |
| Place buttons | Travel to a town destination or activity |
| Follow trail / Walk down | Walk the mountain route automatically; Pause walk stops the guide |
| View sea button on the scenic deck | Turn the camera toward the beach and sea |

Touch screens have a direction pad, hop button, and Kick control. Drag with one finger to orbit; pinch with two to zoom. **WASD, arrow keys, or the direction pad take over from a guided walk immediately.** Opening Help or the map, choosing another friend, or losing window focus stops the guided walk and clears held inputs. Choose Follow trail or Walk down again to continue.

## Explore and play

- **Town square and pond:** meet by the colorful Rubik’s cube statue in the larger square, then visit the expanded duck pond and gardens.
- **Ferris wheel park:** on the east bank, a rotating wheel carries 18 colorful cabins that remain upright as it turns. Walk through the landscaped park, count the cabins, and visit its picnic area.
- **Football:** the east-bank striped pitch has two goals, nets, bleachers, and a rolling black-and-white ball. Walk into the ball to dribble gently, or press **F** / tap **Kick** for a stronger kick. A whole ball crossing between the posts scores a goal. After a brief pause, the ball returns to the center and keeps the score. Shots outside the goal mouth bounce back into play.
- **Sunny Hill and coast:** follow the winding trail up the climbable 12-metre hill to the viewing deck. Use **View sea** to frame the beach and sea, or orbit freely to explore the view.
- **River and bridges:** follow one continuous river from the mountain gorge to its mouth at the sea. The North, Market, and Coast bridges connect the west and east neighborhoods. Walking follows the bridge and hillside elevations.
- **Northern mountain summit:** choose the mountain trail destination, then follow the winding paved route with **WASD** or the direction pad, or choose **Follow trail** for a guided ascent. The progress bar tracks the climb to the high viewing deck, where you can orbit the camera to enjoy the town, river, and distant coast. **Walk down** guides the return, and **Pause walk** stops either direction. Movement keys or the direction pad take over whenever you like. This marked route opens one summit; the other mountain slopes remain blocked. The lower Sunny Hill trail is still available separately.
- **Town map:** press **M** to find both neighborhoods, the three crossings, and the activity areas in the larger world.

All bodies are made from **exactly the corresponding number of equal 1×1×1 cubes**. Every cube has real depth and is visible from any angle; the world has a perspective camera, volumetric buildings, and dynamic lighting and shadows. Characters keep their own locations. Collisions account for their different widths, using a conservative circular footprint to allow safe turns.

Eleven has a two-by-five body plus one red cube. Twelve is three by four. Thirteen has three yellow cubes extending above and beside a ten-block body. Fourteen has four green blocks above ten white ones. Fifteen is a 1+2+3+4+5 staircase, with a cyan last column. These layouts follow the supplied references.

Happy, excited, curious, surprised, sleepy, and sad expressions are available for every friend. Speech bubbles appear periodically and respond to locations and feelings. Voices are optional, initially muted, and use the browser's speech synthesis when available.

## Source

- `dist/game.js`: Three.js scene, perspective camera, input, selection, dialogue, and interface.
- `dist/character-data.js`: exact unit-cube layouts and dimensions for all fifteen characters.
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
- `dist/personalities.js`: six emotions and character-specific contextual dialogue.
- `dist/vendor/`: pinned Three.js r180 and its MIT license.

Run `npm test` or `node --test tests/*.test.js` for the geometry, building counts, movement, routes, terrain, park animation, football physics, and dialogue checks. Append `?debug=1` to the local URL to show live coordinates, camera angles, cube counts, rendering statistics, and errors for browser debugging.

The public source repository is [ShuoYangRobotics/NumberTown](https://github.com/ShuoYangRobotics/NumberTown). This 4.1 summit preview is developed and tested locally in an isolated worktree.
