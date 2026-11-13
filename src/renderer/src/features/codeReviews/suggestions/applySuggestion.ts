import type { FileContent } from '@shared/domain/content';
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
import type { SuggestedChange } from './suggestedChange';
import { codeChangedReason, otherChangesReason, suggestionTargetIn } from './suggestionApply';

/**
 * A suggestion to write into a workspace's file: what it changes, and the text of the revision it was written on, which
 * the file is checked against again right before writing (`suggestionTargetIn`).
 */
export interface SuggestionWrite {
  workspacePath: string;
  change: SuggestedChange;
  commentedText: string;
}

/**
 * Apply to my changes: writes the suggested lines into the workspace's file, nothing checked in. The change is pending
 * then, and Changes offers its change request to apply in the next check-in (docs/features/code-reviews.md "Applying
 * change requests"). Resolves to whether it was written.
 */
export async function applySuggestionToChanges(write: SuggestionWrite): Promise<boolean> {
  if (!(await writeSuggestion(write))) return false;
  toast.success(`Suggestion applied to ${fileNameOf(write.change.path)}`, 'Check it in from Changes, which offers its change request to apply.', {
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
  const { workspacePath, change } = write;
  // Changed since the button showed (an editor saved it): checking it in alone would take those changes too.
  if (await pendingChangeOf(workspacePath, change.path)) return refused(change.path, otherChangesReason(change.path));
  if (!(await writeSuggestion(write))) return false;
  // The file had no other change, so the one it has now is the suggestion's: no need to read the list again.
  const written: PendingChange = { path: change.path, kinds: ['changed'], itemType: 'file', size: 0, lastModified: '' };
  // Its comment names a change request that's applied once checked in: never one to pick again from the recent ones.
  const checkedIn = await checkinChanges({ workspacePath, changes: [written], paths: [change.path], addsPrivate: false, comment, remembersComment: false });
  if (!checkedIn) toast.info(`The suggestion stays in your changes`, `${fileNameOf(change.path)} has it: check it in from Changes.`);
  return checkedIn;
}

/**
 * Writes the suggestion, unless the lines it was written on aren't in the file any more: the file is read again and
 * checked as the button was (`suggestionTargetIn`), as the user may have edited it since. The new text shows at once,
 * then what shows the file is read again.
 */
async function writeSuggestion({ workspacePath, change, commentedText }: SuggestionWrite): Promise<boolean> {
  const target = suggestionTargetIn(change, commentedText, await readWorkspaceFile(workspacePath, change.path));
  if (target.kind === 'refused') return refused(change.path, target.reason);
  const after = withLinesReplaced(target.text, target.range.firstLine, target.range.lastLine, change.lines);
  if (after === null) return refused(change.path, codeChangedReason(change));
  showFileText(workspacePath, change.path, after);
  try {
    await api.content.writeWorkspaceFile(workspacePath, change.path, after);
    return true;
  } catch (error) {
    toast.error(`Couldn't write ${fileNameOf(change.path)}`, error);
    return false;
  } finally {
    await refreshFileViews(workspacePath);
  }
}

/** Says why nothing was written, as the disabled button would have. */
function refused(path: string, reason: string): false {
  toast.info(`Nothing was written to ${fileNameOf(path)}`, reason);
  return false;
}

async function readWorkspaceFile(workspacePath: string, path: string): Promise<FileContent | 'failed'> {
  try {
    return await api.content.read(workspacePlace(workspacePath), { kind: 'workspaceFile', path });
  } catch {
    return 'failed';
  }
}

/** The file's pending change, if any, from a fresh read of the list Changes shows (`cm status`, a local read). */
async function pendingChangeOf(workspacePath: string, path: string): Promise<PendingChange | undefined> {
  const { pendingChanges: filter } = await queryClient.fetchQuery(settingsQuery);
  const { changes } = await queryClient.fetchQuery({ ...pendingChangesQuery(workspacePath, filter), staleTime: 0 });
  return changes.find((pending) => pending.path === path);
}
