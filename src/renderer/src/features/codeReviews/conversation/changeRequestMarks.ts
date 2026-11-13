import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { QueryFilter } from '@shared/domain/query';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { cmVersionAtLeast } from '../../../lib/cmVersion';
import { branchChangesetsFilter } from '../../diff/branchDiffChangesets';
import type { ReviewThread } from './reviewThreads';

/** The first `cm` with `cm codereview comment apply` and `unapply`, the commands that mark a change request by hand. */
const FIRST_CM_MARKING_CHANGE_REQUESTS = [11, 0, 16, 10616];

/**
 * What a change request can be marked by hand: applied in a changeset the user picks (`cm codereview comment apply`),
 * as a check-in naming it would; or, once applied, not applied, open again (`… unapply`).
 */
export type ChangeRequestMark = 'applied' | 'notApplied';

/**
 * The mark a comment's menu offers (`commentMenu`): on the change request itself, not its replies; to anyone signed
 * in, as anyone may check in the change that applies it, its author too; an open one marked applied, an applied one
 * not applied. A discarded one is settled, as the official client has it; replying reopens nothing either.
 */
export function changeRequestMarkOf(comment: ReviewComment, thread: ReviewThread, user: string | undefined, cmVersion: string | undefined): ChangeRequestMark | undefined {
  if (comment.id !== thread.root.id || thread.root.kind !== 'changeRequest' || user === undefined) return undefined;
  if (!cmVersionAtLeast(cmVersion, FIRST_CM_MARKING_CHANGE_REQUESTS)) return undefined;
  if (thread.state.kind === 'open') return 'applied';
  return thread.state.kind === 'applied' ? 'notApplied' : undefined;
}

/**
 * The changesets "Mark as applied" offers, newest first: a branch's review, its branch's (the read its Changes tab
 * lists them by, `branchChangesetsFilter`, so the page has them already); any other review, undefined, the
 * repository's newest. Any other changeset of the repository is picked by its number.
 */
export function changesetsToApplyIn(target: CodeReviewTarget): QueryFilter | undefined {
  return target.kind === 'branch' ? branchChangesetsFilter(target.branch) : undefined;
}
