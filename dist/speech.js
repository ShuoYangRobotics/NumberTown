/** Convert written arithmetic to speech without changing the displayed text. */
const NUMBER = '(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?|\\.\\d+)';
const numericEnd = new RegExp(`${NUMBER}$`, 'u');
const numericStart = new RegExp(`^(?:[([{]\\s*)*[+\\-−–]?\\s*(?:[([{]\\s*)*${NUMBER}`, 'u');
const WORDS = Object.freeze({ x: 'times', X: 'times', '×': 'times', '*': 'times', '+': 'plus', '-': 'minus', '−': 'minus', '–': 'minus', '=': 'equals', '÷': 'divided by', '/': 'divided by' });

function endsInNumber(text) {
  const value = text.replace(/[\s)\]}]+$/, ''), match = numericEnd.exec(value);
  if (!match) return false;
  const prefix = value.slice(0, match.index), previous = prefix.at(-1) ?? '';
  // Compact equations can end in "2x10". Follow x back to its numeric
  // operand while refusing word/identifier suffixes such as "sprite2x10".
  if (previous === 'x' || previous === 'X') return endsInNumber(prefix.slice(0, -1));
  return !/[\p{L}\p{N}_.]/u.test(previous);
}

function startsWithNumber(text) {
  const match = numericStart.exec(text);
  if (!match) return false;
  const suffix = text.slice(match[0].length), next = suffix[0] ?? '';
  if (next === 'x' || next === 'X') return startsWithNumber(suffix.slice(1));
  return !/[\p{L}\p{N}_]/u.test(next) && !/^\.\d/.test(suffix);
}

export function toSpokenMath(text) {
  const source = String(text ?? '');
  let changed = false;
  const spoken = source.replace(/[xX×*+\-−–=÷/]/g, (operator, index) => {
    const before = source.slice(0, index), after = source.slice(index + 1);
    const left = before.trimEnd(), right = after.trimStart();
    const leftNumber = endsInNumber(left), rightNumber = startsWithNumber(right);
    let word;
    if (operator === '×' || (leftNumber && rightNumber)) word = WORDS[operator];
    else if (/^[+\-−–]$/.test(operator) && rightNumber) {
      // A sign after another operator or an opening bracket is unary. An
      // attached signed number in prose ("it is -2") is also unambiguous.
      // A word-final hyphen, such as "4-by-4", is neither kind of sign.
      const unary = !left || /[=+*×/÷\-−–([{,:;]$/.test(left)
        || /\d\s*[xX]$/.test(left)
        || (/\s$/.test(before) && /^\d/.test(after));
      if (unary) word = operator === '+' ? 'positive' : 'negative';
    }
    if (!word) return operator;
    changed = true;
    return ` ${word} `;
  });
  if (!changed) return source;
  return spoken.replace(/\s+/g, ' ').replace(/([([{]) +/g, '$1').replace(/ +([)\]}])/g, '$1').trim();
}
