/**
 * Where the larger editor's backdrop goes: in the dialog it opened from, so a press on it is no press outside the
 * dialog (which would close it) and it dims the dialog under the panel; else over the whole window.
 */
export function backdropParent(field: Element | null): Element {
  return field?.closest('[role="dialog"]') ?? document.body;
}
