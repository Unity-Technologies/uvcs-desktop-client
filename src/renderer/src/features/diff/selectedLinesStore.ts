import { create } from 'zustand';
import type { FocusedLines } from '../../app/navigation/pages';

/** Lines selected in the diff on screen, and the file they're of (a repository path, as `DiffEntry.path`). */
export interface SelectedLines {
  path: string;
  lines: FocusedLines;
}

interface SelectedLinesState {
  /** The lines selected in this window's diff on screen; null while none are. */
  selected: SelectedLines | null;
}

/**
 * The lines selected in the gutter of the committed diff on screen (a changeset's, a branch's, a shelve's, a review's:
 * `useLineLinks`), for "Copy link" to name them (`#L40-L52`). Each window has its own.
 */
export const useSelectedLines = create<SelectedLinesState>(() => ({ selected: null }));

/** The diff of `path` selected `lines` now, or none (null). */
export function selectLines(path: string, lines: FocusedLines | null): void {
  useSelectedLines.setState({ selected: lines ? { path, lines } : null });
}

/** The diff of `path` leaves the screen (another file, the page closed): its lines are no longer selected. */
export function forgetSelectedLines(path: string): void {
  if (useSelectedLines.getState().selected?.path === path) useSelectedLines.setState({ selected: null });
}

/** The lines selected in the file at `path` of the diff on screen, if that's the file shown. */
export function selectedLinesIn(path: string): FocusedLines | undefined {
  const { selected } = useSelectedLines.getState();
  return selected?.path === path ? selected.lines : undefined;
}
