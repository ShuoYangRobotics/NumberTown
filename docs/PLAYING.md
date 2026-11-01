# Playing NumberTown

[Launch the game](../README.md#run-locally), then choose a friend and explore. The game has 31 characters numbered **0–30**. Choosing a wandering friend gives you control at their current location.

## Controls

| Control | Action |
| --- | --- |
| WASD or arrow keys | Walk relative to the camera view |
| Shift + movement | Walk faster |
| Drag the world / Q and R | Orbit the camera; vertical dragging changes elevation |
| Mouse wheel / + and − / zoom buttons | Zoom |
| C | Reset the camera |
| Space / Hop button | Hop |
| F / ball action button | Kick the football; at the beach, pick up or throw the beach ball |
| E / feeling menu | Change expression |
| T / Change shape | Try the next factor rectangle, then return to the original shape |
| K / Tell me a math fact | Ask the selected friend for another number fact |
| M / Map button | Open or close the town map |
| 1–9 and 0 | Choose One through Ten; the single 0 key chooses Ten |
| Shift + 1–9 and 0 | Choose Eleven through Twenty |
| Tab, number, Enter | Choose any friend from Zero through Thirty |
| Hold Tab, type a number, release Tab | Choose any friend with a held shortcut |
| Number field + Go | Choose any friend using the field |
| Thumbnails / previous and next buttons / [ and ] | Choose a friend from the full cast |
| Click a character in town | Control that character |
| Place buttons / map destinations | Travel to a place |
| Follow trail / Walk down | Start a guided mountain ascent or descent |
| Pause walk | Stop the guided walk |
| View sea / View town | Frame the view from a scenic deck |

The bottom strip scrolls through all 31 thumbnails. To choose Zero directly, use **Tab + 0** or Zero’s thumbnail. **Escape** cancels number entry. Tab opens the number field when the game has focus; in menus, dialogs, and other controls, Tab and Shift + Tab keep their normal focus behavior.

On touch screens, use the direction pad, Hop, and the nearby activity buttons for kicking, picking up, and throwing. Drag with one finger to orbit and pinch with two fingers to zoom.

Movement keys or the direction pad immediately take over from a guided walk. Opening Help or the map, choosing another friend, or leaving the window stops the guide and clears held movement. Choose Follow trail or Walk down again to continue.

Friends you take onto Sunny Hill or the mountain route **stay where you leave them**, including both viewing decks, when you choose another character. Camera movement, shape changes, and looking around do not send them downhill. Select that friend again and use WASD, **Walk down** on the mountain, or a destination button to leave. Once back on flat ground, the friend can wander normally when unselected.

## Places and activities

The world spans **440 × 550 units**, with **70 houses**: 50 on the west bank and 20 on the east bank. There are also **10 stores** and **3 public buildings**: the library, school, and town hall. Use the map to find destinations on both banks.

- **Town square:** a colorful Rubik’s cube statue balances on one corner and spins at 50 degrees per second, completing a turn every 7.2 seconds.
- **Duck pond and gardens:** follow the shore, watch the ducks, and explore the flowers and paths.
- **Ferris wheel park:** the east-bank wheel has 18 colorful cabins that remain upright as it turns. Walk through the park and picnic area.
- **Football:** visit the east-bank pitch, walk into the ball to dribble, and press F or Kick for a stronger shot. The whole ball must cross the line between the posts to score. It pauses briefly after a goal, then returns to the center with the score preserved. Shots outside the goal mouth bounce back. Reset ball also returns it to the center without clearing the score.
- **Sunny Hill:** follow the winding trail to the 12-metre hilltop and viewing deck. View sea frames the southern beach and water; drag to look around freely.
- **River and bridges:** the river runs continuously from the northern mountain gorge to the sea. The North, Market, and Coast bridges join the two neighborhoods. Characters follow the heights of bridges and hills as they walk.
- **Mountain summit:** visit Mountain trail and follow the paved bends manually or choose Follow trail. A progress bar tracks the ascent to the 72-metre summit deck. Walk down guides the return. This marked route reaches one summit; the other mountain slopes remain blocked. Sunny Hill is a separate, lower climb.
- **Beach and water play:** choose Beach, then **Water play**, or select Water play on the map. Wade into the shallow sea between the colored buoys. Walk close to the striped beach ball and press **F / Pick up**, face your throwing direction with WASD, then press **F / Throw**. The ball arcs through the air, bobs on the water, and drifts toward the beach with the waves. It slows on the sand so you can pick it up again. Reset ball returns it to the shallows. Switching characters, traveling to another destination, or carrying it out of the play area leaves the ball at the beach. The surrounding deep sea and river remain blocked.

## Characters and shapes

Zero is a small floating coral smile with a black **0** above it. It has no body cubes, eyes, or limbs. Zero can move, hop, change expression, wander, and share facts about zero.

One through Thirty each contain exactly their number of equal **1 × 1 × 1 cubes**, for **465 cubes** across the cast. Some original shapes are rectangles, while others have steps, extra columns, or gaps. Sixteen is a 4 × 4 square. Twenty-One is a 3 × 7 explorer carrying a modeled backpack; choose **View backpack** to inspect the camping gear and **View face** to turn back. Twenty-Seven is a true **3 × 3 × 3 cube**. Twenty-Eight is a **3 × 11 frame with five openings**, so 33 − 5 = 28.

Press **T** to cycle through the number’s factor rectangles, including tall and wide orientations, and return to its original shape. Cubes keep their size and colors, while the face and accessories adapt to the arrangement. Movement, collision checks, roaming routes, and camera framing use the current form. A shape that needs more room is skipped when you press T again. Zero has no blocks to rearrange, and One has only its 1 × 1 form, so their Change shape buttons are disabled.

Unselected friends wander quietly between destinations, pause, and continue exploring. Your hill and mountain visitors stay put until you move them away. Friends avoid scenery and each other and cross the river using bridges. Wider forms need more open space and may stay near a roomy destination.

## Feelings and math speech

Every friend has happy, excited, curious, surprised, sleepy, and sad expressions. Only the selected friend shows speech bubbles and speaks. It shares math facts periodically; press **K** or **Tell me a math fact** for another.

Facts cover arithmetic, parity, number properties, and possible arrangements. Statements about the current body follow its current shape, so a flattened Twenty-Seven does not call its body a cube. Zero teaches facts such as **5 + 0 = 5**, **5 × 0 = 0**, and **0 divided by 5 is 0**; it never claims a block shape or divides by zero.

Voices start muted. Use the sound button to enable the browser’s English speech synthesis when available. Bubbles work independently of voices. Equations use spoken operator words: **2 × 10 = 20** becomes “2 times 10 equals 20.” Switching characters stops the previous voice immediately.
