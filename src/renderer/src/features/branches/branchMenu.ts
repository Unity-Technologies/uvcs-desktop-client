import {
  ArrowRightLeft,
  Cherry,
  Copy,
  Eye,
  EyeOff,
  FileDiff,
  GitBranchPlus,
  GitMerge,
  GitPullRequestArrow,
  MessageSquareCode,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { Branch } from '@shared/domain/branch';
import { spec } from '@shared/domain/specs';
import { SEPARATOR, tidyMenu, type MenuEntry } from '../../lib/actions';
import { copyToClipboard } from '../../lib/copyToClipboard';
import {
  cherryPickFromBranch,
  deleteBranches,
  diffBranch,
  mergeFromBranch,
  mergeTo,
  renameBranch,
  setBranchesHidden,
  switchToBranch,
} from './branchOperations';
import { openCreateCodeReviewDialog } from '../codeReviews/CreateCodeReviewDialog';
import { openCreateBranchDialog } from './CreateBranchDialog';

/** The context menu for the selected branches. `currentBranch` is the branch the workspace is on. */
export function branchMenu(workspacePath: string, branches: Branch[], currentBranch: string | undefined): MenuEntry[] {
  if (branches.length === 0) return [];

  const single = branches.length === 1 ? branches[0]! : null;
  const isCurrent = single?.name === currentBranch;
  const hidden = branches.filter((branch) => branch.isHidden);
  const visible = branches.filter((branch) => !branch.isHidden);

  return tidyMenu([
    single && !isCurrent && {
      id: 'switch',
      label: 'Switch to this branch',
      icon: ArrowRightLeft,
      run: () => void switchToBranch(workspacePath, single.name),
    },
    single && {
      id: 'create',
      label: 'New child branch…',
      icon: GitBranchPlus,
      run: () =>
        openCreateBranchDialog(workspacePath, {
          parentBranch: single.name,
          startingPoint: spec.changeset(single.headChangeset),
          startingPointLabel: `the head of ${single.name} (changeset ${single.headChangeset})`,
        }),
    },
    SEPARATOR,
    single && !isCurrent && {
      id: 'merge',
      label: `Merge into ${currentBranch ?? 'workspace'}`,
      icon: GitMerge,
      run: () => mergeFromBranch(single.name),
    },
    single && {
      id: 'mergeTo',
      label: 'Merge to…',
      icon: GitPullRequestArrow,
      run: () => void mergeTo(spec.branch(single.name), single.name),
    },
    single && !isCurrent && {
      id: 'cherryPick',
      label: 'Cherry pick branch changes',
      icon: Cherry,
      run: () => cherryPickFromBranch(single.name),
    },
    single && {
      id: 'diff',
      label: 'Show branch changes',
      icon: FileDiff,
      run: () => diffBranch(single.name),
    },
    single && {
      id: 'codeReview',
      label: 'Create code review…',
      icon: MessageSquareCode,
      run: () => openCreateCodeReviewDialog(workspacePath, { kind: 'branch', value: single.name }),
    },
    SEPARATOR,
    single && { id: 'rename', label: 'Rename…', icon: Pencil, run: () => void renameBranch(workspacePath, single) },
    single && { id: 'copy', label: 'Copy name', icon: Copy, run: () => copyToClipboard(single.name, 'Branch name') },
    visible.length > 0 && {
      id: 'hide',
      label: visible.length === 1 ? 'Hide' : `Hide ${visible.length} branches`,
      icon: EyeOff,
      run: () => void setBranchesHidden(workspacePath, visible, true),
    },
    hidden.length > 0 && {
      id: 'unhide',
      label: hidden.length === 1 ? 'Unhide' : `Unhide ${hidden.length} branches`,
      icon: Eye,
      run: () => void setBranchesHidden(workspacePath, hidden, false),
    },
    SEPARATOR,
    !branches.some((branch) => branch.name === currentBranch) && {
      id: 'delete',
      label: single ? 'Delete…' : `Delete ${branches.length} branches…`,
      icon: Trash2,
      danger: true,
      run: () => void deleteBranches(workspacePath, branches),
    },
  ]);
}
