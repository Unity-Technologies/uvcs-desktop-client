import type { ChangesetInfo } from '@shared/domain/changeset';
import { spec } from '@shared/domain/specs';
import { navigation } from '../../app/navigation/navigationStore';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { hotkey } from '../../lib/shortcutRegistry';
import { copySubmenu, type CopyTexts } from '../../components/copyMenu';
import { menuAction, type MenuPlace } from '../../components/menuWords';
import { showInBranchExplorer } from '../branchExplorer/branchExplorerStore';
import { openCreateBranchDialog } from '../branches/CreateBranchDialog';
import { openCreateCodeReviewDialog } from '../codeReviews/CreateCodeReviewDialog';
import { openCreateLabelDialog } from '../labels/CreateLabelDialog';
import {
  deleteChangeset,
  editChangesetComment,
  mergeChangesetTo,
  moveChangesetToBranch,
  openChangesetDiff,
  openMerge,
  openRangeDiff,
  readChangesetGuid,
  revertWorkspaceToChangeset,
  switchToChangeset,
} from './changesetOperations';

export interface ChangesetMenuContext {
  workspacePath: string;
  /** The workspace's loaded changeset (none on a shelve) and branch, to offer "revert to" only where it makes sense. */
  loadedChangeset?: number | null;
  loadedBranch?: string;
  /** The repository, where the changesets don't say it (the Branch Explorer), for the full spec. */
  repository?: string;
}

/** What a changeset is copied as, first what ⌘C copies: `42`, `cs:42`, `cs:42@repo@server`, its comment and GUID. */
export function changesetCopyTexts(workspacePath: string, changeset: ChangesetInfo, repository = changeset.repository): CopyTexts {
  return {
    number: String(changeset.id),
    spec: spec.changeset(changeset.id),
    fullSpec: repository && `${spec.changeset(changeset.id)}@${repository}`,
    comment: changeset.comment.trim(),
    guid: changeset.guid ?? (() => readChangesetGuid(workspacePath, changeset)),
  };
}

/**
 * The menu of the selected changesets (one, or two for interval operations), the same wherever changesets show: the
 * Changesets view, the Branch Explorer, Incoming, the top bar, the palette and their details.
 */
export function changesetMenu(context: ChangesetMenuContext, selected: ChangesetInfo[], place: MenuPlace = {}): MenuEntry[] {
  if (selected.length === 1) return singleChangesetMenu(context, selected[0]!, place);
  if (selected.length === 2) return intervalMenu(selected);
  return [];
}

function singleChangesetMenu(context: ChangesetMenuContext, changeset: ChangesetInfo, place: MenuPlace): MenuEntry[] {
  const { workspacePath, loadedChangeset, loadedBranch } = context;
  const source = spec.changeset(changeset.id);
  const canRevertTo = typeof loadedChangeset === 'number' && changeset.branch === loadedBranch && changeset.id < loadedChangeset;

  return groupedMenu([
    menuAction('diff', () => openChangesetDiff(changeset), { shortcut: hotkey('listDiff') }),
    menuAction('switch', () => void switchToChangeset(workspacePath, changeset), { label: 'Switch to this changeset' }),
    canRevertTo && menuAction('revert', () => revertWorkspaceToChangeset(changeset, loadedChangeset), { label: 'Revert workspace to this changeset…' }),
    menuAction('merge', () => openMerge({ kind: 'merge', sourceSpec: source })),
    menuAction('mergeTo', () => void mergeChangesetTo(changeset)),
    menuAction('cherryPick', () => openMerge({ kind: 'cherryPick', sourceSpec: source }), { label: 'Cherry pick this changeset' }),
    menuAction('subtractive', () => openMerge({ kind: 'subtractive', sourceSpec: source })),
    menuAction('newBranch', () =>
      void openCreateBranchDialog(workspacePath, {
        parentBranch: changeset.branch,
        startingPoint: source,
        startingPointLabel: `changeset ${changeset.id}`,
      }).then((name) => name && place.onBranchCreated?.(name)),
    ),
    menuAction('newLabel', () => openCreateLabelDialog(workspacePath, changeset.id)),
    menuAction('newCodeReview', () => openCreateCodeReviewDialog(workspacePath, { kind: 'changeset', value: String(changeset.id) })),
    menuAction('browse', () => navigation.openPage({ kind: 'browseRepository', changesetId: changeset.id }), { label: 'Browse repository at this changeset' }),
    !place.inBranchExplorer && menuAction('showInBranchExplorer', () => showInBranchExplorer({ kind: 'changeset', id: changeset.id, date: changeset.date })),
    copySubmenu('Changeset', changesetCopyTexts(workspacePath, changeset, context.repository), { shortcut: hotkey('listCopy') }),
    menuAction('editComment', () => void editChangesetComment(workspacePath, changeset)),
    menuAction('move', () => void moveChangesetToBranch(workspacePath, changeset)),
    menuAction('delete', () => void deleteChangeset(workspacePath, changeset)),
  ]);
}

function intervalMenu(selected: ChangesetInfo[]): MenuEntry[] {
  const [older, newer] = [...selected].sort((a, b) => a.id - b.id) as [ChangesetInfo, ChangesetInfo];
  const range = `${older.id}–${newer.id}`;
  // The interval origin is exclusive; starting at the older changeset's parent includes it.
  const interval = { sourceSpec: spec.changeset(newer.id), intervalOriginSpec: spec.changeset(older.parent) };

  return groupedMenu([
    menuAction('diffRange', () => openRangeDiff(older, newer), { label: `Open diff of changesets ${older.id} and ${newer.id}` }),
    menuAction('cherryPickRange', () => openMerge({ kind: 'cherryPick', ...interval }), { label: `Cherry pick changesets ${range}` }),
    menuAction('subtractiveRange', () => openMerge({ kind: 'subtractive', ...interval }), { label: `Subtractive merge of changesets ${range}` }),
  ]);
}
