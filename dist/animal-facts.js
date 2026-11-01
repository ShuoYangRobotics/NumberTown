/** Short, stable observations. Specialist facts checked against these sources:
 * https://oceanservice.noaa.gov/facts/starfish.html
 * https://oceanexplorer.noaa.gov/ocean-fact/coral-animal/
 * https://www.fisheries.noaa.gov/sea-turtles
 * https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/purple-sea-urchin
 * https://zoo.sandiegozoo.org/animals/camel
 * https://www.nationalzoo.si.edu/animals/meerkat
 * https://animals.sandiegozoo.org/animals/toucan
 * https://www.nps.gov/articles/mountain-goats.htm
 * https://www.adfg.alaska.gov/index.cfm?adfg=arcticfox.main
 * https://www.adfg.alaska.gov/index.cfm?adfg=wildlifenews.view_article&articles_id=985
 */
export const ANIMAL_FACTS = Object.freeze(Object.fromEntries(Object.entries({
  fish: [
    'Fish use fins to help them swim and steer.',
    'Most fish use gills to get oxygen from water.',
    'Fish swimming together can form a school.',
  ],
  'sea-star': [
    'Sea stars are animals, but they are not fish.',
    'Many sea stars have five arms.',
    'Sea stars move on tiny tube feet.',
  ],
  'sea-turtle': [
    'Sea turtles breathe air with lungs.',
    'Sea turtles use flippers to swim.',
    'Female sea turtles lay their eggs on sandy beaches.',
  ],
  crab: [
    'Many crabs walk sideways.',
    'Crabs have ten legs, including their two claws.',
    'A crab has a hard outer shell that protects its body.',
  ],
  'sea-urchin': [
    'Sea urchins have spines that help protect them.',
    'Sea urchins move on tiny tube feet.',
    'Sea urchins are relatives of sea stars.',
  ],
  coral: [
    'Corals are animals, even though they can look like plants.',
    'Corals use tiny tentacles to catch food.',
    'Many corals live in colonies of tiny animals called polyps.',
  ],
  duck: [
    'Webbed feet help ducks paddle through water.',
    'A young duck is called a duckling.',
    'Ducks have feathers that help keep them warm.',
  ],
  camel: [
    "A camel's hump stores fat.",
    'Camels have broad feet that help them walk on sand.',
    "Long eyelashes help keep sand out of a camel's eyes.",
  ],
  meerkat: [
    'Meerkats live together in groups called mobs.',
    'Meerkats use strong claws to dig.',
    'Some meerkats stand guard while others find food.',
  ],
  monkey: [
    'Monkeys are mammals.',
    'Many monkeys use their tails to help them balance.',
    'Monkeys use calls and gestures to communicate.',
  ],
  toucan: [
    'Toucans use their large bills to reach fruit.',
    "A toucan's large bill is surprisingly light.",
    'Toucans often nest in holes in trees.',
  ],
  'mountain-goat': [
    'Mountain goats have grippy pads under their hooves.',
    'Mountain goats grow thick coats for cold weather.',
    'Mountain goats eat grasses and other plants.',
  ],
  'arctic-fox': [
    'Arctic foxes have thick fur to help them stay warm.',
    "Fur on an Arctic fox's paws protects them from the cold.",
    'Arctic foxes raise their young in dens.',
  ],
  cow: [
    'A baby cow is called a calf.',
    'Cows eat plants, including grass.',
    'Cows chew their food again as cud.',
  ],
  sheep: [
    'A young sheep is called a lamb.',
    'Sheep grow wool that helps keep them warm.',
    'A group of sheep is called a flock.',
  ],
  pig: [
    'Pigs use their snouts to root in the soil.',
    'A young pig is called a piglet.',
    'Mud helps pigs cool down.',
  ],
}).map(([species, facts]) => [species, Object.freeze(facts)])));

const finite = Number.isFinite;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const validId = id => typeof id === 'string' && id.length > 0 || typeof id === 'number' && finite(id);

/** Call only for the selected character. y is its actual world-space foot/root
 * height, including swimming and jumping, not its seabed height. Animals use
 * {id,species,x,y,z,radius?}; size is an alias for radius. Time is in seconds.
 * Cooldowns survive character switches; reset() starts a fresh session.
 */
export function createAnimalEncounters({ random = Math.random, radius = 10, cooldown = 12, speciesCooldown = 50 } = {}) {
  const range = finite(radius) && radius > 0 ? radius : 10;
  const gap = finite(cooldown) && cooldown >= 0 ? cooldown : 12;
  const speciesGap = finite(speciesCooldown) && speciesCooldown >= 0 ? speciesCooldown : 50;
  const roll = typeof random === 'function' ? random : Math.random;
  let present = new Map(), selected = null, lastTime = -Infinity, nextTime = -Infinity;
  const speciesTimes = new Map(), lastFacts = new Map();
  function reset() {
    present.clear(); speciesTimes.clear(); lastFacts.clear();
    selected = null; lastTime = -Infinity; nextTime = -Infinity;
  }
  function update(player, animals, time) {
    if (!player || !Number.isInteger(player.number) || player.number < 0
        || ![player.x, player.y, player.z, time].every(finite) || time < 0 || !Array.isArray(animals)) return null;
    if (time < lastTime) reset();
    if (selected !== player.number) { present.clear(); selected = player.number; }
    lastTime = time;
    const height = finite(player.visualHeight) ? player.visualHeight : finite(player.height) ? player.height : 1;
    const top = player.y + clamp(height, .5, 64);
    const playerRadius = finite(player.radius) ? clamp(player.radius, 0, 32) : 0;
    const nearby = new Map();
    for (const animal of animals) {
      if (!animal || !validId(animal.id) || !Object.hasOwn(ANIMAL_FACTS, animal.species)
          || ![animal.x, animal.y, animal.z].every(finite)) continue;
      const size = animal.radius ?? animal.size ?? 1;
      if (!finite(size) || size < 0) continue;
      const horizontal = Math.max(0, Math.hypot(animal.x - player.x, animal.z - player.z) - playerRadius);
      const vertical = Math.max(player.y - animal.y, animal.y - top, 0);
      const distance = Math.hypot(horizontal, vertical), limit = range + Math.min(size, 8);
      if (distance > limit) continue;
      const key = `${animal.species}:${typeof animal.id}:${animal.id}`;
      const previous = present.get(key);
      const entry = { animal, distance, entered: previous?.entered ?? time, pending: previous?.pending ?? true };
      if (!nearby.has(key) || distance < nearby.get(key).distance) nearby.set(key, entry);
    }
    present = nearby;
    if (time < nextTime) return null;
    const candidates = [...nearby.values()].filter(({ animal }) => time >= (speciesTimes.get(animal.species) ?? -Infinity));
    candidates.sort((a, b) => Number(b.pending) - Number(a.pending) || b.entered - a.entered || a.distance - b.distance
      || String(a.animal.id).localeCompare(String(b.animal.id)));
    const chosen = candidates[0];
    if (!chosen) return null;
    const { animal } = chosen, facts = ANIMAL_FACTS[animal.species];
    const options = facts.filter(text => text !== lastFacts.get(animal.species));
    const value = Number(roll()), index = Math.floor((finite(value) ? clamp(value, 0, .999999999) : 0) * options.length);
    const text = options[index];
    nextTime = time + gap; speciesTimes.set(animal.species, time + speciesGap); lastFacts.set(animal.species, text);
    for (const entry of nearby.values()) if (entry.animal.species === animal.species) entry.pending = false;
    return { text, kind: 'animal', species: animal.species, animalId: animal.id };
  }
  return { update, reset };
}
