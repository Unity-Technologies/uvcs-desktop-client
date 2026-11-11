/**
 * Where the larger editor's backdrop goes: in the dialog it opened from, so a press on it is no press outside the
 * dialog (which would close it) and it dims the dialog under the panel; else over the whole window.
 */
export function backdropParent(field: Element | null): Element {
  return field?.closest('[role="dialog"]') ?? document.body;
}

/**
 * Where the larger editor's panel goes while open: where it is (none), unless the field is in a row slotted into a
 * diff's code (`[slot]`, a review's comment under a line). Pierre lays its code out as a container
 * (`container-type: inline-size`), which holds a fixed panel inside it as its frame and clips it, so the panel moves to
 * where its backdrop goes (`backdropParent`).
 */
export function panelParent(field: Element | null, body: Element = document.body): Element | null {
  if (!field?.closest('[slot]')) return null;
  return field.closest('[role="dialog"]') ?? body;
}
