import test from 'node:test';
import assert from 'node:assert/strict';
import { mountCharacterShortcut } from '../dist/character-shortcut.js';

class FakeTarget {
  listeners = new Map();
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  emit(event) { for (const handler of [...(this.listeners.get(event.type) ?? [])]) handler(event); return event; }
}
class FakeElement extends FakeTarget {
  value = ''; textContent = ''; dataset = {}; attributes = new Map();
  constructor(document, tagName) { super(); this.document = document; this.tagName = tagName; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  focus() {
    if (this.document.activeElement === this) return;
    this.document.activeElement?.emit(makeEvent('blur', this.document.activeElement));
    this.document.activeElement = this; this.emit(makeEvent('focus', this));
  }
}
function makeEvent(type, target, options = {}) {
  return { type, target, key: '', defaultPrevented: false, ...options,
    preventDefault() { this.defaultPrevented = true; } };
}
function setup(maxNumber = 25, minNumber = 1) {
  const windowTarget = new FakeTarget(), documentTarget = new FakeTarget();
  documentTarget.hidden = false; documentTarget.visibilityState = 'visible';
  documentTarget.body = new FakeElement(documentTarget, 'BODY');
  documentTarget.activeElement = documentTarget.body;
  const canvas = new FakeElement(documentTarget, 'CANVAS'), input = new FakeElement(documentTarget, 'INPUT');
  const button = new FakeElement(documentTarget, 'BUTTON'), status = new FakeElement(documentTarget, 'SPAN');
  const state = { blocked: false, begins: 0, focusCalls: 0, movement: true, selected: [] };
  const controller = mountCharacterShortcut({ canvas, input, button, status, minNumber, maxNumber,
    windowTarget, documentTarget, onSelect: number => state.selected.push(number),
    onBegin: () => { state.begins++; state.movement = false; }, isBlocked: () => state.blocked,
    focusGame: () => { state.focusCalls++; canvas.focus(); },
  });
  function key(type, value, options = {}) {
    const event = makeEvent(type, options.target ?? documentTarget.activeElement, { key: value, ...options });
    event.target.emit(event); windowTarget.emit(event); return event;
  }
  function type(text) {
    for (const character of text) {
      const event = key('keydown', character);
      if (!event.defaultPrevented) { input.value += character; input.emit(makeEvent('input', input)); }
      key('keyup', character);
    }
  }
  const clickGo = () => button.emit(makeEvent('click', button));
  return { windowTarget, documentTarget, canvas, input, button, status, state, controller, key, type, clickGo };
}

test('holding Tab accepts the complete two-digit number on release, without an early one-digit selection', () => {
  const f = setup(); f.canvas.focus();
  f.input.value = 'stale'; f.input.setAttribute('aria-invalid', 'true'); f.status.dataset.error = 'true';
  const down = f.key('keydown', 'Tab');
  assert.equal(down.defaultPrevented, true);
  assert.equal(f.documentTarget.activeElement, f.input);
  assert.equal(f.input.value, ''); assert.equal(f.input.getAttribute('aria-invalid'), null);
  assert.equal(f.status.dataset.error, undefined);
  assert.equal(f.state.begins, 1); assert.equal(f.state.movement, false);
  f.type('2'); assert.deepEqual(f.state.selected, []);
  f.type('5'); assert.deepEqual(f.state.selected, []);
  for (let i = 0; i < 4; i++) assert.equal(f.key('keydown', 'Tab', { repeat: true }).defaultPrevented, true);
  assert.equal(f.input.value, '25');
  f.key('keyup', 'Tab');
  assert.deepEqual(f.state.selected, [25]); assert.equal(f.input.value, '');
  assert.equal(f.documentTarget.activeElement, f.canvas);
  f.key('keyup', 'Tab'); assert.deepEqual(f.state.selected, [25], 'A repeated release must not submit twice');
});

test('tapping Tab leaves an empty field focused; typing then Enter or Go submits explicitly', () => {
  const f = setup();
  f.key('keydown', 'Tab'); f.key('keyup', 'Tab');
  assert.equal(f.documentTarget.activeElement, f.input);
  assert.deepEqual(f.state.selected, []); assert.equal(f.status.textContent, '');
  f.type('25'); assert.deepEqual(f.state.selected, []);
  assert.equal(f.key('keydown', 'Enter').defaultPrevented, true);
  assert.deepEqual(f.state.selected, [25]);
  f.input.focus(); f.type('16'); f.clickGo();
  assert.deepEqual(f.state.selected, [25, 16]);
  assert.equal(f.documentTarget.activeElement, f.canvas);
});

test('Enter while Tab is still held submits once and a later Tab release cannot choose again', () => {
  const f = setup(); f.key('keydown', 'Tab'); f.type('12'); f.key('keydown', 'Enter');
  f.key('keyup', 'Tab'); f.key('keydown', 'Enter', { repeat: true });
  assert.deepEqual(f.state.selected, [12]);
});

test('Zero works through a held Tab chord and the number field without accepting empty or out-of-range values', () => {
  const f = setup(30, 0);
  f.canvas.focus(); f.key('keydown', 'Tab'); f.type('0'); f.key('keyup', 'Tab');
  assert.deepEqual(f.state.selected, [0]);
  f.input.focus(); f.type('0'); f.clickGo();
  assert.deepEqual(f.state.selected, [0, 0]);
  for (const value of ['', '-1', '31']) {
    f.input.focus(); f.input.value = value; f.clickGo();
    assert.deepEqual(f.state.selected, [0, 0]);
    assert.equal(f.status.textContent, 'Choose 0–30');
  }
  f.input.value = '30'; f.clickGo();
  assert.deepEqual(f.state.selected, [0, 0, 30]);
});

test('invalid and empty submissions show the configured inline error and never fall back to another friend', () => {
  const f = setup();
  for (const value of ['', '0', '26', '-1', '2.5', '2e1', '+2', '12abc', 'Infinity', '999999999999999999999']) {
    f.input.focus(); f.input.value = value; f.key('keydown', 'Enter');
    assert.deepEqual(f.state.selected, [], `Unexpected selection from ${value}`);
    assert.equal(f.input.getAttribute('aria-invalid'), 'true');
    assert.equal(f.status.textContent, 'Choose 1–25'); assert.equal(f.status.dataset.error, 'true');
    assert.equal(f.documentTarget.activeElement, f.input);
  }
  f.input.value = ''; f.type('2');
  assert.equal(f.input.getAttribute('aria-invalid'), null); assert.equal(f.status.dataset.error, undefined);
  f.clickGo(); assert.deepEqual(f.state.selected, [2]); assert.equal(f.status.textContent, '');
  const small = setup(9); small.input.focus(); small.input.value = '10'; small.clickGo();
  assert.equal(small.status.textContent, 'Choose 1–9'); assert.deepEqual(small.state.selected, []);
});

test('an invalid held chord remains editable instead of selecting its first digit', () => {
  const f = setup(); f.key('keydown', 'Tab'); f.type('250'); f.key('keyup', 'Tab');
  assert.deepEqual(f.state.selected, []); assert.equal(f.input.value, '250');
  assert.equal(f.status.dataset.error, 'true'); assert.equal(f.documentTarget.activeElement, f.input);
});

test('Escape clears the field and error, cancels a pending chord, and restores game focus', () => {
  const f = setup(); f.key('keydown', 'Tab'); f.type('99'); f.key('keyup', 'Tab');
  assert.equal(f.status.dataset.error, 'true');
  f.key('keydown', 'Escape'); assert.equal(f.input.value, ''); assert.equal(f.status.dataset.error, undefined);
  assert.equal(f.documentTarget.activeElement, f.canvas);
  f.key('keydown', 'Tab'); f.type('21'); f.key('keydown', 'Escape'); f.key('keyup', 'Tab');
  assert.deepEqual(f.state.selected, []); assert.equal(f.input.value, '');
});

test('blur, hidden pages, and outside clicks cancel the held chord without selecting on refocus', () => {
  for (const interruption of ['window-blur', 'hidden', 'outside-click', 'focus-away']) {
    const f = setup(); f.key('keydown', 'Tab'); f.type('24');
    if (interruption === 'window-blur') f.windowTarget.emit(makeEvent('blur', f.windowTarget));
    if (interruption === 'hidden') {
      f.documentTarget.hidden = true; f.documentTarget.visibilityState = 'hidden';
      f.documentTarget.emit(makeEvent('visibilitychange', f.documentTarget));
      f.documentTarget.hidden = false; f.documentTarget.visibilityState = 'visible';
      f.documentTarget.emit(makeEvent('visibilitychange', f.documentTarget));
    }
    if (interruption === 'outside-click') f.documentTarget.emit(makeEvent('pointerdown', f.canvas));
    if (interruption === 'focus-away') { f.button.focus(); f.input.focus(); }
    f.windowTarget.emit(makeEvent('focus', f.windowTarget)); f.key('keyup', 'Tab');
    assert.deepEqual(f.state.selected, [], interruption);
    assert.equal(f.input.value, '24', 'Losing the chord should preserve the editable value');
    f.key('keydown', 'Enter'); assert.deepEqual(f.state.selected, [24]);
  }
});

test('native Tab navigation outside gameplay and modified/composing shortcuts are preserved', () => {
  for (const modifier of ['shiftKey', 'ctrlKey', 'altKey', 'metaKey', 'isComposing']) {
    const f = setup(); f.canvas.focus();
    assert.equal(f.key('keydown', 'Tab', { [modifier]: true }).defaultPrevented, false);
    assert.equal(f.documentTarget.activeElement, f.canvas); assert.equal(f.state.begins, 0);
  }
  for (const tag of ['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'DIV']) {
    const f = setup(), other = new FakeElement(f.documentTarget, tag); other.focus();
    assert.equal(f.key('keydown', 'Tab').defaultPrevented, false);
    assert.equal(f.documentTarget.activeElement, other); assert.equal(f.state.begins, 0);
  }
  const f = setup(); f.key('keydown', 'Tab'); f.key('keyup', 'Tab'); f.type('2');
  assert.equal(f.key('keydown', 'Tab').defaultPrevented, false, 'Tab from the field after a tap must retain normal navigation');
  assert.equal(f.key('keydown', 'Tab', { shiftKey: true }).defaultPrevented, false);
  assert.deepEqual(f.state.selected, []);
  f.key('keydown', 'Enter', { isComposing: true }); f.key('keydown', 'Enter', { ctrlKey: true });
  assert.deepEqual(f.state.selected, []);
  f.canvas.focus(); f.key('keydown', 'Tab'); f.type('25');
  f.input.emit(makeEvent('compositionstart', f.input)); f.key('keyup', 'Tab');
  assert.deepEqual(f.state.selected, [], 'Beginning composition must cancel automatic chord submission');
});

test('dialogs and a modifier introduced mid-chord suppress selection without stealing focus', () => {
  const f = setup(); f.state.blocked = true;
  assert.equal(f.key('keydown', 'Tab').defaultPrevented, false); assert.equal(f.state.begins, 0);
  f.state.blocked = false; f.key('keydown', 'Tab'); f.type('25'); f.state.blocked = true;
  f.key('keyup', 'Tab'); f.clickGo();
  assert.deepEqual(f.state.selected, []); assert.equal(f.documentTarget.activeElement, f.input);
  f.state.blocked = false; f.canvas.focus(); f.key('keydown', 'Tab'); f.type('18');
  f.key('keydown', 'Tab', { repeat: true, shiftKey: true }); f.key('keyup', 'Tab');
  assert.deepEqual(f.state.selected, []);
});

test('public cancel preserves external focus and cleanup removes every keyboard/button effect', () => {
  const f = setup(); f.key('keydown', 'Tab'); f.type('23'); f.button.focus();
  f.controller.cancel(); assert.equal(f.documentTarget.activeElement, f.button);
  assert.equal(f.input.value, ''); f.key('keyup', 'Tab'); assert.deepEqual(f.state.selected, []);
  f.controller.cleanup(); f.canvas.focus();
  assert.equal(f.key('keydown', 'Tab').defaultPrevented, false);
  const begins = f.state.begins; f.input.focus(); f.input.value = '25'; f.key('keydown', 'Enter'); f.clickGo();
  assert.equal(f.state.begins, begins); assert.deepEqual(f.state.selected, []);
});
