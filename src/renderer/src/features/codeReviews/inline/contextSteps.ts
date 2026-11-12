import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { PageOf } from '../../../app/navigation/pages';
import { commentLocationPage } from '../conversation/threadBadges';
import type { StepGroup } from '../rounds/reviewRounds';
import type { LineThread } from './fileThreads';

/** Where "How it was applied" is among the threads settled in its part of the conversation, and its neighbors. */
export interface ContextSteps {
  position: string;
  previous?: number;
  next?: number;
}

/**
 * Stepping through the threads settled in the part of the conversation the thread is in (`stepGroupsOf`: its round,
 * or since the last review): "2 of 4 in round 1". None for a thread that settled nothing, or the only one there.
 */
export function contextStepsOf(groups: readonly StepGroup[] | undefined, threadId: number): ContextSteps | undefined {
  const group = groups?.find((candidate) => candidate.threadIds.includes(threadId));
  if (!group || group.threadIds.length < 2) return undefined;
  const at = group.threadIds.indexOf(threadId);
  const position = `${at + 1} of ${group.threadIds.length}${group.scope ? ` ${group.scope}` : ''}`;
  return { position, previous: group.threadIds[at - 1], next: group.threadIds[at + 1] };
}

/**
 * Where "Show in Changes" leads: a request applied on a branch to the changeset that applied it, whose diff shows it
 * beside the fix (`threadsOfFile`); anything else where it was written (`commentLocationPage`). In the review's page,
 * so the reviewer stays in the review.
 */
export function showInChangesPage(reviewId: number, target: CodeReviewTarget, thread: LineThread): PageOf<'codeReview'> {
  const page = commentLocationPage(reviewId, thread.root);
  return target.kind === 'branch' && thread.state.kind === 'applied' ? { ...page, focusChangeset: thread.state.changesetId } : page;
}

/**
 * The dialog's one way out to the code: a request applied on a branch opens its changeset in the review's Changes, at
 * the thread ("Open changeset 5", `showInChangesPage`); any other thread shows where it was written there ("Show in
 * Changes"). A changeset applying a request on a review of no branch isn't among its changes: it opens on its own page.
 */
export type ContextFooterAction = { kind: 'changes'; label: string } | { kind: 'changesetPage'; label: string; changesetId: number };

export function contextFooterAction(target: CodeReviewTarget, thread: LineThread): ContextFooterAction {
  if (thread.state.kind !== 'applied') return { kind: 'changes', label: 'Show in Changes' };
  const label = `Open changeset ${thread.state.changesetId}`;
  return target.kind === 'branch' ? { kind: 'changes', label } : { kind: 'changesetPage', label, changesetId: thread.state.changesetId };
}
