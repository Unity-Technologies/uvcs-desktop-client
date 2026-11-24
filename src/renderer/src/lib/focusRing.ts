import type { Input } from './inputModality';

/**
 * Whether focus shows the keyboard ring. Chromium draws `:focus-visible` on any focus a script moves once a key was
 * pressed, and on a clicked button at the next key; neither was the keyboard moving focus. Focusing with
 * `focusVisible: false` keeps the ring off through the keys pressed next, until focus moves again (a Tab rings).
 */

/** What moved the focus: the keyboard (Tab, Enter on a button, a key that goes somewhere), a click, or the app on its own. */
export type FocusMover = Input | 'app';

/** Whether focus moved by `mover` shows the keyboard ring: only the keyboard's. */
export function showsFocusRing(mover: FocusMover): boolean {
  return mover === 'keyboard';
}

/** How a button was pressed, from its click's `detail` (the pointer's presses): 0 for Enter or Space. */
export function clickedWith(clickDetail: number): Input {
  return clickDetail === 0 ? 'keyboard' : 'pointer';
}

/**
 * Focuses `element` as `mover` would, never scrolling: ringless unless the keyboard moved it. An element a click
 * already focused is blurred first: focused again as it is, Chromium would still ring it at the next key. `active` is
 * the element focused now, `document.activeElement` unless a test passes its own.
 */
export function focusAs(element: Pick<HTMLElement, 'focus' | 'blur'>, mover: FocusMover, active: unknown = document.activeElement): void {
  if (showsFocusRing(mover)) return element.focus({ preventScroll: true });
  if (active === element) element.blur();
  element.focus({ preventScroll: true, focusVisible: false });
}

/**
 * After a button's click: a click leaves it focused ringless (`focusAs`), as long as it kept focus (a step may have
 * moved it); Enter or Space leave it as Chromium decides.
 */
export function settleClickFocus(event: { detail: number; currentTarget: HTMLElement }): void {
  if (clickedWith(event.detail) === 'pointer' && document.activeElement === event.currentTarget) focusAs(event.currentTarget, 'pointer');
}

/**
 * Whether Chromium rings what a click focuses by itself: a primary click with a modifier held (Shift+click to select a
 * range, Cmd/Ctrl+click to add a row), whose held key it takes for the keyboard. Such a click focuses its target
 * itself, ringless (`focusAs`).
 */
export function ringsOnClickFocus(click: { button: number; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): boolean {
  return click.button === 0 && (click.shiftKey || click.ctrlKey || click.metaKey || click.altKey);
}
