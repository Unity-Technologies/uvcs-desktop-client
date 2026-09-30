const TEXT_ENTRY_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];

/**
 * Whether the element takes typed keys itself: a text field, a select, or editable text (the diff's editor). Keys
 * pressed there belong to it, not to the list, graph or window shortcuts around it.
 */
export function isTextEntry(element: unknown): element is HTMLElement {
  return element instanceof HTMLElement && (element.isContentEditable || TEXT_ENTRY_TAGS.includes(element.tagName));
}
