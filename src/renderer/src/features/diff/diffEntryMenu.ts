import { workspacePathOf, type Place } from '@shared/domain/place';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { revisionIn } from '@shared/domain/revision';
import { diffTargetObject, linkCopyText } from '../../app/links/linkTo';
import { changedFileMenu, type ChangedFile } from '../../components/changedFileMenu';
import type { MenuEntry } from '../../lib/actions';
import type { GroupedEntry } from '../../lib/menuGroups';
import { reviewMenuEntry } from '../review/reviewMenuEntry';
import type { ListReview } from '../review/useReviewMode';
import { diffEntryAnnotation, diffEntryHistory } from './diffEntryHistory';
import { restoreMenuEntries } from './restoreMenuEntries';
import { revertFromDiffEntry } from './revertFromDiff';

/** What the list showing a diff's files brings to their menu. */
export interface DiffEntryMenuOptions {
  /** The list's review marks, where it reviews. */
  review?: ListReview<DiffEntry>;
  /** What the list adds in its groups, e.g. a conflict's "Keep yours". */
  added?: GroupedEntry[];
  /**
   * The workspace's repository, given where the diff's changes are the workspace's history to act on (a diff page, a
   * details panel), not changes still to come (Incoming); none while it isn't known. Reverting and restoring what was
   * deleted need it (`revertFromDiffEntry`, `restoreMenuEntries`).
   */
  workspaceRepository?: string;
  /** Every entry of the diff, the folders its list hides included (`listedEntries`): what a deleted file comes back with. */
  diffEntries?: DiffEntry[];
}

/**
 * Context menu for a file in a diff (`changedFileMenu`): mark it reviewed (where the list reviews), revert it to before
 * the diff's change (`revertFromDiffEntry`) or restore it where it was deleted (`restoreMenuEntries`), open or save the
 * newer revision, or jump to its history, annotated or not.
 */
export function diffEntryMenu(place: Place, target: DiffTarget, entries: DiffEntry[], { review, added = [], workspaceRepository, diffEntries = entries }: DiffEntryMenuOptions = {}): MenuEntry[] {
  // Reverting and restoring change a workspace's files: none without one.
  const workspacePath = workspacePathOf(place);
  const revert = workspacePath === null ? null : revertFromDiffEntry(workspacePath, target, entries, workspaceRepository);
  const restore = workspacePath === null ? [] : restoreMenuEntries(workspacePath, entries, diffEntries, workspaceRepository);
  return changedFileMenu(place, entries.map((entry) => changedFileOf(workspacePath, target, entry, entries.length === 1)), [review ? reviewMenuEntry(entries, review) : null, revert, ...restore, ...added]);
}

/** A diff's file as its menu needs it: the newer revision, or else the older one (a deleted file's), and its link there. */
function changedFileOf(workspacePath: string | null, target: DiffTarget, entry: DiffEntry, single: boolean): ChangedFile {
  const revision = revisionIn(entry.repository, entry.revisionId) ?? revisionIn(entry.repository, entry.baseRevisionId);
  const object = single ? diffTargetObject(target) : null;
  return {
    path: entry.path,
    history: single ? diffEntryHistory(target, entry) : null,
    annotation: single ? diffEntryAnnotation(target, entry) : null,
    version: entry.itemType !== 'directory' && revision ? { kind: 'revision', revision, fileName: entry.path } : null,
    ...(object && workspacePath !== null && { link: linkCopyText(workspacePath, undefined, { object, page: { kind: 'diffFile', path: `/${entry.path}` } }) }),
  };
}
