import type { RevisionRef } from '@shared/domain/revision';
import { api } from '../../api/client';
import { runVoidAction } from '../../app/operations/runOperation';
import { confirm } from '../../ui/dialog/confirm';
import { toast } from '../../ui/toast/toastStore';

/** Saves the revision to a temp file and opens it in the editor `editorId`, or with the default app for its type. */
export async function openRevision(workspacePath: string, revision: RevisionRef, fileName: string, editorId?: string): Promise<void> {
  try {
    await api.history.openRevision(workspacePath, revision, fileName, editorId);
  } catch (error) {
    toast.error("Couldn't open the revision", error);
  }
}

export async function saveRevisionAs(workspacePath: string, revision: RevisionRef, fileName: string): Promise<void> {
  try {
    const savedPath = await api.history.saveRevisionAs(workspacePath, revision, fileName);
    if (savedPath) toast.success('Revision saved', savedPath);
  } catch (error) {
    toast.error("Couldn't save the revision", error);
  }
}

/** Loads an old revision's content into the workspace; the result shows up as a pending change. */
export async function revertItemTo(workspacePath: string, path: string, changesetId: number): Promise<void> {
  const confirmed = await confirm({
    title: `Revert ${path} to changeset ${changesetId}?`,
    message: 'The file will be checked out with the content it had in that changeset. Review and check it in from Changes.',
    confirmLabel: 'Revert file',
  });
  if (!confirmed) return;

  const reverted = await runVoidAction(workspacePath, "Couldn't revert the file", () => api.history.revertTo(workspacePath, path, changesetId));
  if (reverted) toast.success(`Reverted ${path}`, `Content from changeset ${changesetId} is now a pending change.`);
}
