# NumberTown

A 3D browser playground with 31 friends, from Zero to Thirty, and a town full of places to explore.

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

Use **WASD** or the arrow keys to walk. Drag to turn the camera and scroll to zoom. Select a numbered thumbnail, or press **Tab**, type **0–30**, then press **Enter**. Press **M** for the town map.

The town has 70 homes, 10 stores, a library, school, and town hall. Visit the spinning cube statue, duck pond, 18-cabin Ferris wheel, football pitch, seaside hill, and mountain summit. Hill and mountain visitors stay put when you switch characters. At the beach, choose **Water play** and follow the sandy slope into an expanded sea, up to **18 blocks deep**. **Explore seabed** takes you to fish and sea stars; turtles swim and bask on the beach. **F** picks up and throws a beach ball that floats up and drifts shoreward. One through Thirty contain 465 unit cubes in total; Zero is a floating smile with no blocks.

- [Playing guide](docs/PLAYING.md): all controls, activities, shapes, and math speech.
- [Development guide](docs/DEVELOPMENT.md): source layout, tests, and browser debugging.

`dist/` is the authoritative, hand-edited game source. There is no separate `src/` copy or generated build to synchronize.
