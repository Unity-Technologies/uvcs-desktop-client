/**
 * Whether the pointer or the keyboard closed a menu, for the ring of the trigger focus goes back to. Chromium draws
 * `:focus-visible` on focus a script moves once any key was pressed, so a menu closed by a click would put a ring on
 * its trigger; the trigger is marked instead (`RETURN_FOCUS_ATTRIBUTE`, whose ring `global.css` hides).
 */
const RETURN_FOCUS_ATTRIBUTE = 'data-pointer-return-focus';

export type Input = 'pointer' | 'keyboard';

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);

/** Whether a key pressed after a click makes focus arriving next the keyboard's: a modifier (the Shift of a Shift+click) doesn't. */
export function isKeyboardFocusKey(key: string): boolean {
  return !MODIFIERS.has(key);
}

/**
 * Whether focus arriving on an element came from the pointer and should show no ring: it goes back to a menu's or
 * popover's trigger (`aria-haspopup`) after the pointer closed it. Closed from the keyboard, the ring shows.
 */
export function isPointerReturnFocus(target: Pick<Element, 'hasAttribute'>, lastInput: Input): boolean {
  return lastInput === 'pointer' && target.hasAttribute('aria-haspopup');
}

/** Marks triggers focus comes back to after a click, for as long as they keep it and the keyboard stays still. */
export function trackPointerReturnFocus(): void {
  let lastInput: Input = 'pointer';
  document.addEventListener('pointerdown', () => void (lastInput = 'pointer'), true);
  document.addEventListener(
    'keydown',
    (event) => {
      if (!isKeyboardFocusKey(event.key)) return;
      lastInput = 'keyboard';
      document.activeElement?.removeAttribute(RETURN_FOCUS_ATTRIBUTE);
    },
    true,
  );
  document.addEventListener('focusin', (event) => {
    if (event.target instanceof Element && isPointerReturnFocus(event.target, lastInput)) event.target.setAttribute(RETURN_FOCUS_ATTRIBUTE, '');
  });
  document.addEventListener('focusout', (event) => {
    if (event.target instanceof Element) event.target.removeAttribute(RETURN_FOCUS_ATTRIBUTE);
  });
}
