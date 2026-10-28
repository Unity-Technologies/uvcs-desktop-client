import type { Place } from '@shared/domain/place';
import type { Changeset, ChangesetInfo } from '@shared/domain/changeset';
import type { MergeRequest } from '@shared/domain/merge';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import type { PageOf } from '../../app/navigation/pages';
import { runRead, runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByChangesetComment, isAffectedByChangesetMove } from '../../app/refresh/refreshScopes';
import { switchWorkspace } from '../../app/shell/workspaceOperations';
import { askForComment } from '../../components/EditCommentDialog';
import { branchLabel } from '../../lib/branchLabels';
import { confirm } from '../../ui/dialog/confirm';
import { prompt } from '../../ui/dialog/prompt';
import { toast } from '../../ui/toast/toastStore';
import { pickBranch } from '../branches/BranchPickerDialog';
import { pickChangeset } from './ChangesetPickerDialog';

/** The diff of what a changeset changed. */
export function changesetDiffPage(changeset: Pick<Changeset, 'id'>, focusPath?: string): PageOf<'diff'> {
  return { kind: 'diff', title: `Changeset ${changeset.id}`, target: { kind: 'changeset', changesetId: changeset.id }, focusPath };
}

export function openChangesetDiff(changeset: Pick<Changeset, 'id'>, focusPath?: string): void {
  navigation.openPage(changesetDiffPage(changeset, focusPath));
}

/** Compares the state after the older changeset (on the left) with the state after the newer one, in either order. */
export function openRangeDiff(first: Pick<Changeset, 'id'>, second: Pick<Changeset, 'id'>): void {
  navigation.openPage(rangeDiffPage(first.id, second.id));
}

/** The diff from the state after one changeset (on the left) to the state after another, as given. */
export function rangeDiffPage(from: number, to: number, focusPath?: string): PageOf<'diff'> {
  const [older, newer] = from <= to ? [from, to] : [to, from];
  return { kind: 'diff', title: `Changesets ${older} → ${newer}`, target: { kind: 'range', fromSpec: `cs:${older}`, toSpec: `cs:${newer}` }, focusPath };
}

export async function diffWithAnotherChangeset(changeset: Pick<Changeset, 'id'>): Promise<void> {
  const other = await pickChangeset({ title: `Compare changeset ${changeset.id} with…`, exclude: changeset.id });
  if (other !== undefined) openRangeDiff(changeset, { id: other });
}

export function openMerge(request: MergeRequest): void {
  navigation.openPage({ kind: 'merge', request });
}

export async function mergeChangesetTo(changeset: Pick<Changeset, 'id' | 'branch'>): Promise<void> {
  const destination = await pickBranch({
    title: `Merge changeset ${changeset.id} to…`,
    description: 'The merge happens on the server; your workspace is not touched.',
    exclude: changeset.branch,
  });
  if (destination) openMerge({ kind: 'merge', sourceSpec: `cs:${changeset.id}`, destinationBranch: destination.name });
}

export function switchToChangeset(workspacePath: string, changeset: Pick<Changeset, 'id'>): Promise<boolean> {
  return switchWorkspace(workspacePath, `cs:${changeset.id}`, `changeset ${changeset.id}`);
}

export async function editChangesetComment(place: Place, changeset: Pick<Changeset, 'id' | 'comment'>): Promise<void> {
  const comment = await askForComment(`changeset ${changeset.id}`, changeset.comment);
  if (comment !== undefined) await saveChangesetComment(place, changeset, comment);
}

/** Resolves to whether it saved, so a comment that couldn't be saved stays in its editor. */
export function saveChangesetComment(place: Place, changeset: Pick<Changeset, 'id'>, comment: string): Promise<boolean> {
  return runVoidAction(place, "Couldn't update the comment", () => api.changesets.editComment(place, changeset.id, comment), isAffectedByChangesetComment);
}

export async function moveChangesetToBranch(place: Place, changeset: Pick<Changeset, 'id' | 'branch'>): Promise<void> {
  const branch = await prompt({
    title: `Move changeset ${changeset.id} to another branch`,
    label: 'Destination branch',
    description: 'The changeset and all its descendants on this branch will move. The branch is created if it does not exist.',
    initialValue: `${changeset.branch}/`,
    confirmLabel: 'Move changeset',
  });
  if (!branch) return;

  const moved = await runVoidAction(place, "Couldn't move the changeset", () =>
    api.changesets.moveToBranch(place, changeset.id, branch),
    isAffectedByChangesetMove,
  );
  if (moved) toast.success(`Moved changeset ${changeset.id} to ${branchLabel(branch)}`);
}

export async function deleteChangeset(place: Place, changeset: Pick<Changeset, 'id'>): Promise<void> {
  const confirmed = await confirm({
    title: `Delete changeset ${changeset.id}?`,
    message: 'Only the last changeset of a branch can be deleted, and it is gone for good.',
    confirmLabel: 'Delete changeset',
    danger: true,
  });
  if (!confirmed) return;

  const deleted = await runVoidAction(place, "Couldn't delete the changeset", () => api.changesets.remove(place, changeset.id), isAffectedByChangesetMove);
  if (deleted) toast.success(`Deleted changeset ${changeset.id}`);
}

/**
 * Makes the workspace match an older changeset of the loaded branch: a subtractive merge of everything after it,
 * reviewed in the merge view like any other merge, so conflicts are resolved there.
 */
export function revertWorkspaceToChangeset(changeset: Pick<Changeset, 'id'>, loadedChangeset: number): void {
  openMerge({ kind: 'subtractive', sourceSpec: `cs:${loadedChangeset}`, intervalOriginSpec: `cs:${changeset.id}` });
}

/** A changeset's GUID, read when a view that didn't read it (the Branch Explorer) copies it. */
export function readChangesetGuid(place: Place, changeset: ChangesetInfo): Promise<string | undefined> {
  if (changeset.guid) return Promise.resolve(changeset.guid);
  return runRead("Couldn't read the changeset's GUID", async () => (await api.changesets.get(place, changeset.id)).guid);
}
