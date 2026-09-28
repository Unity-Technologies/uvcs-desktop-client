import { canAnnotate } from '@shared/domain/annotate';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { revisionIn } from '@shared/domain/revision';
import type { Page } from '../../app/navigation/pages';
import { annotatedHistory } from '../history/annotatedHistory';

/**
 * The history of a file in a diff, read from the revision the diff shows, in its repository: the file may have moved
 * or be gone from the workspace since, or live under an xlink. A deleted file has no revision on that side, nor is a
 * shelve's revision one of the history's: their history is the workspace's.
 */
export function diffEntryHistory(target: DiffTarget, entry: DiffEntry): Extract<Page, { kind: 'history' }> {
  const revision = target.kind === 'shelve' ? null : revisionIn(entry.repository, entry.revisionId);
  return revision ? { kind: 'history', path: entry.path, revision } : { kind: 'history', path: entry.path };
}

/**
 * A file of a diff annotated as the diff's newer side has it: that revision, in the history `diffEntryHistory` opens.
 * None for a deleted file (nothing on that side) or a shelve's (its revisions are no revision of the history).
 */
export function diffEntryAnnotation(target: DiffTarget, entry: DiffEntry): Extract<Page, { kind: 'history' }> | null {
  if (!canAnnotate(entry.itemType) || entry.status === 'deleted' || target.kind === 'shelve') return null;
  return annotatedHistory({ ...diffEntryHistory(target, entry), select: { revisionId: entry.revisionId } });
}
