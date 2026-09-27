import type { Branch } from '@shared/domain/branch';
import { shortBranchName, spec } from '@shared/domain/specs';
import type { PendingChangesAction } from '@shared/domain/switchWithChanges';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runAction, runVoidAction } from '../../app/operations/runOperation';
import { switchWorkspace } from '../../app/shell/workspaceOperations';
import { confirm } from '../../ui/dialog/confirm';
import { prompt } from '../../ui/dialog/prompt';
import { toast } from '../../ui/toast/toastStore';
import { pickBranch } from './BranchPickerDialog';
import { rememberRecentBranch } from './recentBranches';

/** Resolves to whether the workspace switched. `pendingChanges` is the choice already made for the pending changes, if any. */
export function switchToBranch(workspacePath: string, branch: string, pendingChanges?: PendingChangesAction): Promise<boolean> {
  void rememberRecentBranch(workspacePath, branch);
  return switchWorkspace(workspacePath, spec.branch(branch), branch, pendingChanges);
}

export async function renameBranch(workspacePath: string, branch: Branch): Promise<void> {
  const newName = await prompt({
    title: 'Rename branch',
    label: 'New name',
    initialValue: shortBranchName(branch.name),
    description: `Only the last part of ${branch.name} changes.`,
    confirmLabel: 'Rename',
  });
  if (!newName) return;
  await runAction(workspacePath, "Couldn't rename the branch", () => api.branches.rename(workspacePath, branch.name, newName));
}

export async function deleteBranches(workspacePath: string, branches: Branch[]): Promise<void> {
  const confirmed = await confirm({
    title: branches.length === 1 ? `Delete ${branches[0]!.name}?` : `Delete ${branches.length} branches?`,
    message: 'Only empty branches can be deleted. This cannot be undone.',
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;

  const deleted = await runVoidAction(workspacePath, "Couldn't delete the branch", () =>
    api.branches.delete(workspacePath, branches.map((branch) => branch.name)),
  );
  if (deleted) toast.success(branches.length === 1 ? `Deleted ${branches[0]!.name}` : `Deleted ${branches.length} branches`);
}

export function setBranchesHidden(workspacePath: string, branches: Branch[], hidden: boolean): Promise<void | undefined> {
  return runAction(workspacePath, `Couldn't ${hidden ? 'hide' : 'unhide'} the branch`, () =>
    api.branches.setHidden(workspacePath, branches.map((branch) => branch.name), hidden),
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
    title: `Merge ${sourceName} to…`,
    description: 'The merge happens on the server; your workspace is not touched.',
    // A branch can't be merged into itself.
    exclude: sourceSpec === spec.branch(sourceName) ? sourceName : undefined,
  });
  if (!destination) return;
  navigation.openPage({ kind: 'merge', request: { kind: 'merge', sourceSpec, destinationBranch: destination } });
}

/** Diffs the branch at the head it's known at, so the diff its details panel already read is reused. */
export function diffBranch({ name, headChangeset }: Pick<Branch, 'name' | 'headChangeset'>, focusPath?: string): void {
  navigation.openPage({ kind: 'diff', title: `Branch ${name}`, target: { kind: 'branch', branch: name }, focusPath, branchHead: headChangeset });
}
