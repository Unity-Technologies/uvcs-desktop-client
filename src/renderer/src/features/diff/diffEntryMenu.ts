import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { revisionIn } from '@shared/domain/revision';
import { changedFileMenu, type ChangedFile } from '../../components/changedFileMenu';
import type { MenuEntry } from '../../lib/actions';
import type { GroupedEntry } from '../../lib/menuGroups';
import { reviewMenuEntry } from '../review/reviewMenuEntry';
import type { ListReview } from '../review/useReviewMode';
import { diffEntryAnnotation, diffEntryHistory } from './diffEntryHistory';
import { revertFromDiffEntry } from './revertFromDiff';

/**
 * Context menu for a file in a diff (`changedFileMenu`): mark it reviewed (where the list reviews), revert it to before
 * the diff's change (`revertFromDiffEntry`), open or save the newer revision, or jump to its history, annotated or not.
 * `added`: what the list adds in its groups, e.g. a conflict's "Keep yours". `workspaceRepository`: given where the
 * diff's changes are the workspace's history to revert (a diff page, a details panel), not changes still to come
 * (Incoming); none while it isn't known.
 */
export function diffEntryMenu(
  workspacePath: string,
  target: DiffTarget,
  entries: DiffEntry[],
  review?: ListReview<DiffEntry>,
  added: GroupedEntry[] = [],
  workspaceRepository?: string,
): MenuEntry[] {
  const revert = revertFromDiffEntry(workspacePath, target, entries, workspaceRepository);
  return changedFileMenu(workspacePath, entries.map((entry) => changedFileOf(target, entry, entries.length === 1)), [review ? reviewMenuEntry(entries, review) : null, revert, ...added]);
}

/** A diff's file as its menu needs it: the newer revision, or else the older one (a deleted file's). */
function changedFileOf(target: DiffTarget, entry: DiffEntry, single: boolean): ChangedFile {
  const revision = revisionIn(entry.repository, entry.revisionId) ?? revisionIn(entry.repository, entry.baseRevisionId);
  return {
    path: entry.path,
    history: single ? diffEntryHistory(target, entry) : null,
    annotation: single ? diffEntryAnnotation(target, entry) : null,
    version: entry.itemType !== 'directory' && revision ? { kind: 'revision', revision, fileName: entry.path } : null,
  };
}
