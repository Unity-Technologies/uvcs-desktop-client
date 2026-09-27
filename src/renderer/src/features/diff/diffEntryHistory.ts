import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import type { Page } from '../../app/navigation/pages';

/**
 * The history of a file in a diff, read at the changeset the diff ends at when it names one: the file may have moved
 * or be gone from the workspace since. A deleted file has no path there, nor a branch or shelve diff a changeset to
 * name: their history is the workspace's.
 */
export function diffEntryHistory(target: DiffTarget, entry: DiffEntry): Extract<Page, { kind: 'history' }> {
  const changesetId = entry.status === 'deleted' ? undefined : endChangeset(target);
  return changesetId === undefined ? { kind: 'history', path: entry.path } : { kind: 'history', path: entry.path, changesetId };
}

function endChangeset(target: DiffTarget): number | undefined {
  if (target.kind === 'changeset') return target.changesetId;
  if (target.kind !== 'range') return undefined;
  const changeset = /^cs:(\d+)$/.exec(target.toSpec);
  return changeset ? Number(changeset[1]) : undefined;
}
