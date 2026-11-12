import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { PageOf } from '../../../app/navigation/pages';
import { commentLocationPage } from '../conversation/threadBadges';
import type { LineThread } from './fileThreads';

/** Where "How it was applied" is among the threads settled since the user's last review, and its neighbors. */
export interface ContextSteps {
  position: string;
  previous?: number;
  next?: number;
}

/**
 * Stepping through the threads settled since the last review (`settledSinceIds`, in the order the conversation shows
 * them), from one of them; none from any other thread, or when it's the only one, with nowhere to go.
 */
export function contextStepsOf(steps: readonly number[] | undefined, threadId: number): ContextSteps | undefined {
  const at = steps?.indexOf(threadId) ?? -1;
  if (!steps || at === -1 || steps.length < 2) return undefined;
  return { position: `${at + 1} of ${steps.length} since last review`, previous: steps[at - 1], next: steps[at + 1] };
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
