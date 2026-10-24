# NumberTown

A cozy, fully 3D browser playground with fifteen Numberblock friends, a town square, a library, sixteen buildings, and garden paths. The game runs locally with a vendored Three.js renderer; no build step, account, or external asset downloads are required.

## Run locally

```sh
python3 -m http.server 5180 --bind 127.0.0.1 --directory dist
```

Open **http://127.0.0.1:5180** in a browser supporting WebGL 2. `npm start` runs the same server. Use a web server rather than opening the HTML file directly, since the game uses JavaScript modules.

## Play

| Control | Action |
| --- | --- |
| WASD or arrow keys | Walk relative to the current camera view |
| Shift + movement | A faster stroll |
| Drag the world / Q and R | Orbit the camera; vertical dragging changes elevation |
| Mouse wheel / + and − | Zoom |
| C / camera reset button | Restore the starting view |
| Space | Hop |
| E / feeling menu | Change expression |
| 1–9 and 0 | Choose One through Ten |
| Shift + 1–5 | Choose Eleven through Fifteen |
| Character cards, previous/next, or click a character | Choose any friend |
| Place buttons | Visit the square, library, gardens, or pond |

Touch screens have a direction pad and hop button. Drag with one finger to orbit; pinch with two to zoom. Help pauses walking. Losing window focus clears held inputs.

All bodies are made from **exactly the corresponding number of equal 1×1×1 cubes**. Every cube has real depth and is visible from any angle; the world has a perspective camera, volumetric buildings, and dynamic lighting and shadows. Characters keep their own locations. Collisions account for their different widths, using a conservative circular footprint to allow safe turns.

Eleven has a two-by-five body plus one red cube. Twelve is three by four. Thirteen has three yellow cubes extending above and beside a ten-block body. Fourteen has four green blocks above ten white ones. Fifteen is a 1+2+3+4+5 staircase, with a cyan last column. These layouts follow the supplied references.

Happy, excited, curious, surprised, sleepy, and sad expressions are available for every friend. Speech bubbles appear periodically and respond to locations and feelings. Voices are optional, initially muted, and use the browser's speech synthesis when available.

## Source

- `dist/game.js`: Three.js scene, perspective camera, input, selection, dialogue, and interface.
- `dist/character-data.js`: exact unit-cube layouts and dimensions for all fifteen characters.
- `dist/characters3d.js`: mesh bodies, faces, accessories, and animation.
- `dist/world-data.js`: town layout, obstacles, destinations, and safe spawn positions.
- `dist/world3d.js`: buildings, paths, vegetation, furniture, and water.
- `dist/navigation.js`: camera-relative motion and collision handling.
- `dist/personalities.js`: six emotions and character-specific contextual dialogue.
- `dist/vendor/`: pinned Three.js r180 and its MIT license.

Run `npm test` or `node --test tests/*.test.js` for the geometry, movement, route, and dialogue checks. Append `?debug=1` to the local URL to show live coordinates, camera angles, cube counts, rendering statistics, and errors for browser debugging.

The public source repository is [ShuoYangRobotics/NumberTown](https://github.com/ShuoYangRobotics/NumberTown). This 3D iteration is developed and tested locally.
