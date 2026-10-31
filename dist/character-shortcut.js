/** The number field owns typed digits; gameplay keeps its normal key bindings. */
export function mountCharacterShortcut({
  canvas, input, button, status, maxNumber, onSelect, onBegin = () => {},
  isBlocked = () => false, focusGame = () => canvas.focus({ preventScroll: true }),
  windowTarget = globalThis.window, documentTarget = globalThis.document,
}) {
  if (!Number.isSafeInteger(maxNumber) || maxNumber < 1) throw new TypeError('maxNumber must be a positive integer');
  let tabHeld = false, focusingFromTab = false, disposed = false;
  const listeners = [];
  const modified = event => event.shiftKey || event.ctrlKey || event.altKey || event.metaKey;
  const hidden = () => documentTarget.hidden || documentTarget.visibilityState === 'hidden';
  const blocked = () => disposed || hidden() || isBlocked();
  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }
  function clearError() {
    input.removeAttribute('aria-invalid'); status.textContent = '';
    delete status.dataset.error;
  }
  function cancel() {
    tabHeld = false; input.value = ''; clearError();
  }
  function submit() {
    tabHeld = false;
    if (blocked()) return;
    const value = input.value.trim(), number = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < 1 || number > maxNumber) {
      status.textContent = `Choose 1–${maxNumber}`; status.dataset.error = 'true';
      input.setAttribute('aria-invalid', 'true'); input.focus({ preventScroll: true });
      return;
    }
    input.value = ''; clearError(); onSelect(number); focusGame();
  }
  function begin(event) {
    event.preventDefault(); tabHeld = true; input.value = ''; clearError();
    onBegin(); focusingFromTab = true;
    try { input.focus({ preventScroll: true }); }
    finally { focusingFromTab = false; }
  }
  listen(windowTarget, 'keydown', event => {
    if (event.key !== 'Tab') return;
    if (event.isComposing || modified(event) || blocked()) { tabHeld = false; return; }
    if (tabHeld) { event.preventDefault(); return; }
    if (event.repeat || event.defaultPrevented) return;
    const focused = documentTarget.activeElement ?? event.target;
    if (focused === canvas || focused === documentTarget.body) begin(event);
  });
  listen(windowTarget, 'keyup', event => {
    if (event.key !== 'Tab' || !tabHeld) return;
    tabHeld = false;
    if (modified(event) || event.isComposing || blocked() || documentTarget.activeElement !== input) return;
    event.preventDefault();
    // A quick tap opens the field for ordinary typing and Enter. Empty Tab
    // release is not a submission, so it must not show a validation error.
    if (input.value.trim()) submit();
  });
  listen(input, 'focus', () => { if (!focusingFromTab && !disposed) onBegin(); });
  listen(input, 'blur', () => { tabHeld = false; });
  listen(input, 'compositionstart', () => { tabHeld = false; });
  listen(input, 'input', clearError);
  listen(input, 'keydown', event => {
    if (event.isComposing || blocked()) { tabHeld = false; return; }
    if (event.key === 'Escape') { event.preventDefault(); cancel(); focusGame(); }
    else if (event.key === 'Enter' && !modified(event)) {
      event.preventDefault();
      if (!event.repeat) submit();
    }
  });
  listen(button, 'click', event => { event.preventDefault(); submit(); });
  listen(windowTarget, 'blur', () => { tabHeld = false; });
  listen(documentTarget, 'visibilitychange', () => { if (hidden()) tabHeld = false; });
  listen(documentTarget, 'pointerdown', event => { if (event.target !== input) tabHeld = false; }, true);
  return {
    // Public cancellation clears the field without moving focus; callers can
    // use it while opening a dialog. Escape explicitly restores game focus.
    cancel,
    cleanup() { cancel(); disposed = true; for (const remove of listeners) remove(); },
  };
}
