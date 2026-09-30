import { isMainBranch, type BranchInfo } from '@shared/domain/branch';
import { spec } from '@shared/domain/specs';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { hotkey } from '../../lib/shortcutRegistry';
import { copySubmenu, type CopyTexts } from '../../components/copyMenu';
import { menuAction, type MenuPlace } from '../../components/menuWords';
import { showInBranchExplorer } from '../branchExplorer/branchExplorerStore';
import { openCreateCodeReviewDialog } from '../codeReviews/CreateCodeReviewDialog';
import { openMergeTaskDialog } from '../mergeTask/MergeTaskDialog';
import { isTaskBranch } from '../mergeTask/mergeTaskSummary';
import { openTaskWorkspaceDialog } from '../taskWorkspace/TaskWorkspaceDialog';
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
import { branchHeadOrigin } from './branchHeadOrigin';
import { openCreateBranchDialog } from './CreateBranchDialog';
import { serverMergeLabel } from './mergeMenuLabels';

/** What a branch is copied as, first what ⌘C copies: `/main/task`, `br:/main/task`, `br:/main/task@repo@server`. */
export function branchCopyTexts(branch: Pick<BranchInfo, 'name' | 'comment' | 'repository'>): CopyTexts {
  return {
    name: branch.name,
    spec: spec.branch(branch.name),
    fullSpec: branch.repository && `${spec.branch(branch.name)}@${branch.repository}`,
    comment: branch.comment.trim(),
  };
}

/**
 * The menu of the selected branches, the same wherever branches show: the Branches view, the Branch Explorer, the
 * branch switcher, the top bar, the palette and their details. `currentBranch` is the branch the workspace is on.
 */
export function branchMenu(workspacePath: string, branches: BranchInfo[], currentBranch: string | undefined, place: MenuPlace = {}): MenuEntry[] {
  if (branches.length === 0) return [];

  const single = branches.length === 1 ? branches[0]! : null;
  const isCurrent = single?.name === currentBranch;
  const hidden = branches.filter((branch) => branch.isHidden);
  const visible = branches.filter((branch) => !branch.isHidden);
  // What makes no sense on the branch the workspace is on stays in its place, disabled: every branch menu has one shape.
  const onCurrent = isCurrent ? { disabled: true, disabledReason: 'The workspace is already on this branch' } : {};

  return groupedMenu([
    single && menuAction('diff', () => diffBranch(single)),
    single && menuAction('switch', () => void switchToBranch(workspacePath, single.name), { label: 'Switch to this branch', ...onCurrent }),
    single && menuAction('taskWorkspace', () => openTaskWorkspaceDialog({ workspacePath, branch: single.name }), onCurrent),
    single && menuAction('merge', () => mergeFromBranch(single.name), onCurrent),
    single && isTaskBranch(single) && menuAction('mergeTask', () => openMergeTaskDialog(workspacePath, single), { label: serverMergeLabel(single.parent) }),
    single && menuAction('mergeTo', () => void mergeTo(spec.branch(single.name), single.name)),
    single && menuAction('cherryPick', () => cherryPickFromBranch(single.name), { label: 'Cherry pick branch changes', ...onCurrent }),
    single &&
      menuAction('newBranch', () => void openCreateBranchDialog(workspacePath, branchHeadOrigin(single)).then((name) => name && place.onBranchCreated?.(name))),
    single && menuAction('newCodeReview', () => openCreateCodeReviewDialog(workspacePath, { kind: 'branch', value: single.name })),
    single && !place.inBranchExplorer && menuAction('showInBranchExplorer', () => showInBranchExplorer({ kind: 'branch', name: single.name, date: single.date })),
    single && copySubmenu('Branch', branchCopyTexts(single), { shortcut: hotkey('listCopy') }),
    single && menuAction('rename', () => void renameBranch(workspacePath, single), { shortcut: hotkey('rename') }),
    visible.length > 0 &&
      menuAction('hide', () => void setBranchesHidden(workspacePath, visible, true), { label: visible.length === 1 ? 'Hide' : `Hide ${visible.length} branches` }),
    hidden.length > 0 &&
      menuAction('unhide', () => void setBranchesHidden(workspacePath, hidden, false), { label: hidden.length === 1 ? 'Unhide' : `Unhide ${hidden.length} branches` }),
    menuAction('delete', () => void deleteBranches(workspacePath, branches), {
      ...(!single && { label: `Delete ${branches.length} branches…` }),
      // Neither the branch the workspace is on nor /main can go.
      disabled: branches.some((branch) => branch.name === currentBranch || isMainBranch(branch)),
      disabledReason: branches.some((branch) => branch.name === currentBranch)
        ? 'The workspace is on this branch'
        : branches.some(isMainBranch)
          ? 'The main branch stays'
          : undefined,
    }),
  ]);
}
