import type { RepositoryVersion } from '@shared/domain/content';
import type { RevisionRef } from '@shared/domain/revision';
import { api } from '../../api/client';
import { currentExternalApps } from '../../components/externalApps/externalApps';
import { runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByPendingChangeEdit } from '../../app/refresh/refreshScopes';
import { confirm } from '../../ui/dialog/confirm';
import { toast } from '../../ui/toast/toastStore';

/**
 * Saves the revision to a temp file and opens it: in the editor `editorId`, with its default app for `null`, and as its
 * menu's first entry does when omitted (the user's editor, else the default app: a double-click in Browse repository).
 */
export function openRevision(workspacePath: string, revision: RevisionRef, fileName: string, editorId: string | null = currentExternalApps().editorId): Promise<void> {
  return openVersion(workspacePath, { kind: 'revision', revision, fileName }, fileName, editorId);
}

export function saveRevisionAs(workspacePath: string, revision: RevisionRef, fileName: string): Promise<void> {
  return saveVersionAs(workspacePath, { kind: 'revision', revision, fileName }, fileName);
}

/** `openRevision` for any version kept in the repository, e.g. a merge's incoming or base version of a file. */
export async function openVersion(workspacePath: string, version: RepositoryVersion, fileName: string, editorId: string | null = currentExternalApps().editorId): Promise<void> {
  try {
    await api.history.openRevision(workspacePath, version, fileName, editorId ?? undefined);
  } catch (error) {
    toast.error("Couldn't open the revision", error);
  }
}

/** `saveRevisionAs` for any version kept in the repository. */
export async function saveVersionAs(workspacePath: string, version: RepositoryVersion, fileName: string): Promise<void> {
  try {
    const savedPath = await api.history.saveRevisionAs(workspacePath, version, fileName);
    if (savedPath) toast.success('Revision saved', savedPath);
  } catch (error) {
    toast.error("Couldn't save the revision", error);
  }
}

/**
 * Loads an old revision's content into the workspace; the result shows up as a pending change. `cm revert` checks the
 * file out, which may take its lock, so it refreshes what a checkout does.
 */
export async function revertItemTo(workspacePath: string, path: string, changesetId: number): Promise<void> {
  const confirmed = await confirm({
    title: `Revert ${path} to changeset ${changesetId}?`,
    message: 'The file will be checked out with the content it had in that changeset. Review and check it in from Changes.',
    confirmLabel: 'Revert file',
  });
  if (!confirmed) return;

  const reverted = await runVoidAction(workspacePath, "Couldn't revert the file", () => api.history.revertTo(workspacePath, path, changesetId), isAffectedByPendingChangeEdit);
  if (reverted) toast.success(`Reverted ${path}`, `Content from changeset ${changesetId} is now a pending change.`);
}
