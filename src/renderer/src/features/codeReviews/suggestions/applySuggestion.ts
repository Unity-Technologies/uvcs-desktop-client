import { workspacePlace } from '@shared/domain/place';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { api } from '../../../api/client';
import { navigation } from '../../../app/navigation/navigationStore';
import { queryClient } from '../../../app/queryClient';
import { settingsQuery } from '../../../app/settings/useSettings';
import { fileNameOf } from '../../../lib/text';
import { toast } from '../../../ui/toast/toastStore';
import { refreshFileViews, showFileText } from '../../diff/viewer/fileText';
import { checkinChanges } from '../../pendingChanges/checkinOperations';
import { pendingChangesQuery } from '../../pendingChanges/usePendingChanges';
import { withLinesReplaced } from './replaceLines';

/** Where a suggestion goes: a workspace's file, as it was read when the user chose, and its lines to replace. */
export interface SuggestionWrite {
  workspacePath: string;
  /** Workspace-relative, as the review's diff names it. */
  path: string;
  /** The file's text the decision was made on (`suggestionApplyOf`): a file changed since isn't written. */
  text: string;
  firstLine: number;
  lastLine: number;
  lines: readonly string[];
}

/**
 * Apply to my changes: writes the suggested lines into the workspace's file, nothing checked in. The change is pending
 * then, and Changes offers its change request to apply in the next check-in (docs/features/code-reviews.md "Applying
 * change requests"). Resolves to whether it was written.
 */
export async function applySuggestionToChanges(write: SuggestionWrite): Promise<boolean> {
  if (!(await writeSuggestion(write))) return false;
  toast.success(`Suggestion applied to ${fileNameOf(write.path)}`, 'Check it in from Changes, which offers its change request to apply.', {
    label: 'Show changes',
    run: () => navigation.goToView('changes'),
  });
  return true;
}

/**
 * Check in suggestion: writes the suggested lines, then checks in that file alone with `comment`, which names the
 * change request (`[apply-change:…]`) so `cm` marks it applied; the check-in refreshes the reviews for it
 * (`withChangeRequestsApplied`). A failed check-in leaves the file written, as a pending change: the user asked for it,
 * nothing is lost, and Changes checks it in once the cause (a lock, the server) is gone. Undoing the write would risk
 * an edit made to the file meanwhile. Resolves to whether a changeset was created.
 */
export async function checkInSuggestion(write: SuggestionWrite, comment: string): Promise<boolean> {
  if (!(await writeSuggestion(write))) return false;
  const change = await pendingChangeOf(write.workspacePath, write.path);
  const checkedIn = await checkinChanges({ workspacePath: write.workspacePath, changes: [change], paths: [write.path], addsPrivate: false, comment });
  if (!checkedIn) toast.info(`The suggestion stays in your changes`, `${fileNameOf(write.path)} has it: check it in from Changes.`);
  return checkedIn;
}

/** Writes the suggestion, unless the file changed since it was read; shows it at once, then re-reads what shows the file. */
async function writeSuggestion({ workspacePath, path, text, firstLine, lastLine, lines }: SuggestionWrite): Promise<boolean> {
  const name = fileNameOf(path);
  const now = await readWorkspaceText(workspacePath, path);
  const after = now === text ? withLinesReplaced(text, firstLine, lastLine, lines) : null;
  if (after === null) {
    // Someone (an editor, an agent) wrote it since: the line may be elsewhere now, so nothing is written.
    toast.info(`${name} changed since`, 'Nothing was written: look at the suggestion again.');
    return false;
  }
  showFileText(workspacePath, path, after);
  try {
    await api.content.writeWorkspaceFile(workspacePath, path, after);
    return true;
  } catch (error) {
    toast.error(`Couldn't write ${name}`, error);
    return false;
  } finally {
    await refreshFileViews(workspacePath);
  }
}

async function readWorkspaceText(workspacePath: string, path: string): Promise<string | undefined> {
  try {
    return (await api.content.read(workspacePlace(workspacePath), { kind: 'workspaceFile', path })).text;
  } catch {
    return undefined;
  }
}

/**
 * The file's pending change, from the list Changes reads (read again as the write refreshed it). `cm` may not see a
 * write in the second of the file's last update (it compares timestamps): the change is named as one then, and `cm
 * checkin` tells.
 */
async function pendingChangeOf(workspacePath: string, path: string): Promise<PendingChange> {
  const { pendingChanges: filter } = await queryClient.fetchQuery(settingsQuery);
  const { changes } = await queryClient.fetchQuery(pendingChangesQuery(workspacePath, filter));
  return changes.find((change) => change.path === path) ?? { path, kinds: ['changed'], itemType: 'file', size: 0, lastModified: '' };
}
