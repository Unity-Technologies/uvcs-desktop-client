import type { Branch, CreateBranchRequest } from '@shared/domain/branch';
import { shortBranchName, spec } from '@shared/domain/specs';
import type { PendingChangesAction } from '@shared/domain/switchWithChanges';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runAction, runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByBranchList } from '../../app/refresh/refreshScopes';
import { switchWorkspace } from '../../app/shell/workspaceOperations';
import { branchLabel } from '../../lib/branchLabels';
import { confirm } from '../../ui/dialog/confirm';
import { prompt } from '../../ui/dialog/prompt';
import { invalidateWorkspace } from '../../app/queryClient';
import { toast, useToastStore } from '../../ui/toast/toastStore';
import { validateBranchName } from './branchNames';
import { pickBranch } from './BranchPickerDialog';
import { rememberRecentBranch } from './recentBranches';

/**
 * Resolves to whether the workspace switched. `pendingChanges` is the choice already made for the pending changes, if
 * any. The switch's words (its progress, its question, its toast) name the branch by its own name (`branchLabel`).
 */
export function switchToBranch(workspacePath: string, branch: string, pendingChanges?: PendingChangesAction): Promise<boolean> {
  void rememberRecentBranch(workspacePath, branch);
  return switchWorkspace(workspacePath, spec.branch(branch), branchLabel(branch), pendingChanges);
}

/** What the user asked for the workspace once the new branch is created. */
export interface SwitchToNewBranch {
  /** Whether to switch the workspace to the new branch. */
  requested: boolean;
  /** A merge in progress keeps the workspace where it is, even when a switch was requested. */
  blockedByMerge: boolean;
  /** The choice already made for the pending changes, if any. */
  pendingChanges?: PendingChangesAction;
  /** What the workspace is on, to say where it stayed. */
  workspaceOn?: string;
}

/**
 * Creates a branch, then switches the workspace to it if asked. Two operations in a row refresh once, after the last
 * (ARCHITECTURE.md "Server budget"): creating refreshes nothing by itself, as a switch refreshes every view when it's
 * done; only when the workspace stays do the branch lists refresh. `onCreated` runs once the branch exists, before any
 * switch. Resolves to whether the branch was created.
 */
export async function createBranchAndSwitch(
  workspacePath: string,
  request: CreateBranchRequest,
  switchTo: SwitchToNewBranch,
  onCreated: () => void = () => undefined,
): Promise<boolean> {
  try {
    await api.branches.create(workspacePath, request);
  } catch (error) {
    toast.error("Couldn't create the branch", error);
    return false;
  }
  onCreated();

  const switching = switchTo.requested && !switchTo.blockedByMerge;
  if (switching && (await switchToBranch(workspacePath, request.name, switchTo.pendingChanges))) return true;
  void invalidateWorkspace(workspacePath, isAffectedByBranchList);
  if (switchTo.requested) announceNotSwitched(workspacePath, request.name, switchTo.workspaceOn);
  else toast.success(`Created ${branchLabel(request.name)}`);
  return true;
}

function announceNotSwitched(workspacePath: string, branch: string, workspaceOn: string | undefined): void {
  useToastStore.getState().show({
    kind: 'info',
    title: `Created ${branchLabel(branch)} — you're still on ${workspaceOn ? branchLabel(workspaceOn) : 'the same branch'}`,
    action: { label: 'Switch', run: () => void switchToBranch(workspacePath, branch) },
  });
}

export async function renameBranch(workspacePath: string, branch: Pick<Branch, 'name'>): Promise<void> {
  const newName = await prompt({
    title: 'Rename branch',
    label: 'New name',
    initialValue: shortBranchName(branch.name),
    description: `Only the last part of ${branch.name} changes.`,
    confirmLabel: 'Rename',
    validate: validateBranchName,
  });
  if (!newName) return;
  await runAction(workspacePath, "Couldn't rename the branch", () => api.branches.rename(workspacePath, branch.name, newName));
}

export async function deleteBranches(workspacePath: string, branches: Pick<Branch, 'name'>[]): Promise<void> {
  const confirmed = await confirm({
    title: branches.length === 1 ? `Delete ${branches[0]!.name}?` : `Delete ${branches.length} branches?`,
    message: 'Only empty branches can be deleted. This cannot be undone.',
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;

  const deleted = await runVoidAction(workspacePath, "Couldn't delete the branch", () =>
    api.branches.delete(workspacePath, branches.map((branch) => branch.name)),
    isAffectedByBranchList,
  );
  if (deleted) toast.success(branches.length === 1 ? `Deleted ${branchLabel(branches[0]!.name)}` : `Deleted ${branches.length} branches`);
}

export function setBranchesHidden(workspacePath: string, branches: Pick<Branch, 'name'>[], hidden: boolean): Promise<void | undefined> {
  return runAction(
    workspacePath,
    `Couldn't ${hidden ? 'hide' : 'unhide'} the branch`,
    () => api.branches.setHidden(workspacePath, branches.map((branch) => branch.name), hidden),
    isAffectedByBranchList,
  );
}

export function mergeFromBranch(branch: string): void {
  navigation.openPage({ kind: 'merge', request: { kind: 'merge', sourceSpec: spec.branch(branch) } });
}

export function cherryPickFromBranch(branch: string): void {
  navigation.openPage({ kind: 'merge', request: { kind: 'cherryPick', sourceSpec: spec.branch(branch) } });
}

/** Merges `sourceSpec` into a branch the user picks, on the server, without touching the workspace. */
export async function mergeTo(sourceSpec: string, sourceName: string): Promise<void> {
  const destination = await pickBranch({
    title: `Merge ${branchLabel(sourceName)} to…`,
    description: 'The merge happens on the server; your workspace is not touched.',
    // A branch can't be merged into itself.
    exclude: sourceSpec === spec.branch(sourceName) ? sourceName : undefined,
  });
  if (!destination) return;
  navigation.openPage({ kind: 'merge', request: { kind: 'merge', sourceSpec, destinationBranch: destination } });
}

/** Diffs the branch at the head it's known at, so the diff its details panel already read is reused. */
export function diffBranch({ name, headChangeset }: Pick<Branch, 'name' | 'headChangeset'>, focusPath?: string): void {
  navigation.openPage({ kind: 'diff', title: `Branch ${branchLabel(name)}`, target: { kind: 'branch', branch: name }, focusPath, branchHead: headChangeset });
}
