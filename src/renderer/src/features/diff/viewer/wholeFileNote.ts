import { hasLineChanges, type LineDiff } from './lineDiff';

/**
 * Whether a file is typed into whole instead of as a diff: an editable file whose diff as read (on disk, not with the
 * unsaved edits, so the view doesn't switch while typing) has no lines to show.
 */
export function typedIntoWhole(editable: boolean, savedDiff: LineDiff | null): boolean {
  return editable && savedDiff !== null && !hasLineChanges(savedDiff);
}

/**
 * Why a file is typed into whole instead of its diff, said in a line above it: it's empty, nothing changed, or only
 * differences the comparison method hides. The line stays while it's typed into, saying what the unsaved text is, so
 * nothing moves under the caret as typing starts (the whole file shows until the edits are saved).
 */
export type WholeFileNote = 'empty' | 'identical' | 'ignored' | 'unsaved';

interface WholeFileState {
  /** Both versions are empty. */
  empty: boolean;
  /** Both versions are the same text. */
  identical: boolean;
  /** The file has unsaved edits. */
  dirty: boolean;
  /** The unsaved text has line changes under the comparison method. */
  unsavedLineChanges: boolean;
}

export function wholeFileNote({ empty, identical, dirty, unsavedLineChanges }: WholeFileState): WholeFileNote {
  if (dirty) return unsavedLineChanges ? 'unsaved' : 'ignored';
  if (empty) return 'empty';
  return identical ? 'identical' : 'ignored';
}
