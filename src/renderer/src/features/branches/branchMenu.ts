import { isMainBranch, type BranchInfo } from '@shared/domain/branch';
import { workspacePathOf, type Place } from '@shared/domain/place';
import { spec } from '@shared/domain/specs';
import { linkCopyText } from '../../app/links/linkTo';
import { openInNewWindow } from '../../app/pageWindow/openInNewWindow';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { hotkey } from '../../lib/shortcutRegistry';
import { copySubmenu, type CopyTexts } from '../../components/copyMenu';
import { serverMergeLabel } from '../../components/mergeMenuLabels';
import { offersMerges, offersServerMerges, type MenuPlace } from '../../components/mergesOffered';
import { menuAction, type MenuHost } from '../../components/menuWords';
import { toolsSubmenu } from '../../components/tools/toolsMenu';
import { toolSubject } from '../../components/tools/toolSubjects';
import { showInBranchExplorer } from '../branchExplorer/branchExplorerStore';
import { showBranchChangesets } from '../changesets/showBranchChangesets';
import { openCreateCodeReviewDialog } from '../codeReviews/CreateCodeReviewDialog';
import { openCreateMergeRequestDialog } from '../codeReviews/CreateMergeRequestDialog';
import { canMergeSomewhere } from '../codeReviews/mergeRequestDraft';
import { openTaskMerge } from '../mergeTask/mergeTaskOperations';
import { openObjectPermissions } from '../permissions/openPermissions';
import { isTaskBranch } from '../mergeTask/mergeTaskSummary';
import { taskMergeOf } from '../mergeTask/taskMerge';
import { openTaskWorkspaceDialog } from '../taskWorkspace/TaskWorkspaceDialog';
import {
  branchDiffPage,
  cherryPickFromBranch,
  deleteBranches,
  diffBranch,
  diffWithAnotherBranch,
  mergeFromBranch,
  mergeTo,
  renameBranch,
  setBranchesHidden,
  switchToBranch,
} from './branchOperations';
import { branchHeadOrigin } from './branchHeadOrigin';
import { openCreateBranchDialog } from './CreateBranchDialog';

/** What a branch is copied as, first what ⌘C copies: `/main/task`, `br:/main/task`, `br:/main/task@repo@server`. */
export function branchCopyTexts(place: Place, branch: Pick<BranchInfo, 'name' | 'comment' | 'repository'>): CopyTexts {
  return {
    name: branch.name,
    link: linkCopyText(place, branch.repository, { object: { kind: 'branch', name: branch.name } }),
    spec: spec.branch(branch.name),
    fullSpec: branch.repository && `${spec.branch(branch.name)}@${branch.repository}`,
    comment: branch.comment.trim(),
  };
}

/** Where a branch menu shows, and the branch the workspace is on (none for a repository explored without one). */
export interface BranchMenuContext extends MenuPlace {
  currentBranch: string | undefined;
}

/**
 * The menu of the selected branches, the same wherever branches show: the Branches view, the Branch Explorer, the
 * branch switcher, the top bar, the palette and their details. What needs a workspace (switching, merging into it)
 * isn't there for a repository explored without one, and a partial workspace offers only the merges on the server
 * (`offersMerges`, `offersServerMerges`).
 */
export function branchMenu(context: BranchMenuContext, branches: BranchInfo[], host: MenuHost = {}): MenuEntry[] {
  if (branches.length === 0) return [];
  const { place, currentBranch } = context;
  const workspacePath = workspacePathOf(place);
  const merges = offersMerges(context);
  const serverMerges = offersServerMerges(context);

  const single = branches.length === 1 ? branches[0]! : null;
  const isCurrent = single?.name === currentBranch;
  const hidden = branches.filter((branch) => branch.isHidden);
  const visible = branches.filter((branch) => !branch.isHidden);
  // What makes no sense on the branch the workspace is on stays in its place, disabled: every branch menu has one shape.
  const onCurrent = isCurrent ? { disabled: true, disabledReason: 'The workspace is already on this branch' } : {};

  return groupedMenu([
    single && menuAction('diff', () => diffBranch(single)),
    single && menuAction('diffInNewWindow', () => openInNewWindow(branchDiffPage(single))),
    single && workspacePath !== null && menuAction('switch', () => void switchToBranch(workspacePath, single.name), { label: 'Switch to this branch', ...onCurrent }),
    single && workspacePath !== null && menuAction('taskWorkspace', () => openTaskWorkspaceDialog({ workspacePath, branch: single.name }), onCurrent),
    single && merges && menuAction('merge', () => mergeFromBranch(single.name), onCurrent),
    single && serverMerges && isTaskBranch(single) && menuAction('mergeTask', () => openTaskMerge(single), { label: serverMergeLabel(single.parent) }),
    single && serverMerges && menuAction('mergeTo', () => void mergeTo(spec.branch(single.name), single.name, isTaskBranch(single) ? taskMergeOf(single) : undefined)),
    single && merges && menuAction('cherryPick', () => cherryPickFromBranch(single.name), { label: 'Cherry pick branch changes', ...onCurrent }),
    single && menuAction('newBranch', () => void openCreateBranchDialog(place, branchHeadOrigin(single)).then((name) => name && host.onBranchCreated?.(name))),
    single && canMergeSomewhere(single) && menuAction('newMergeRequest', () => openCreateMergeRequestDialog(place, single)),
    single && menuAction('newCodeReview', () => openCreateCodeReviewDialog(place, { kind: 'branch', value: single.name })),
    single && menuAction('changesets', () => showBranchChangesets(place, single.name)),
    single && menuAction('compare', () => void diffWithAnotherBranch(single), { label: 'Compare with another branch…' }),
    single && !host.inBranchExplorer && menuAction('showInBranchExplorer', () => showInBranchExplorer({ kind: 'branch', name: single.name, date: single.date })),
    toolsSubmenu(place, branches.map(toolSubject.branch)),
    single && copySubmenu('Branch', branchCopyTexts(place, single), { shortcut: hotkey('listCopy'), linkShortcut: hotkey('copyLink') }),
    single && menuAction('rename', () => void renameBranch(place, single), { shortcut: hotkey('rename') }),
    single && menuAction('permissions', () => openObjectPermissions(place, 'branch', single)),
    visible.length > 0 &&
      menuAction('hide', () => void setBranchesHidden(place, visible, true), { label: visible.length === 1 ? 'Hide' : `Hide ${visible.length} branches` }),
    hidden.length > 0 &&
      menuAction('unhide', () => void setBranchesHidden(place, hidden, false), { label: hidden.length === 1 ? 'Unhide' : `Unhide ${hidden.length} branches` }),
    menuAction('delete', () => void deleteBranches(place, branches), {
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
