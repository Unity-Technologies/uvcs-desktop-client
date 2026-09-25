import {
  ArrowRightLeft,
  Copy,
  FileDiff,
  FolderTree,
  GitMerge,
  GitPullRequestArrow,
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
import { copyText } from '../../lib/clipboard';
import {
  deleteChangeset,
  editChangesetComment,
  labelChangeset,
  mergeChangesetTo,
  moveChangesetToBranch,
  openChangesetDiff,
  openMerge,
  openRangeDiff,
  revertWorkspaceToChangeset,
  switchToChangeset,
} from './changesetOperations';

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
    { id: 'diff', label: 'Diff changeset', icon: FileDiff, shortcut: 'mod+d', run: () => openChangesetDiff(changeset) },
    {
      id: 'browse',
      label: 'Browse repository at this changeset',
      icon: FolderTree,
      run: () => navigation.openPage({ kind: 'browseRepository', changesetId: changeset.id }),
    },
    SEPARATOR,
    { id: 'switch', label: 'Switch workspace to this changeset', icon: ArrowRightLeft, run: () => void switchToChangeset(workspacePath, changeset) },
    { id: 'label', label: 'Label this changeset…', icon: Tag, run: () => void labelChangeset(workspacePath, changeset) },
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
      run: () => void revertWorkspaceToChangeset(workspacePath, changeset),
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
        { id: 'copy.id', label: `Copy “cs:${changeset.id}”`, run: () => copyText(source, 'Changeset spec copied') },
        { id: 'copy.guid', label: 'Copy GUID', run: () => copyText(changeset.guid, 'GUID copied') },
        { id: 'copy.comment', label: 'Copy comment', run: () => copyText(changeset.comment, 'Comment copied') },
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
