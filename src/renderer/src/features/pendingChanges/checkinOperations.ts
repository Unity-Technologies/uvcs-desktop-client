import type { PendingChange } from '@shared/domain/pendingChanges';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { navigation } from '../../app/navigation/navigationStore';
import { runAction, runOperation } from '../../app/operations/runOperation';
import { queryClient } from '../../app/queryClient';
import { confirm } from '../../ui/dialog/confirm';
import { prompt } from '../../ui/dialog/prompt';
import { toast } from '../../ui/toast/toastStore';

const MAX_RECENT_COMMENTS = 15;

interface CheckinOptions {
  workspacePath: string;
  changes: PendingChange[];
  comment: string;
  warnOnEmptyComment: boolean;
}

/** Checks in the given changes. Resolves to true when a changeset was created. */
export async function checkinChanges({ workspacePath, changes, comment, warnOnEmptyComment }: CheckinOptions): Promise<boolean> {
  if (!comment.trim() && warnOnEmptyComment) {
    const proceed = await confirm({
      title: 'Check in without a comment?',
      message: 'A short description helps your team understand the change later.',
      confirmLabel: 'Check in anyway',
    });
    if (!proceed) return false;
  }

  const result = await runOperation({
    title: `Checking in ${changes.length} ${changes.length === 1 ? 'change' : 'changes'}`,
    workspacePath,
    cancellable: false,
    run: (operationId) => api.pendingChanges.checkin(workspacePath, { paths: changes.map((change) => change.path), comment }, operationId),
    successMessage: (created) => `Created changeset ${created.changesetId} on ${created.branch}`,
    successAction: (created) => ({
      label: 'View',
      run: () => navigation.openPage({ kind: 'diff', title: `Changeset ${created.changesetId}`, target: { kind: 'changeset', changesetId: created.changesetId } }),
    }),
  });
  if (!result) return false;

  if (comment.trim()) await rememberComment(comment.trim());
  return true;
}

export async function shelveChanges(workspacePath: string, changes: PendingChange[], comment: string): Promise<void> {
  const shelveComment = comment.trim() || (await prompt({ title: 'Shelve changes', label: 'Comment', confirmLabel: 'Shelve' }));
  if (!shelveComment) return;

  const shelveId = await runAction(workspacePath, "Couldn't shelve the changes", () =>
    api.pendingChanges.shelve(workspacePath, changes.map((change) => change.path), shelveComment),
  );
  if (shelveId !== undefined) toast.success(`Shelved as shelve ${shelveId}`, 'Your changes are still in the workspace.');
}

export function undoUnchangedCheckouts(workspacePath: string): Promise<void | undefined> {
  return runAction(workspacePath, "Couldn't undo the unchanged checkouts", () => api.pendingChanges.undoUnchanged(workspacePath));
}

async function rememberComment(comment: string): Promise<void> {
  const { recentComments } = await api.settings.get();
  const updated = await api.settings.update({
    recentComments: [comment, ...recentComments.filter((recent) => recent !== comment)].slice(0, MAX_RECENT_COMMENTS),
  });
  queryClient.setQueryData(queryKeys.settings, updated);
}
