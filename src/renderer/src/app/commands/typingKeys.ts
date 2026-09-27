/** Keys that edit the text whatever the modifiers: ⌘⌫ deletes to the start of the line, ⌥⌫ a word. */
const EDITING_KEYS = new Set(['Backspace', 'Delete']);

/**
 * Whether a key pressed while typing into a field belongs to the field rather than to a command: plain keys, and
 * the editing keys with any modifier (⌘⌫ in the Files filter must not delete the selected files).
 */
export function belongsToField(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>): boolean {
  const usesModifier = event.metaKey || event.ctrlKey || event.altKey;
  return !usesModifier || EDITING_KEYS.has(event.key);
}
