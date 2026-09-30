import type { DirectoryConflict } from '@shared/domain/merge';

/** Identifies a directory conflict across successive `cm merge` runs, which renumber the remaining ones. */
export function directoryConflictIdentity(conflict: DirectoryConflict): string {
  return [conflict.type, conflict.itemId, conflict.source.path, conflict.destination.path].join('|');
}
