import type { MergeRequestState } from '@shared/domain/codeReview';
import type { CmPlace } from './cmPlace';

/*
 * `cm mergerequest` only for what a merge request has and a code review hasn't: its state and its destination. Every
 * other write on one (reviewers, statuses, comments, title, description, delete) is `cm codereview`'s, which takes a
 * merge request's id unchanged (docs/features/merge-requests.md). Both edits print nothing.
 */

/** `cm mergerequest edit --mergerequeststatus`: the state by its English name, as `cm` takes it whatever its language. */
export function mergeRequestStateArgs(reviewId: number, state: MergeRequestState, at: CmPlace): string[] {
  return ['mergerequest', 'edit', String(reviewId), `--mergerequeststatus=${state}`, ...at.repositoryOption];
}

/** `cm mergerequest edit --destination`: the branch it merges into from now on. */
export function mergeRequestDestinationArgs(reviewId: number, branch: string, at: CmPlace): string[] {
  return ['mergerequest', 'edit', String(reviewId), `--destination=${at.spec(`br:${branch}`)}`, ...at.repositoryOption];
}
