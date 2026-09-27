import {
  ArrowRightLeft,
  Cherry,
  Copy,
  Eye,
  EyeOff,
  FileDiff,
  FolderGit2,
  GitBranchPlus,
  GitGraph,
  GitMerge,
  GitPullRequest,
  GitPullRequestArrow,
  MessageSquareCode,
  Pencil,
  Trash2,
} from 'lucide-react';
import { MAIN_BRANCH_GUID, type Branch } from '@shared/domain/branch';
import { spec } from '@shared/domain/specs';
import { SEPARATOR, type MenuEntry } from '../../lib/actions';
import { copyToClipboard } from '../../lib/copyToClipboard';
import { groupedMenu } from '../../lib/menuGroups';
import { showInBranchExplorer } from '../branchExplorer/branchExplorerStore';
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
import { openMergeTaskDialog } from '../mergeTask/MergeTaskDialog';
import { isTaskBranch } from '../mergeTask/mergeTaskSummary';
import { openTaskWorkspaceDialog } from '../taskWorkspace/TaskWorkspaceDialog';
import { openCreateBranchDialog } from './CreateBranchDialog';
import { MERGE_INTO_WORKSPACE, serverMergeLabel } from './mergeMenuLabels';
import { hotkey } from '../../lib/shortcutRegistry';

/** The context menu for the selected branches. `currentBranch` is the branch the workspace is on. */
export function branchMenu(workspacePath: string, branches: Branch[], currentBranch: string | undefined): MenuEntry[] {
  if (branches.length === 0) return [];

  const single = branches.length === 1 ? branches[0]! : null;
  const isCurrent = single?.name === currentBranch;
  const hidden = branches.filter((branch) => branch.isHidden);
  const visible = branches.filter((branch) => !branch.isHidden);

  return groupedMenu({
    primary: [single && { id: 'diff', label: 'Open diff', icon: FileDiff, run: () => diffBranch(single) }],
    act: [
      single && !isCurrent && { id: 'switch', label: 'Switch to this branch', icon: ArrowRightLeft, run: () => void switchToBranch(workspacePath, single.name) },
      single && !isCurrent && {
        id: 'taskWorkspace',
        label: 'Work on this branch in a new workspace…',
        icon: FolderGit2,
        run: () => openTaskWorkspaceDialog({ workspacePath, branch: single.name }),
      },
      SEPARATOR,
      single && !isCurrent && { id: 'merge', label: MERGE_INTO_WORKSPACE, icon: GitMerge, run: () => mergeFromBranch(single.name) },
      single && isTaskBranch(single) && {
        id: 'mergeTask',
        label: serverMergeLabel(single.parent),
        icon: GitPullRequest,
        run: () => openMergeTaskDialog(workspacePath, single),
      },
      single && { id: 'mergeTo', label: serverMergeLabel(), icon: GitPullRequestArrow, run: () => void mergeTo(spec.branch(single.name), single.name) },
      single && !isCurrent && { id: 'cherryPick', label: 'Cherry pick branch changes', icon: Cherry, run: () => cherryPickFromBranch(single.name) },
    ],
    create: [
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
      single && {
        id: 'codeReview',
        label: 'New code review…',
        icon: MessageSquareCode,
        run: () => openCreateCodeReviewDialog(workspacePath, { kind: 'branch', value: single.name }),
      },
    ],
    navigate: [
      single && {
        id: 'showInBranchExplorer',
        label: 'Show in Branch Explorer',
        icon: GitGraph,
        run: () => showInBranchExplorer({ kind: 'branch', name: single.name, date: single.date }),
      },
    ],
    copy: [
      single && { id: 'copy', label: 'Copy name', icon: Copy, run: () => copyToClipboard(single.name, 'Branch name') },
      single && {
        id: 'copySpec',
        label: 'Copy branch spec',
        icon: Copy,
        run: () => copyToClipboard(`${spec.branch(single.name)}@${single.repository}`, 'Branch spec'),
      },
    ],
    edit: [
      single && { id: 'rename', label: 'Rename…', icon: Pencil, shortcut: hotkey('rename'), run: () => void renameBranch(workspacePath, single) },
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
    ],
    danger: [
      {
        id: 'delete',
        label: single ? 'Delete…' : `Delete ${branches.length} branches…`,
        icon: Trash2,
        danger: true,
        // Neither the branch the workspace is on nor /main can go.
        disabled: branches.some((branch) => branch.name === currentBranch || branch.guid.toLowerCase() === MAIN_BRANCH_GUID),
        run: () => void deleteBranches(workspacePath, branches),
      },
    ],
  });
}
