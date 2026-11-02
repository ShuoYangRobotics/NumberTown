/** Arithmetic involving two nearby friends; proximity and cooldown belong to the game. */
import { CHARACTERS } from './character-data.js';

const numbers = new Set(CHARACTERS.map(character => character.number));
const empty = Object.freeze([]);
function validNumber(input) {
  if (typeof input !== 'number' && (typeof input !== 'string' || !input.trim())) return null;
  const value = Number(input);
  return Number.isInteger(value) && numbers.has(value) ? value : null;
}

/**
 * Frozen, unique facts using both identities. Invalid or identical identities
 * return an empty pool. Subtraction stays nonnegative and division is exact,
 * with a strictly positive divisor. Zero can be either conversational partner.
 */
export function getMathConversationFacts(number, nearbyNumber) {
  const a = validNumber(number), b = validNumber(nearbyNumber);
  if (a === null || b === null || a === b) return empty;
  const facts = new Set([
    `${a} + ${b} = ${a + b}.`,
    `${b} + ${a} = ${a + b}.`,
    `${Math.max(a, b)} - ${Math.min(a, b)} = ${Math.abs(a - b)}.`,
    `${a} × ${b} = ${a * b}.`,
    `${b} × ${a} = ${a * b}.`,
  ]);
  if (b > 0 && a % b === 0) facts.add(`${a} divided by ${b} is ${a / b}.`);
  if (a > 0 && b % a === 0) facts.add(`${b} divided by ${a} is ${b / a}.`);
  return Object.freeze([...facts]);
}
