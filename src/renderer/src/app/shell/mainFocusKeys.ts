/** Keys that act on the main list; pressed while nothing has focus, they go to it (`useMainFocus`). */
const LIST_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', 'Enter', ' ', 'j', 'k']);

/** Whether a key pressed while nothing has focus was aimed at the main list: a list key, Shift allowed, no chord. */
export function isAimedAtMainList(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>): boolean {
  return !event.metaKey && !event.ctrlKey && !event.altKey && LIST_KEYS.has(event.key);
}
