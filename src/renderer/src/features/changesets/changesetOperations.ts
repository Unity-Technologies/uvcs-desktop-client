import type { Changeset } from '@shared/domain/changeset';
import type { MergeRequest } from '@shared/domain/merge';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runAction, runVoidAction } from '../../app/operations/runOperation';
import { switchWorkspace } from '../../app/shell/workspaceOperations';
import { confirm } from '../../ui/dialog/confirm';
import { prompt } from '../../ui/dialog/prompt';
import { toast } from '../../ui/toast/toastStore';
import { pickBranch } from '../branches/BranchPickerDialog';
import { askForChangesetComment } from './EditCommentDialog';

export function openChangesetDiff(changeset: Pick<Changeset, 'id'>, focusPath?: string): void {
  navigation.openPage({ kind: 'diff', title: `Changeset ${changeset.id}`, target: { kind: 'changeset', changesetId: changeset.id }, focusPath });
}

/** Compares the state after the older changeset with the state after the newer one. */
export function openRangeDiff(older: Changeset, newer: Changeset): void {
  navigation.openPage({
    kind: 'diff',
    title: `Changesets ${older.id} → ${newer.id}`,
    target: { kind: 'range', fromSpec: `cs:${older.id}`, toSpec: `cs:${newer.id}` },
  });
}

export function openMerge(request: MergeRequest): void {
  navigation.openPage({ kind: 'merge', request });
}

export async function mergeChangesetTo(changeset: Changeset): Promise<void> {
  const destinationBranch = await pickBranch({
    title: `Merge changeset ${changeset.id} to…`,
    description: 'The merge happens on the server; your workspace is not touched.',
  });
  if (destinationBranch) openMerge({ kind: 'merge', sourceSpec: `cs:${changeset.id}`, destinationBranch });
}

export function switchToChangeset(workspacePath: string, changeset: Changeset): Promise<boolean> {
  return switchWorkspace(workspacePath, `cs:${changeset.id}`, `changeset ${changeset.id}`);
}

export async function editChangesetComment(workspacePath: string, changeset: Changeset): Promise<void> {
  const comment = await askForChangesetComment(changeset.id, changeset.comment);
  if (comment !== undefined) await saveChangesetComment(workspacePath, changeset, comment);
}

export function saveChangesetComment(workspacePath: string, changeset: Pick<Changeset, 'id'>, comment: string): Promise<void | undefined> {
  return runAction(workspacePath, "Couldn't update the comment", () => api.changesets.editComment(workspacePath, changeset.id, comment));
}

export async function moveChangesetToBranch(workspacePath: string, changeset: Changeset): Promise<void> {
  const branch = await prompt({
    title: `Move changeset ${changeset.id} to another branch`,
    label: 'Destination branch',
    description: 'The changeset and all its descendants on this branch will move. The branch is created if it does not exist.',
    initialValue: `${changeset.branch}/`,
    confirmLabel: 'Move changeset',
  });
  if (!branch) return;

  const moved = await runVoidAction(workspacePath, "Couldn't move the changeset", () =>
    api.changesets.moveToBranch(workspacePath, changeset.id, branch),
  );
  if (moved) toast.success(`Moved changeset ${changeset.id} to ${branch}`);
}

export async function deleteChangeset(workspacePath: string, changeset: Changeset): Promise<void> {
  const confirmed = await confirm({
    title: `Delete changeset ${changeset.id}?`,
    message: 'Only the last changeset of a branch can be deleted, and it is gone for good.',
    confirmLabel: 'Delete changeset',
    danger: true,
  });
  if (!confirmed) return;

  const deleted = await runVoidAction(workspacePath, "Couldn't delete the changeset", () => api.changesets.remove(workspacePath, changeset.id));
  if (deleted) toast.success(`Deleted changeset ${changeset.id}`);
}

/**
 * Makes the workspace match an older changeset of the loaded branch: a subtractive merge of everything after it,
 * reviewed in the merge view like any other merge, so conflicts are resolved there.
 */
export function revertWorkspaceToChangeset(changeset: Changeset, loadedChangeset: number): void {
  openMerge({ kind: 'subtractive', sourceSpec: `cs:${loadedChangeset}`, intervalOriginSpec: `cs:${changeset.id}` });
}
