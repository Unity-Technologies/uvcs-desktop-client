import {
  ArrowRightLeft,
  Copy,
  FileDiff,
  FolderTree,
  GitBranchPlus,
  GitGraph,
  GitMerge,
  GitPullRequestArrow,
  MessageSquareCode,
  MessageSquareText,
  Minus,
  MoveRight,
  RotateCcw,
  Tag,
  Trash2,
} from 'lucide-react';
import type { Changeset } from '@shared/domain/changeset';
import { navigation } from '../../app/navigation/navigationStore';
import { SEPARATOR, tidyMenu, type MenuEntry } from '../../lib/actions';
import { copyToClipboard } from '../../lib/copyToClipboard';
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
  revertWorkspaceToChangeset,
  switchToChangeset,
} from './changesetOperations';
import { hotkey } from '../../lib/shortcutRegistry';

interface ChangesetMenuContext {
  workspacePath: string;
  /** The workspace's loaded changeset and branch, to offer "revert to" only where it makes sense. */
  loadedChangeset?: number;
  loadedBranch?: string;
}

/** The context menu for the selected changesets (one, or two for interval operations). */
export function changesetMenu(context: ChangesetMenuContext, selected: Changeset[]): MenuEntry[] {
  if (selected.length === 1) return singleChangesetMenu(context, selected[0]!);
  if (selected.length === 2) return intervalMenu(selected);
  return [];
}

function singleChangesetMenu({ workspacePath, loadedChangeset, loadedBranch }: ChangesetMenuContext, changeset: Changeset): MenuEntry[] {
  const source = `cs:${changeset.id}`;
  const canRevertTo = loadedChangeset !== undefined && changeset.branch === loadedBranch && changeset.id < loadedChangeset;

  return tidyMenu([
    { id: 'diff', label: 'Diff changeset', icon: FileDiff, shortcut: hotkey('listDiff'), run: () => openChangesetDiff(changeset) },
    {
      id: 'browse',
      label: 'Browse repository at this changeset',
      icon: FolderTree,
      run: () => navigation.openPage({ kind: 'browseRepository', changesetId: changeset.id }),
    },
    {
      id: 'showInBranchExplorer',
      label: 'Show in Branch Explorer',
      icon: GitGraph,
      run: () => showInBranchExplorer({ kind: 'changeset', id: changeset.id, date: changeset.date }),
    },
    SEPARATOR,
    { id: 'switch', label: 'Switch workspace to this changeset', icon: ArrowRightLeft, run: () => void switchToChangeset(workspacePath, changeset) },
    {
      id: 'createBranch',
      label: 'Create branch from here…',
      icon: GitBranchPlus,
      run: () =>
        openCreateBranchDialog(workspacePath, {
          parentBranch: changeset.branch,
          startingPoint: source,
          startingPointLabel: `changeset ${changeset.id}`,
        }),
    },
    { id: 'label', label: 'Label this changeset…', icon: Tag, run: () => openCreateLabelDialog(workspacePath, changeset.id) },
    {
      id: 'codeReview',
      label: 'Create code review…',
      icon: MessageSquareCode,
      run: () => openCreateCodeReviewDialog(workspacePath, { kind: 'changeset', value: String(changeset.id) }),
    },
    SEPARATOR,
    { id: 'merge', label: 'Merge from this changeset', icon: GitMerge, run: () => openMerge({ kind: 'merge', sourceSpec: source }) },
    { id: 'cherryPick', label: 'Cherry pick this changeset', icon: GitPullRequestArrow, run: () => openMerge({ kind: 'cherryPick', sourceSpec: source }) },
    {
      label: 'Advanced merge',
      icon: GitMerge,
      entries: [
        { id: 'mergeTo', label: 'Merge to another branch…', run: () => void mergeChangesetTo(changeset) },
        { id: 'subtractive', label: 'Subtractive merge (remove its changes)', icon: Minus, run: () => openMerge({ kind: 'subtractive', sourceSpec: source }) },
      ],
    },
    SEPARATOR,
    canRevertTo && {
      id: 'revert',
      label: 'Revert workspace to this changeset…',
      icon: RotateCcw,
      run: () => revertWorkspaceToChangeset(changeset, loadedChangeset),
    },
    SEPARATOR,
    { id: 'editComment', label: 'Edit comment…', icon: MessageSquareText, run: () => void editChangesetComment(workspacePath, changeset) },
    { id: 'move', label: 'Move to another branch…', icon: MoveRight, run: () => void moveChangesetToBranch(workspacePath, changeset) },
    { id: 'delete', label: 'Delete changeset…', icon: Trash2, danger: true, run: () => void deleteChangeset(workspacePath, changeset) },
    SEPARATOR,
    {
      label: 'Copy',
      icon: Copy,
      entries: [
        { id: 'copy.id', label: `Copy “cs:${changeset.id}”`, run: () => copyToClipboard(source, 'Changeset spec') },
        { id: 'copy.guid', label: 'Copy GUID', run: () => copyToClipboard(changeset.guid, 'GUID') },
        { id: 'copy.comment', label: 'Copy comment', run: () => copyToClipboard(changeset.comment, 'Comment') },
      ],
    },
  ]);
}

function intervalMenu(selected: Changeset[]): MenuEntry[] {
  const [older, newer] = [...selected].sort((a, b) => a.id - b.id) as [Changeset, Changeset];
  const range = `${older.id}–${newer.id}`;
  // The interval origin is exclusive; starting at the older changeset's parent includes it.
  const interval = { sourceSpec: `cs:${newer.id}`, intervalOriginSpec: `cs:${older.parent}` };

  return [
    { id: 'diffRange', label: `Diff changesets ${older.id} and ${newer.id}`, icon: FileDiff, run: () => openRangeDiff(older, newer) },
    SEPARATOR,
    { id: 'cherryPickRange', label: `Cherry pick changesets ${range}`, icon: GitPullRequestArrow, run: () => openMerge({ kind: 'cherryPick', ...interval }) },
    { id: 'subtractiveRange', label: `Subtractive merge of changesets ${range}`, icon: Minus, run: () => openMerge({ kind: 'subtractive', ...interval }) },
  ];
}
