import type { Label } from '@shared/domain/label';
import { spec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runAction, runVoidAction } from '../../app/operations/runOperation';
import { switchWorkspace } from '../../app/shell/workspaceOperations';
import { confirm } from '../../ui/dialog/confirm';
import { prompt } from '../../ui/dialog/prompt';
import { toast } from '../../ui/toast/toastStore';
import { openCreateBranchDialog } from '../branches/CreateBranchDialog';
import { pickLabel } from './LabelPickerDialog';

export function switchToLabel(workspacePath: string, label: Label): Promise<boolean> {
  return switchWorkspace(workspacePath, spec.label(label.name), `label ${label.name}`);
}

export function mergeFromLabel(label: Label): void {
  navigation.openPage({ kind: 'merge', request: { kind: 'merge', sourceSpec: spec.label(label.name) } });
}

export function showLabelChanges(label: Label): void {
  navigation.openPage({ kind: 'diff', title: `Label ${label.name}`, target: { kind: 'changeset', changesetId: label.changeset } });
}

/** Compares two labels, older one on the left. */
export function diffLabels(first: Label, second: Label): void {
  const [older, newer] = first.changeset <= second.changeset ? [first, second] : [second, first];
  navigation.openPage({
    kind: 'diff',
    title: `${older.name} → ${newer.name}`,
    target: { kind: 'range', fromSpec: spec.label(older.name), toSpec: spec.label(newer.name) },
  });
}

export async function diffWithAnotherLabel(label: Label): Promise<void> {
  const other = await pickLabel({ title: `Compare ${label.name} with…`, exclude: label.name });
  if (other) diffLabels(label, other);
}

export function browseLabel(label: Label): void {
  navigation.openPage({ kind: 'browseRepository', changesetId: label.changeset });
}

export function createBranchFromLabel(workspacePath: string, label: Label): void {
  openCreateBranchDialog(workspacePath, {
    parentBranch: label.branch,
    startingPoint: spec.label(label.name),
    startingPointLabel: `label ${label.name} (changeset ${label.changeset})`,
  });
}

export async function renameLabel(workspacePath: string, label: Label): Promise<void> {
  const newName = await prompt({ title: 'Rename label', label: 'New name', initialValue: label.name, confirmLabel: 'Rename' });
  if (!newName) return;
  await runAction(workspacePath, "Couldn't rename the label", () => api.labels.rename(workspacePath, label.name, newName));
}

export async function deleteLabels(workspacePath: string, labels: Label[]): Promise<void> {
  const confirmed = await confirm({
    title: labels.length === 1 ? `Delete label ${labels[0]!.name}?` : `Delete ${labels.length} labels?`,
    message: 'The labeled changesets are kept. This cannot be undone.',
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;

  const deleted = await runVoidAction(workspacePath, "Couldn't delete the label", () =>
    api.labels.delete(workspacePath, labels.map((label) => label.name)),
  );
  if (deleted) toast.success(labels.length === 1 ? `Deleted label ${labels[0]!.name}` : `Deleted ${labels.length} labels`);
}
