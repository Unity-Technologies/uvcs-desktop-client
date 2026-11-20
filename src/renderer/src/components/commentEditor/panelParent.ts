/**
 * Where the larger editor's panel goes while open: where it is (none), unless the field is in a row slotted into a
 * diff's code (`[slot]`, a review's comment under a line). Pierre lays its code out as a container
 * (`container-type: inline-size`), which holds a fixed panel inside it as its frame and clips it, so the panel moves,
 * its backdrop with it (`CommentFocusGroup`), to the dialog it opened from, where a press on the backdrop is no press
 * outside the dialog (which would close it), or else to the page's body.
 */
export function panelParent(field: Element | null, body: Element = document.body): Element | null {
  if (!field?.closest('[slot]')) return null;
  return field.closest('[role="dialog"]') ?? body;
}
