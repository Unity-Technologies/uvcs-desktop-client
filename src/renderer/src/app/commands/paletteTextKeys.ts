/**
 * Whether a key pressed in the palette's field is the field's: Home and End (with Shift to select) move its caret, as
 * in any text field, where cmdk would take them to the first and last result. With ⌘ or Ctrl they still go there
 * (`paletteEnds`), as ⌘↑ ⌘↓ do.
 */
export function isPaletteTextKey(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey'>): boolean {
  return (event.key === 'Home' || event.key === 'End') && !event.ctrlKey && !event.metaKey;
}
