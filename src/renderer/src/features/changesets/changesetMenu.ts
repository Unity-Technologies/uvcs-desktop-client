import type { ChangesetInfo } from '@shared/domain/changeset';
import { workspacePathOf, type Place } from '@shared/domain/place';
import { spec } from '@shared/domain/specs';
import { linkCopyText } from '../../app/links/linkTo';
import { navigation } from '../../app/navigation/navigationStore';
import { openInNewWindow } from '../../app/pageWindow/openInNewWindow';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { hotkey } from '../../lib/shortcutRegistry';
import { copySubmenu, type CopyTexts } from '../../components/copyMenu';
import { menuAction, type MenuHost } from '../../components/menuWords';
import { showInBranchExplorer } from '../branchExplorer/branchExplorerStore';
import { openCreateBranchDialog } from '../branches/CreateBranchDialog';
import { openCreateCodeReviewDialog } from '../codeReviews/CreateCodeReviewDialog';
import { openCreateLabelDialog } from '../labels/CreateLabelDialog';
import {
  deleteChangeset,
  diffWithAnotherChangeset,
  editChangesetComment,
  mergeChangesetTo,
  moveChangesetToBranch,
  changesetDiffPage,
  openChangesetDiff,
  openMerge,
  openRangeDiff,
  readChangesetGuid,
  revertWorkspaceToChangeset,
  switchToChangeset,
} from './changesetOperations';

export interface ChangesetMenuContext {
  place: Place;
  /** The workspace's loaded changeset (none on a shelve) and branch, to offer "revert to" only where it makes sense. */
  loadedChangeset?: number | null;
  loadedBranch?: string;
  /** The repository, where the changesets don't say it (the Branch Explorer), for the full spec. */
  repository?: string;
}

/** What a changeset is copied as, first what ⌘C copies: `42`, `cs:42`, `cs:42@repo@server`, its comment and GUID. */
export function changesetCopyTexts(place: Place, changeset: ChangesetInfo, repository = changeset.repository): CopyTexts {
  return {
    number: String(changeset.id),
    link: linkCopyText(place, repository, { object: { kind: 'changeset', id: changeset.id } }),
    spec: spec.changeset(changeset.id),
    fullSpec: repository && `${spec.changeset(changeset.id)}@${repository}`,
    comment: changeset.comment.trim(),
    guid: changeset.guid ?? (() => readChangesetGuid(place, changeset)),
  };
}

/**
 * The menu of the selected changesets (one, or two for interval operations), the same wherever changesets show: the
 * Changesets view, a branch diff's "Changeset by changeset", the Branch Explorer, Incoming, the top bar, the palette
 * and their details. What needs a workspace (switching, reverting, merging into it) isn't there for a repository
 * explored without one.
 */
export function changesetMenu(context: ChangesetMenuContext, selected: ChangesetInfo[], host: MenuHost = {}): MenuEntry[] {
  if (selected.length === 1) return singleChangesetMenu(context, selected[0]!, host);
  if (selected.length === 2) return intervalMenu(selected, workspacePathOf(context.place) !== null);
  return [];
}

function singleChangesetMenu(context: ChangesetMenuContext, changeset: ChangesetInfo, host: MenuHost): MenuEntry[] {
  const { place, loadedChangeset, loadedBranch } = context;
  const workspacePath = workspacePathOf(place);
  const source = spec.changeset(changeset.id);
  const canRevertTo = typeof loadedChangeset === 'number' && changeset.branch === loadedBranch && changeset.id < loadedChangeset;

  return groupedMenu([
    menuAction('diff', () => openChangesetDiff(changeset), { shortcut: hotkey('listDiff') }),
    menuAction('diffInNewWindow', () => openInNewWindow(changesetDiffPage(changeset))),
    workspacePath !== null && menuAction('switch', () => void switchToChangeset(workspacePath, changeset), { label: 'Switch to this changeset' }),
    canRevertTo && menuAction('revert', () => revertWorkspaceToChangeset(changeset, loadedChangeset), { label: 'Revert workspace to this changeset…' }),
    workspacePath !== null && menuAction('merge', () => openMerge({ kind: 'merge', sourceSpec: source })),
    workspacePath !== null && menuAction('mergeTo', () => void mergeChangesetTo(changeset)),
    workspacePath !== null && menuAction('cherryPick', () => openMerge({ kind: 'cherryPick', sourceSpec: source }), { label: 'Cherry pick this changeset' }),
    workspacePath !== null && menuAction('subtractive', () => openMerge({ kind: 'subtractive', sourceSpec: source })),
    menuAction('newBranch', () =>
      void openCreateBranchDialog(place, {
        parentBranch: changeset.branch,
        startingPoint: source,
        startingPointLabel: `changeset ${changeset.id}`,
      }).then((name) => name && host.onBranchCreated?.(name)),
    ),
    menuAction('newLabel', () => openCreateLabelDialog(place, changeset.id)),
    menuAction('newCodeReview', () => openCreateCodeReviewDialog(place, { kind: 'changeset', value: String(changeset.id) })),
    menuAction('compare', () => void diffWithAnotherChangeset(changeset), { label: 'Compare with another changeset…' }),
    menuAction('browse', () => navigation.openPage({ kind: 'browseRepository', changesetId: changeset.id }), { label: 'Browse repository at this changeset' }),
    !host.inBranchExplorer && menuAction('showInBranchExplorer', () => showInBranchExplorer({ kind: 'changeset', id: changeset.id, date: changeset.date })),
    copySubmenu('Changeset', changesetCopyTexts(place, changeset, context.repository), { shortcut: hotkey('listCopy'), linkShortcut: hotkey('copyLink') }),
    menuAction('editComment', () => void editChangesetComment(place, changeset)),
    menuAction('move', () => void moveChangesetToBranch(place, changeset)),
    menuAction('delete', () => void deleteChangeset(place, changeset)),
  ]);
}

/** Two changesets: their diff, and with a workspace to merge into, cherry picking or subtracting the range. */
function intervalMenu(selected: ChangesetInfo[], inWorkspace: boolean): MenuEntry[] {
  const [older, newer] = [...selected].sort((a, b) => a.id - b.id) as [ChangesetInfo, ChangesetInfo];
  const range = `${older.id}–${newer.id}`;
  // The interval origin is exclusive; starting at the older changeset's parent includes it.
  const interval = { sourceSpec: spec.changeset(newer.id), intervalOriginSpec: spec.changeset(older.parent) };

  return groupedMenu([
    menuAction('diffRange', () => openRangeDiff(older, newer), { label: `Open diff of changesets ${older.id} and ${newer.id}` }),
    inWorkspace && menuAction('cherryPickRange', () => openMerge({ kind: 'cherryPick', ...interval }), { label: `Cherry pick changesets ${range}` }),
    inWorkspace && menuAction('subtractiveRange', () => openMerge({ kind: 'subtractive', ...interval }), { label: `Subtractive merge of changesets ${range}` }),
  ]);
}
