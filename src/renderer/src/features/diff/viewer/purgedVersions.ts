import type { ContentSource, FileContent } from '@shared/domain/content';
import type { DiffSides } from './shownDiff';

/**
 * Which versions of a diff a purge removed from the server (`FileContent.purged`). A purged version shows as a missing
 * one does (an added or deleted file's), so the other shows alone; where both were, nothing shows (`diffPresentation`).
 */
export type PurgedVersions = 'none' | 'original' | 'modified' | 'both';

export function purgedVersionsOf(left: FileContent, right: FileContent): PurgedVersions {
  if (left.purged && right.purged) return 'both';
  if (left.purged) return 'original';
  return right.purged ? 'modified' : 'none';
}

/** Which sides are real versions: not an empty side (an added or deleted file's), nor a purged one. */
export function diffSidesOf(original: ContentSource, modified: ContentSource, purged: PurgedVersions): DiffSides {
  return {
    original: original.kind !== 'empty' && purged !== 'original' && purged !== 'both',
    modified: modified.kind !== 'empty' && purged !== 'modified' && purged !== 'both',
  };
}

/** The line above a diff one of whose versions was purged: why only the other shows. Null where none or both were. */
export function purgedNotice(purged: PurgedVersions): string | null {
  if (purged === 'original') return 'The earlier version was purged from the server. Only this one can be shown.';
  if (purged === 'modified') return 'This version was purged from the server. Only the earlier one can be shown.';
  return null;
}
