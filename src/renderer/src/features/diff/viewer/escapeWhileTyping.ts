/** A caret or selection in the editor, as `getViewState()` gives them. */
interface Selection {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

/**
 * What Esc does while the text is typed into, one thing per press: it drops the picked lines first (`pick`), then
 * what the editor drops itself, a selection or extra carets (`editor`: the key is left to it), and only then leaves
 * the text for the file list (`leave`). The edits stay.
 */
export function escapeWhileTyping(selections: Selection[], droppedPick: boolean): 'pick' | 'editor' | 'leave' {
  if (droppedPick) return 'pick';
  const justACaret = selections.length <= 1 && selections.every(({ start, end }) => start.line === end.line && start.character === end.character);
  return justACaret ? 'leave' : 'editor';
}
