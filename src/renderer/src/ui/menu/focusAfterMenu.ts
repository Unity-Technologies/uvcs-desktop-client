import { isTextEntry } from '../../lib/textEntry';

/**
 * What a closing menu or popover does with focus: when its action opened a dialog, focus stays in the dialog (on the
 * field it autofocused) instead of going back to the menu's trigger or the list underneath; when its action put the
 * caret in a field (the check-in comment, by "Check in this changelist"), it stays there.
 */
export function focusAfterMenu(event: Event, otherwise?: (event: Event) => void): void {
  if (document.querySelector('[role="dialog"][data-state="open"]') || caretInField()) {
    event.preventDefault();
    return;
  }
  otherwise?.(event);
}

/**
 * Whether a field in the page has focus as the menu closes. Opening a menu takes focus into it, so only its action can
 * have put it there; a field inside a closing popover has left the page by then.
 */
function caretInField(): boolean {
  const active = document.activeElement;
  return isTextEntry(active) && active.isConnected;
}
