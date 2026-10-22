import type { DiffEntry } from '@shared/domain/diff';
import type { FocusedLines } from '../../app/navigation/pages';
import type { SelectedLines } from './selectedLinesStore';

/** The lines a diff opens on (a link's `#L42`), of the file it opens on; none without both. */
export function linkFocusOf(path: string | undefined, lines: FocusedLines | undefined): SelectedLines | null {
  return path !== undefined && lines ? { path, lines } : null;
}

/**
 * The lines a diff opened on, when `entry` is their file (found by its path, or the path it had before a move, as
 * `entryToFocus` finds it), named by the path the diff shows it at; none for another file.
 */
export function linkFocusOn(focus: SelectedLines | null, entry: Pick<DiffEntry, 'path' | 'oldPath'> | undefined): SelectedLines | null {
  if (!focus || !entry || (entry.path !== focus.path && entry.oldPath !== focus.path)) return null;
  return { path: entry.path, lines: focus.lines };
}
