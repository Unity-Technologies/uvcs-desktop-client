/**
 * The element of a view or page that the keyboard works on first: its main list, tree or graph. Such elements carry
 * `MAIN_FOCUS` (spread it on them); the workspace screen focuses the first visible one after navigating, after a
 * dialog or menu closes, and when a navigation key is pressed while nothing has focus.
 */
export const MAIN_FOCUS = { 'data-main-focus': '' } as const;

const SELECTOR = '[data-main-focus]';

export function findMainFocus(root: ParentNode): HTMLElement | null {
  for (const element of root.querySelectorAll<HTMLElement>(SELECTOR)) {
    if (element.checkVisibility()) return element;
  }
  return null;
}

/** Focuses the main element under `root`; false when there is none yet (still loading) or nothing to focus. */
export function focusMain(root: ParentNode): boolean {
  const target = findMainFocus(root);
  if (!target) return false;
  if (!target.contains(document.activeElement)) target.focus({ preventScroll: true });
  return true;
}

/** Something else holds the keyboard: a dialog, a menu, a popover or a text field. */
export function isKeyboardTaken(): boolean {
  const active = document.activeElement;
  if (active instanceof HTMLElement && (active.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName))) return true;
  return document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [data-radix-popper-content-wrapper]') !== null;
}
