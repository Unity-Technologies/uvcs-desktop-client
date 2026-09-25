/**
 * What a closing menu or popover does with focus: when its action opened a dialog, focus stays in the dialog (on the
 * field it autofocused) instead of going back to the menu's trigger or the list underneath.
 */
export function focusAfterMenu(event: Event, otherwise?: (event: Event) => void): void {
  if (document.querySelector('[role="dialog"][data-state="open"]')) {
    event.preventDefault();
    return;
  }
  otherwise?.(event);
}
