import type { LabelInfo as Label } from '@shared/domain/label';
import type { Place } from '@shared/domain/place';
import { spec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import type { PageOf } from '../../app/navigation/pages';
import { runAction, runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByLabels } from '../../app/refresh/refreshScopes';
import { switchWorkspace } from '../../app/shell/workspaceOperations';
import { confirm } from '../../ui/dialog/confirm';
import { prompt } from '../../ui/dialog/prompt';
import { toast } from '../../ui/toast/toastStore';
import { openCreateBranchDialog } from '../branches/CreateBranchDialog';
import { pickChangeset } from '../changesets/ChangesetPickerDialog';
import { openCreateLabelDialog } from './CreateLabelDialog';
import { validateLabelName } from './labelNames';
import { pickLabel } from './LabelPickerDialog';

export function switchToLabel(workspacePath: string, label: Label): Promise<boolean> {
  return switchWorkspace(workspacePath, spec.label(label.name), `label ${label.name}`);
}

export function mergeFromLabel(label: Label): void {
  navigation.openPage({ kind: 'merge', request: { kind: 'merge', sourceSpec: spec.label(label.name) } });
}

/** The diff of what the labeled changeset changed. */
export function labelDiffPage(label: Pick<Label, 'name' | 'changeset'>, focusPath?: string): PageOf<'diff'> {
  return { kind: 'diff', title: `Label ${label.name}`, target: { kind: 'changeset', changesetId: label.changeset }, label: label.name, focusPath };
}

export function showLabelChanges(label: Label, focusPath?: string): void {
  navigation.openPage(labelDiffPage(label, focusPath));
}

/** Compares two labels, older one on the left. */
export function diffLabels(first: Label, second: Label): void {
  const [older, newer] = first.changeset <= second.changeset ? [first, second] : [second, first];
  navigation.openPage(labelRangeDiffPage(older.name, newer.name));
}

/** The diff from one label (on the left) to another. */
export function labelRangeDiffPage(older: string, newer: string, focusPath?: string): PageOf<'diff'> {
  return { kind: 'diff', title: `${older} → ${newer}`, target: { kind: 'range', fromSpec: spec.label(older), toSpec: spec.label(newer) }, focusPath };
}

export async function diffWithAnotherLabel(label: Label): Promise<void> {
  const other = await pickLabel({ title: `Compare ${label.name} with…`, exclude: label.name });
  if (other) diffLabels(label, other);
}

export function browseLabel(label: Label): void {
  navigation.openPage({ kind: 'browseRepository', changesetId: label.changeset });
}

/** Resolves to the new branch's name, once created. */
export function createBranchFromLabel(place: Place, label: Label): Promise<string | undefined> {
  return openCreateBranchDialog(place, {
    parentBranch: label.branch,
    startingPoint: spec.label(label.name),
    startingPointLabel: `label ${label.name} (changeset ${label.changeset})`,
  });
}

export async function renameLabel(place: Place, label: Label): Promise<void> {
  const newName = await prompt({ title: 'Rename label', label: 'New name', initialValue: label.name, confirmLabel: 'Rename', validate: validateLabelName });
  if (!newName) return;
  await runAction(place, "Couldn't rename the label", () => api.labels.rename(place, label.name, newName), isAffectedByLabels);
}

/** Resolves to whether it saved, so a comment that couldn't be saved stays in its editor. */
export function saveLabelComment(place: Place, label: Label, comment: string): Promise<boolean> {
  return runVoidAction(place, "Couldn't update the comment", () => api.labels.editComment(place, label, comment), isAffectedByLabels);
}

/**
 * A new label from the Labels view: on what the workspace has loaded, or, with no workspace (nothing loaded), on a
 * changeset the user picks first.
 */
export async function newLabel(place: Place): Promise<void> {
  if (place.kind === 'workspace') return openCreateLabelDialog(place);
  const changesetId = await pickChangeset({ title: 'Label a changeset' });
  if (changesetId !== undefined) openCreateLabelDialog(place, changesetId);
}

/** What the Labels view's empty state offers to label: the workspace's changeset, or any one with no workspace. */
export function newLabelActionLabel(place: Place): string {
  return place.kind === 'workspace' ? 'Label your workspace changeset' : 'Label a changeset';
}

export async function deleteLabels(place: Place, labels: Label[]): Promise<void> {
  const confirmed = await confirm({
    title: labels.length === 1 ? `Delete label ${labels[0]!.name}?` : `Delete ${labels.length} labels?`,
    message: 'The labeled changesets are kept. This cannot be undone.',
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;

  const deleted = await runVoidAction(place, "Couldn't delete the label", () =>
    api.labels.delete(place, labels.map((label) => label.name)),
    isAffectedByLabels,
  );
  if (deleted) toast.success(labels.length === 1 ? `Deleted label ${labels[0]!.name}` : `Deleted ${labels.length} labels`);
}
