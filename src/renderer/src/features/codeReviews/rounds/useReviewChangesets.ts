import { useMemo } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import type { CodeReview } from '@shared/domain/codeReview';
import { useChangesets } from '../../changesets/useChangesets';
import { branchChangesetsFilter } from '../../diff/branchDiffChangesets';
import { answerIsCurrent } from './keptLayout';

/**
 * The changesets of a branch's review, newest first: the one `cm find` its Changes tab lists above the files
 * reads (the same query, `branchChangesetsFilter`, so one read serves both). None for a review of a changeset or a shelve, which reads nothing.
 * `settled` once there's nothing more to wait for: read, failed, or nothing to read. `current` once they're this
 * review's as read since the page opened (`answerIsCurrent`), not a cached or a previous branch's list.
 */
export function useReviewChangesets(review: Pick<CodeReview, 'target'>): { changesets: readonly Changeset[] | undefined; settled: boolean; current: boolean } {
  const branch = review.target.kind === 'branch' ? review.target.branch : undefined;
  const filter = useMemo(() => (branch === undefined ? {} : branchChangesetsFilter(branch)), [branch]);
  const query = useChangesets(filter, { enabled: branch !== undefined });
  return branch === undefined ? { changesets: undefined, settled: true, current: true } : { changesets: query.data, settled: !query.isPending, current: answerIsCurrent(query) };
}
