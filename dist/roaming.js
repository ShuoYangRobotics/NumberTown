import { collides, moveWithCollisions, angleLerp } from './navigation.js';

const CLEARANCE = 2.7;
const DIRECTIONS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const clock = () => globalThis.performance?.now?.() ?? Date.now();

class MinHeap {
  items = [];
  push(value) {
    let i = this.items.length; this.items.push(value);
    while (i) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].priority <= value.priority) break;
      this.items[i] = this.items[parent]; i = parent;
    }
    this.items[i] = value;
  }
  pop() {
    const first = this.items[0], last = this.items.pop();
    if (this.items.length) {
      let i = 0;
      while (i * 2 + 1 < this.items.length) {
        let child = i * 2 + 1;
        if (child + 1 < this.items.length && this.items[child + 1].priority < this.items[child].priority) child++;
        if (last.priority <= this.items[child].priority) break;
        this.items[i] = this.items[child]; i = child;
      }
      this.items[i] = last;
    }
    return first;
  }
}

/** Incremental, renderer-independent walking for every unselected friend. */
export function createRoamingController({ obstacles, world, destinations, random = Math.random }) {
  const states = new Map(), queue = [], cells = new Map(), globalObstacles = [];
  const bucketSize = 12, originX = Math.floor(world.minX ?? 0), originZ = Math.floor(world.minZ ?? 0);
  const columns = Math.ceil(world.width - originX) + 1, rows = Math.ceil(world.depth - originZ) + 1;
  // Each footprint needs its own routing grid: a long rectangle cannot use
  // the narrow routes that fit a friend's original shape.
  const grids = new Map();
  function gridFor(radius = CLEARANCE) {
    const clearance = radius <= CLEARANCE ? CLEARANCE : Math.ceil(radius * 4) / 4;
    if (!grids.has(clearance)) grids.set(clearance, { clearance, occupancy: new Uint8Array(columns * rows), edges: new Map() });
    return grids.get(clearance);
  }
  let job = null, logicalTime = 0;
  const roll = () => Math.max(0, Math.min(.999999, Number(random()) || 0));
  const cellKey = (x, z) => `${Math.floor(x / bucketSize)},${Math.floor(z / bucketSize)}`;

  // Index only nearby ordinary obstacles. Arbitrary callback obstacles retain
  // their full semantics and are checked globally (including the mountain gate).
  for (const obstacle of obstacles) {
    if (typeof obstacle.blocks === 'function') { globalObstacles.push(obstacle); continue; }
    const circle = obstacle.radius != null;
    const x0 = (circle ? obstacle.x - obstacle.radius : obstacle.x) - CLEARANCE - .2;
    const z0 = (circle ? obstacle.z - obstacle.radius : obstacle.z) - CLEARANCE - .2;
    const x1 = (circle ? obstacle.x + obstacle.radius : obstacle.x + obstacle.w) + CLEARANCE + .2;
    const z1 = (circle ? obstacle.z + obstacle.radius : obstacle.z + obstacle.d) + CLEARANCE + .2;
    for (let x = Math.floor(Math.max(originX, x0) / bucketSize); x <= Math.floor(Math.min(world.width, x1) / bucketSize); x++) {
      for (let z = Math.floor(Math.max(originZ, z0) / bucketSize); z <= Math.floor(Math.min(world.depth, z1) / bucketSize); z++) {
        const key = `${x},${z}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(obstacle);
      }
    }
  }
  const blocked = (x, z, radius = CLEARANCE) => radius > CLEARANCE
    ? collides(x, z, obstacles, world, radius)
    : collides(x, z, globalObstacles, world, radius) || collides(x, z, cells.get(cellKey(x, z)) ?? [], world, radius);
  const staticCollider = { blocks: blocked };
  function clearSegment(a, b, radius = CLEARANCE) {
    const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .3));
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      if (blocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, radius)) return false;
    }
    return true;
  }
  const idAt = (x, z) => (z - originZ) * columns + x - originX;
  const pointAt = id => ({ x: id % columns + originX, z: Math.floor(id / columns) + originZ });
  function open(id, grid) {
    const { occupancy, clearance } = grid;
    if (id < 0 || id >= occupancy.length) return false;
    if (!occupancy[id]) { const p = pointAt(id); occupancy[id] = blocked(p.x, p.z, clearance) ? 2 : 1; }
    return occupancy[id] === 1;
  }
  function gridJoin(point, radius, grid) {
    const candidates = [];
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      const x = Math.round(point.x) + dx, z = Math.round(point.z) + dz;
      if (x < originX || z < originZ || x > world.width || z > world.depth) continue;
      candidates.push({ x, z, distance: Math.hypot(x - point.x, z - point.z) });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    for (const candidate of candidates) {
      const id = idAt(candidate.x, candidate.z);
      if (open(id, grid) && clearSegment(point, candidate, radius)) return id;
    }
    return null;
  }
  function edgeOpen(id, direction, next, grid) {
    const { edges, clearance } = grid;
    const key = id * 8 + direction;
    if (!edges.has(key)) {
      const value = open(next, grid) && clearSegment(pointAt(id), pointAt(next), clearance);
      edges.set(key, value); edges.set(next * 8 + (direction + 4) % 8, value);
    }
    return edges.get(key);
  }
  const places = destinations.map((place, index) => Object.freeze({
    id: place.id ?? String(index), name: place.name ?? place.id ?? String(index),
    x: place.arrival?.x ?? place.x, z: place.arrival?.z ?? place.z,
  })).filter(place => Number.isFinite(place.x) && Number.isFinite(place.z) && !blocked(place.x, place.z));

  function state(player, time) {
    if (!states.has(player)) states.set(player, {
      status: 'waiting', until: time + .2 + (player.number ?? states.size) * .12 + roll() * .6,
      speed: 1.9 + roll() * .85, path: [], cursor: 0, version: 0, destination: null,
      lastId: null, recent: [], visits: 0, failures: new Map(), stalled: 0, bestDistance: Infinity, selected: false,
    });
    return states.get(player);
  }
  function cancel(s) { s.version++; s.path = []; s.cursor = 0; s.stalled = 0; }
  function wait(s, time, delay) { cancel(s); s.status = 'waiting'; s.until = time + delay; }
  function fail(s, time) {
    if (s.destination) s.failures.set(s.destination.id, time + 25 + roll() * 20);
    wait(s, time, .25 + roll() * .6);
  }
  function choose(player, s, time) {
    const clearance = gridFor(player.radius).clearance;
    const accessible = places.filter(place => !blocked(place.x, place.z, clearance));
    let choices = accessible.filter(place => place.id !== s.lastId && (s.failures.get(place.id) ?? 0) <= time && Math.hypot(place.x - player.x, place.z - player.z) > 6);
    if (!choices.length) choices = accessible.filter(place => place.id !== s.lastId && (s.failures.get(place.id) ?? 0) <= time);
    // Very wide rectangles may fit only one open landmark. Keep strolling
    // between its safe arrival offsets instead of stopping after one visit.
    if (!choices.length) choices = accessible.filter(place => (s.failures.get(place.id) ?? 0) <= time);
    if (!choices.length) { s.until = time + 2; return; }
    const fresh = choices.filter(place => !s.recent.includes(place.id));
    if (fresh.length) choices = fresh;
    // First trips are nearby, so the whole cast starts exploring promptly.
    if (!s.visits) choices = choices.sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z)).slice(0, 5);
    const place = choices[Math.floor(roll() * choices.length)];
    let target = { x: place.x, z: place.z };
    // Spread visitors around each arrival instead of stacking everyone on one
    // exact point. Every offset must stay connected to the advertised entrance.
    for (let i = 0; i < 8; i++) {
      const angle = roll() * Math.PI * 2, distance = 1.8 + roll() * 3.8;
      const point = { x: place.x + Math.cos(angle) * distance, z: place.z + Math.sin(angle) * distance };
      if (clearSegment(place, point, clearance)) { target = point; break; }
    }
    s.destination = Object.freeze({ ...place, ...target }); s.status = 'planning'; s.version++;
    queue.push({ player, s, version: s.version, target });
  }
  function finish(current, path) {
    const s = current.s;
    // Keep only turns. All retained segments were checked during the search;
    // no smoothing may cut through a building corner or across the river.
    const simplified = [];
    for (let i = 0; i < path.length; i++) {
      const previous = path[i - 1], point = path[i], next = path[i + 1];
      if (previous && next && Math.abs((point.x - previous.x) * (next.z - point.z) - (point.z - previous.z) * (next.x - point.x)) < 1e-8) continue;
      simplified.push(point);
    }
    s.path = simplified; s.cursor = 0; s.status = 'walking'; s.stalled = 0; s.bestDistance = Infinity;
  }
  function begin(request, time) {
    if (request.s.version !== request.version || request.s.selected) return null;
    const start = { x: request.player.x, z: request.player.z }, radius = request.player.radius ?? .6;
    const grid = gridFor(radius);
    if (clearSegment(start, request.target, grid.clearance)) { finish(request, [request.target]); return null; }
    const from = gridJoin(start, radius, grid), to = gridJoin(request.target, grid.clearance, grid);
    if (from === null || to === null) { fail(request.s, time); return null; }
    const heap = new MinHeap(), records = new Map();
    records.set(from, { cost: 0, parent: -1, closed: false });
    heap.push({ id: from, cost: 0, priority: 0 });
    return { ...request, from, to, start, heap, records, grid, expanded: 0 };
  }
  function plan(time) {
    const deadline = clock() + 3.5;
    let expanded = 0, starts = 0;
    while (expanded < 280 && clock() < deadline) {
      if (job && (job.s.version !== job.version || job.s.selected)) job = null;
      if (!job) {
        if (!queue.length || starts++ >= 2) return;
        job = begin(queue.shift(), time);
        if (!job) continue;
      }
      const item = job.heap.pop();
      if (!item) { fail(job.s, time); job = null; continue; }
      const record = job.records.get(item.id);
      if (record.closed || item.cost !== record.cost) continue;
      if (item.id === job.to) {
        const path = [job.target];
        for (let id = item.id; id !== -1; id = job.records.get(id).parent) path.push(pointAt(id));
        path.reverse(); finish(job, path); job = null; continue;
      }
      record.closed = true; expanded++; job.expanded++;
      if (job.expanded > 42000) { fail(job.s, time); job = null; continue; }
      const point = pointAt(item.id), goal = pointAt(job.to);
      for (let direction = 0; direction < DIRECTIONS.length; direction++) {
        const [dx, dz] = DIRECTIONS[direction], x = point.x + dx, z = point.z + dz;
        if (x < originX || z < originZ || x > world.width || z > world.depth) continue;
        const next = idAt(x, z), cost = record.cost + (dx && dz ? Math.SQRT2 : 1), known = job.records.get(next);
        if (known?.closed || (known && known.cost <= cost) || !edgeOpen(item.id, direction, next, job.grid)) continue;
        job.records.set(next, { cost, parent: item.id, closed: false });
        job.heap.push({ id: next, cost, priority: cost + Math.hypot(goal.x - x, goal.z - z) * 1.12 });
      }
    }
  }
  function nearby(player, players) {
    return players.filter(other => other !== player && Math.hypot(other.x - player.x, other.z - player.z) < Math.max(12, (player.radius ?? .6) + (other.radius ?? .6) + 2))
      .map(other => ({ x: other.x, z: other.z, radius: (other.radius ?? .6) + .08 }));
  }
  function walk(player, s, players, dt, time) {
    const radius = player.radius ?? .6;
    while (s.cursor < s.path.length && Math.hypot(player.x - s.path[s.cursor].x, player.z - s.path[s.cursor].z) < .2) {
      s.cursor++; s.stalled = 0; s.bestDistance = Infinity;
    }
    if (s.cursor >= s.path.length) {
      s.lastId = s.destination.id; s.recent = [...s.recent, s.lastId].slice(-2);
      s.visits++; wait(s, time, 1.2 + roll() * 3.4); player.moving = false; return;
    }
    const target = s.path[s.cursor], distance = Math.hypot(target.x - player.x, target.z - player.z);
    if (distance < s.bestDistance - .08) { s.bestDistance = distance; s.stalled = 0; } else s.stalled += dt;
    if (s.stalled > 4.5) { fail(s, time); player.moving = false; return; }
    const surroundings = nearby(player, players), movementObstacles = [staticCollider, ...surroundings];
    const heading = Math.atan2(target.x - player.x, target.z - player.z), amount = Math.min(distance, s.speed * dt);
    let moved = 0;
    // Right-hand passing is consistent for both friends approaching head-on.
    // Static collision checks remain authoritative even while yielding.
    for (const turn of [0, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2]) {
      const dx = Math.sin(heading + turn) * amount, dz = Math.cos(heading + turn) * amount;
      if (collides(player.x + dx, player.z + dz, movementObstacles, world, radius)) continue;
      const beforeX = player.x, beforeZ = player.z;
      moved = moveWithCollisions(player, dx, dz, movementObstacles, world, radius);
      if (moved > .0001) {
        player.yaw = angleLerp(player.yaw ?? 0, Math.atan2(player.x - beforeX, player.z - beforeZ), Math.min(1, dt * 9));
        break;
      }
    }
    player.moving = moved > .001; s.status = player.moving ? 'walking' : 'yielding';
  }
  return {
    update(players, active, dt, time) {
      const step = Math.max(0, Math.min(.1, Number.isFinite(dt) ? dt : 0));
      logicalTime = Number.isFinite(time) ? time : logicalTime + step;
      for (const player of players) {
        const s = state(player, logicalTime);
        if (player === active) {
          if (!s.selected) { cancel(s); s.selected = true; }
          s.status = 'selected';
          continue;
        }
        if (s.selected) { s.selected = false; wait(s, logicalTime, .35 + roll() * .6); }
        if (s.status === 'waiting' && logicalTime >= s.until) choose(player, s, logicalTime);
      }
      plan(logicalTime);
      for (const player of players) {
        if (player === active) continue;
        const s = states.get(player);
        if (s.path.length && step > 0) walk(player, s, players, step, logicalTime);
        else player.moving = false;
      }
    },
    pause(player, time = logicalTime) {
      const s = state(player, time); wait(s, time, .6 + roll() * .6);
    },
    stateFor(player) {
      const s = states.get(player);
      return Object.freeze({
        state: s?.status ?? 'waiting', destination: s?.destination ?? null, id: s?.destination?.id ?? null,
        pathRemaining: s ? Math.max(0, s.path.length - s.cursor) : 0, visits: s?.visits ?? 0,
      });
    },
  };
}
