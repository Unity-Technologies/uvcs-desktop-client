import { useMemo } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import type { CodeReview } from '@shared/domain/codeReview';
import { useChangesets } from '../../changesets/useChangesets';

/**
 * The changesets of a branch's review, newest first: the one `cm find` its Changes tab lists above the files
 * reads (the same query, so one read serves both). None for a review of a changeset or a shelve, which reads nothing.
 * `settled` once there's nothing more to wait for: read, failed, or nothing to read.
 */
export function useReviewChangesets(review: Pick<CodeReview, 'target'>): { changesets: readonly Changeset[] | undefined; settled: boolean } {
  const branch = review.target.kind === 'branch' ? review.target.branch : undefined;
  const filter = useMemo(() => ({ branch }), [branch]);
  const { data, isPending } = useChangesets(filter, { enabled: branch !== undefined });
  return branch === undefined ? { changesets: undefined, settled: true } : { changesets: data, settled: !isPending };
}
