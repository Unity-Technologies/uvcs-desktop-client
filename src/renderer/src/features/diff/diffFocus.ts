import type { DiffEntry } from '@shared/domain/diff';

/**
 * The file a diff opens on: the one asked for, found by its path or, for a move, by the path it had before;
 * the first file when it isn't in the list (or none was asked for).
 */
export function entryToFocus(entries: readonly DiffEntry[], focusPath?: string): DiffEntry | undefined {
  if (focusPath === undefined) return entries[0];
  return entries.find((entry) => entry.path === focusPath) ?? entries.find((entry) => entry.oldPath === focusPath) ?? entries[0];
}
