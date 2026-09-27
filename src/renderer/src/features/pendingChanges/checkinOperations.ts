import type { PendingChange } from '@shared/domain/pendingChanges';
import { ApiError, api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { navigation } from '../../app/navigation/navigationStore';
import { runAction, runOperation, runRead } from '../../app/operations/runOperation';
import { queryClient } from '../../app/queryClient';
import { isAffectedByCheckinOrUpdate, isAffectedByShelving } from '../../app/refresh/refreshScopes';
import { firstLine } from '../../lib/text';
import { confirm } from '../../ui/dialog/confirm';
import { prompt } from '../../ui/dialog/prompt';
import { pluralize } from '../../lib/text';
import { updateToIncoming } from '../incoming/updateOperations';
import { useCheckinAfterUpdateStore } from './checkinAfterUpdate';
import { checkinRejection, overlappingPaths, type CheckinRejection } from './checkinRejection';
import { askCatchUpForCheckin } from './CheckinRejectedDialog';
import { useSuccessMomentStore } from './successMoment';

const MAX_RECENT_COMMENTS = 15;

interface CheckinOptions {
  workspacePath: string;
  changes: PendingChange[];
  comment: string;
  /** The incoming check saw the branch move on: update (or review what came in) before checking in, not after a rejection. */
  updateFirst?: boolean;
}

/** Asked before a check-in without a comment, when the setting says to. */
export function confirmCheckinWithoutComment(): Promise<boolean> {
  return confirm({
    title: 'Check in without a comment?',
    message: 'A short description helps your team understand the change later.',
    confirmLabel: 'Check in anyway',
  });
}

/**
 * Checks in the given changes. Resolves to true when a changeset was created. When someone checked in to the branch
 * meanwhile, offers to update and check in again (or to review what came in first); known beforehand (`updateFirst`),
 * it does so up front.
 */
export async function checkinChanges(options: CheckinOptions): Promise<boolean> {
  const { workspacePath, changes, comment } = options;
  if (options.updateFirst) return catchUpAndCheckin({ ...options, updateFirst: false }, null);

  const rejected: { rejection?: CheckinRejection } = {};
  const result = await runOperation({
    title: `Checking in ${pluralize(changes.length, 'change')}`,
    workspacePath,
    run: (operationId) => api.pendingChanges.checkin(workspacePath, { paths: changes.map((change) => change.path), comment }, operationId),
    affects: isAffectedByCheckinOrUpdate,
    successMessage: (created) => `Created changeset ${created.changesetId} on ${created.branch}`,
    successAction: (created) => ({
      label: 'View',
      run: () => navigation.openPage({ kind: 'diff', title: `Changeset ${created.changesetId}`, target: { kind: 'changeset', changesetId: created.changesetId } }),
    }),
    onFailure: (error) => {
      rejected.rejection = (error instanceof ApiError && checkinRejection(error.command)) || undefined;
      return rejected.rejection !== undefined;
    },
  });
  if (!result) return rejected.rejection ? catchUpAndCheckin(options, rejected.rejection) : false;

  useCheckinAfterUpdateStore.getState().forget(workspacePath);
  useSuccessMomentStore.getState().show(workspacePath, { verb: 'Checked in', changesetId: result.changesetId, branch: result.branch, detail: firstLine(comment) || undefined });
  if (comment.trim()) await rememberComment(comment.trim());
  return true;
}

/**
 * The branch moved on since the workspace was updated: `rejection` tells where it stood when `cm` refused the checkin,
 * null when the incoming check told beforehand. When what came in touches none of the files being checked in and
 * updating needs no decision, updates and checks in the same files with the same comment (asking first only after a
 * rejection). Otherwise leads to Incoming; once the workspace is updated, Changes offers to check in.
 */
async function catchUpAndCheckin(options: CheckinOptions, rejection: CheckinRejection | null): Promise<boolean> {
  const { workspacePath, changes } = options;
  const incoming = await runRead("Couldn't check what came in", () => api.merge.incomingChanges(workspacePath));
  if (!incoming?.branch) return false;
  // Someone updated the workspace since the incoming check: nothing to catch up with.
  if (!rejection && incoming.changesets.length === 0) return checkinChanges(options);

  const overlapping = overlappingPaths(incoming.files, changes.map((change) => change.path));
  const needsReview = overlapping.length + incoming.conflicts.length + incoming.blockedPaths.length > 0;
  const choice = !rejection && !needsReview ? 'updateAndCheckin' : await askCatchUpForCheckin({ incoming, overlapping, needsReview, rejected: rejection !== null });
  if (!choice) return false;

  if (choice === 'review') {
    // Changes offers to check in once the workspace updated past where it was. The automatic path checks in by itself,
    // so it remembers nothing: the offer would show while that checkin runs.
    const loadedChangeset = rejection?.loadedChangeset ?? incoming.loadedChangeset;
    useCheckinAfterUpdateStore.getState().remember(workspacePath, { branch: incoming.branch, loadedChangeset });
    navigation.goToView('incoming');
    return false;
  }
  if (!(await updateToIncoming(workspacePath, incoming))) return false;
  return checkinChanges(options);
}

/** Shelves the given changes. Resolves to true when a shelve was created. */
export async function shelveChanges(workspacePath: string, changes: PendingChange[], comment: string): Promise<boolean> {
  const shelveComment = comment.trim() || (await prompt({ title: 'Shelve changes', label: 'Comment', confirmLabel: 'Shelve' }));
  if (!shelveComment) return false;

  const shelveId = await runOperation({
    title: `Shelving ${pluralize(changes.length, 'change')}`,
    workspacePath,
    run: (operationId) => api.pendingChanges.shelve(workspacePath, changes.map((change) => change.path), shelveComment, operationId),
    affects: isAffectedByShelving,
    success: (id) => ({ title: `Shelved as shelve ${id}`, detail: 'Your changes are still in the workspace.' }),
  });
  return shelveId !== undefined;
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
