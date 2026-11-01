# NumberTown

A 3D browser playground with 41 friends, from Zero to Forty, and a town full of places to explore.

## Run locally

You need **Python 3.9 or newer** and a browser with **WebGL 2** support. From the repository folder, run:

```sh
python3 serve.py
```

Open [http://127.0.0.1:5181](http://127.0.0.1:5181). Keep the terminal running while you play; press **Ctrl+C** there to stop the server.

The repository can live in any directory. The launcher always serves its own `dist/` folder, so you can also run it from elsewhere:

```sh
python3 /absolute/path/to/NumberTown/serve.py
```

If port 5181 is already in use, choose another port:

```sh
python3 serve.py --port 5182
```

Then open [http://127.0.0.1:5182](http://127.0.0.1:5182). If you already use npm, `npm start` runs the same Python launcher.

Once you have the repository, playing needs no package installation, build step, account, or network connection. **Node.js and npm are not needed to play.** Three.js is included locally. Use the launcher instead of opening `dist/index.html` directly, because the game uses JavaScript modules.

## Get a fresh copy

```sh
git clone https://github.com/ShuoYangRobotics/NumberTown.git
cd NumberTown
python3 serve.py
```

Source: [ShuoYangRobotics/NumberTown](https://github.com/ShuoYangRobotics/NumberTown).

## Start exploring

Use **WASD** or the arrow keys to walk. Drag to turn the camera and scroll to zoom. Select a numbered thumbnail, or press **Tab**, type **0–40**, then press **Enter**. Press **M** for the town map.

The town has 70 homes, 10 stores, a library, school, and town hall. Visit the spinning cube statue, duck pond, 18-cabin Ferris wheel, football pitch, seaside hill, and mountain summit. Hill and mountain visitors stay put when you switch characters. At the beach, choose **Water play** and follow the sandy slope into an expanded sea, up to **18 blocks deep**. **Z / X** moves up / down in the water; release both to hold your height. **Explore seabed** takes you to a colorful garden with a paved loop, coral, kelp, crabs, sea urchins, fish, and sea stars. Turtles swim and bask on the beach. Visit the eastern **Train park** to ride through desert, rainforest, snowy mountains, and farms. **F** boards the train, hold **Space** for twice the speed, and **Esc** exits. Your selected friend shares animal facts when you approach wildlife. **F** picks up and throws a beach ball that floats up and drifts shoreward. One through Forty contain 820 unit cubes in total; Zero is a floating smile with no blocks.

Press **T** to cycle rectangles and irregular arrangements, or **Shift + T** for a fresh connected crazy shape. Every friend has its own voice settings. [Saved character references](references/characters/README.md) preserve the available source images.

- [Playing guide](docs/PLAYING.md): all controls, activities, shapes, and math speech.
- [Development guide](docs/DEVELOPMENT.md): source layout, tests, and browser debugging.

`dist/` is the authoritative, hand-edited game source. There is no separate `src/` copy or generated build to synchronize.
