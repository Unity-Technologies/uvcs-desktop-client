import type { DirectoryConflict } from './merge';

/**
 * Identifies a directory conflict across successive `cm merge` runs, which renumber the remaining ones: the merge page
 * keys it by this, and the main process finds it again by this to apply its decision (`DirectoryDecisions`).
 */
export function directoryConflictIdentity(conflict: DirectoryConflict): string {
  return [conflict.type, conflict.itemId, conflict.source.path, conflict.destination.path].join('|');
}
