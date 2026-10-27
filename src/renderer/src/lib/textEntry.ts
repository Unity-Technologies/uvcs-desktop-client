const TEXT_ENTRY_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];

/**
 * Whether the element takes typed keys itself: a text field, a select, or editable text (the diff's editor). Keys
 * pressed there belong to it, not to the list, graph or window shortcuts around it.
 */
export function isTextEntry(element: unknown): element is HTMLElement {
  return element instanceof HTMLElement && (element.isContentEditable || TEXT_ENTRY_TAGS.includes(element.tagName));
}

/**
 * Whether a key belongs to the text it was typed in, or something already took it: a window shortcut that also edits
 * text (⌥⇧↓ selects to the end on macOS) leaves it be.
 */
export function keyTakenByText(event: Pick<KeyboardEvent, 'defaultPrevented' | 'target'>): boolean {
  return event.defaultPrevented || isTextEntry(event.target);
}
