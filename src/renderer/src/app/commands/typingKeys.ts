import { isMac } from '../../lib/platform';
import { isModPressed } from '../../lib/shortcuts';

/** Keys that edit the text whatever the modifiers: ⌘⌫ deletes to the start of the line, ⌥⌫ and Ctrl+Backspace a word. */
const EDITING_KEYS = new Set(['Backspace', 'Delete']);

/** Undo, cut, copy, paste and select all, with ⌘ or Ctrl; redo is ⇧⌘Z on macOS and Ctrl+Y (or Ctrl+Shift+Z) elsewhere. */
const MAC_TEXT_CHORDS = new Set(['z', 'x', 'c', 'v', 'a']);
const OTHER_TEXT_CHORDS = new Set([...MAC_TEXT_CHORDS, 'y']);

/**
 * Whether a key pressed while typing into a field belongs to the field rather than to a command: plain keys, the
 * editing keys with any modifier (⌘⌫ in the Files filter must not delete the selected files), and the platform's
 * text chords (Ctrl+Y in a field redoes the typing off macOS).
 */
export function belongsToField(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>, mac = isMac): boolean {
  const usesModifier = event.metaKey || event.ctrlKey || event.altKey;
  if (!usesModifier || EDITING_KEYS.has(event.key)) return true;
  const textChords = mac ? MAC_TEXT_CHORDS : OTHER_TEXT_CHORDS;
  return isModPressed(event, mac) && !event.altKey && textChords.has(event.key.toLowerCase());
}

/** Whether a key copies text selected on the page (⌘C, Ctrl+C), which no command takes: the page's copy runs. */
export function copiesSelectedText(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>, selectedText: string, mac = isMac): boolean {
  return selectedText !== '' && isModPressed(event, mac) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'c';
}
