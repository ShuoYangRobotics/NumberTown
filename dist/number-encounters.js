/** Nearby number conversations; caller supplies actual rendered body poses. */
import { CHARACTERS } from './character-data.js';

const numbers = new Set(CHARACTERS.map(character => character.number));
const finite = Number.isFinite;
const pairKey = (a, b) => `${Math.min(a, b)}:${Math.max(a, b)}`;
const valid = player => player && numbers.has(player.number) && player.visible !== false && player.onFoot !== false
  && [player.x, player.y, player.z, player.radius, player.height].every(finite)
  && player.radius >= 0 && player.height > 0;
const height = player => Math.max(.3, Math.min(64, player.height));
const radius = player => Math.min(64, player.radius);

/**
 * update(selected, others, time, {allowSpeech, periodic}) observes entries even
 * while speech is deferred. It returns a nearbyNumber only when eligible, and
 * consumes that pair's cooldown. periodic:true also permits a familiar nearby
 * friend after its cooldown; otherwise only a new or pending meeting speaks.
 * Call noteSpeech(time) for ALL speech to share the global quiet interval.
 * y is world-space feet/root height, including a jump or held swimming depth.
 */
export function createNumberEncounters({ range = 6, verticalGap = 2, cooldown = 12, pairCooldown = 45 } = {}) {
  const distanceLimit = finite(range) && range >= 0 ? range : 6;
  const heightLimit = finite(verticalGap) && verticalGap >= 0 ? verticalGap : 2;
  const gap = finite(cooldown) && cooldown >= 0 ? cooldown : 12;
  const pairGap = finite(pairCooldown) && pairCooldown >= 0 ? pairCooldown : 45;
  let selectedNumber = null, present = new Map(), lastTime = -Infinity, nextTime = -Infinity, lastPair = null;
  const pairTimes = new Map();
  function reset() {
    selectedNumber = null; present = new Map(); lastTime = -Infinity; nextTime = -Infinity; lastPair = null; pairTimes.clear();
  }
  function noteSpeech(time) {
    if (!finite(time) || time < 0) return;
    if (time < lastTime) reset();
    lastTime = time; nextTime = Math.max(nextTime, time + gap);
  }
  function update(selected, others, time, { allowSpeech = true, periodic = false } = {}) {
    if (!finite(time) || time < 0 || !Array.isArray(others)) return null;
    if (time < lastTime) reset();
    lastTime = time;
    if (!valid(selected)) { selectedNumber = null; present.clear(); return null; }
    if (selectedNumber !== selected.number) { selectedNumber = selected.number; present.clear(); }
    const nearby = new Map();
    for (const other of others) {
      if (!valid(other) || other.number === selected.number) continue;
      const edgeDistance = Math.max(0, Math.hypot(other.x - selected.x, other.z - selected.z) - radius(selected) - radius(other));
      const separation = Math.max(selected.y - other.y - height(other), other.y - selected.y - height(selected), 0);
      if (edgeDistance > distanceLimit || separation > heightLimit || Math.hypot(edgeDistance, separation) > distanceLimit) continue;
      const previous = present.get(other.number);
      const candidate = { number: other.number, edgeDistance, verticalGap: separation, pending: previous?.pending ?? true };
      if (!nearby.has(other.number) || edgeDistance < nearby.get(other.number).edgeDistance) nearby.set(other.number, candidate);
    }
    present = nearby;
    if (!allowSpeech || time < nextTime) return null;
    const candidates = [...present.values()].filter(other => (periodic || other.pending)
      && time >= (pairTimes.get(pairKey(selected.number, other.number)) ?? -Infinity));
    candidates.sort((a, b) => a.edgeDistance - b.edgeDistance || a.verticalGap - b.verticalGap || a.number - b.number);
    const chosen = candidates[0];
    if (!chosen) return null;
    const key = pairKey(selected.number, chosen.number);
    nextTime = time + gap; pairTimes.set(key, time + pairGap);
    lastPair = Object.freeze({ speaker: selected.number, nearbyNumber: chosen.number, time });
    const encounter = Object.freeze({ ...lastPair, edgeDistance: chosen.edgeDistance, verticalGap: chosen.verticalGap, newMeeting: chosen.pending });
    chosen.pending = false;
    return encounter;
  }
  function state() {
    return Object.freeze({ selected: selectedNumber, nextAllowedAt: finite(nextTime) ? nextTime : null, lastPair,
      nearby: Object.freeze([...present.values()].sort((a, b) => a.edgeDistance - b.edgeDistance || a.number - b.number).map(other => Object.freeze({
        ...other, eligibleAt: pairTimes.get(pairKey(selectedNumber, other.number)) ?? 0,
      }))),
    });
  }
  return { update, noteSpeech, state, reset };
}
