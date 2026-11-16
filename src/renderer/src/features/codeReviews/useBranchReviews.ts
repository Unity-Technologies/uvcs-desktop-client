import { useQueries, useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { BRANCH_REVIEWS_BLOCK, type CodeReviewSummary } from '@shared/domain/codeReview';
import { placeId, type Place } from '@shared/domain/place';
import { api } from '../../api/client';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { usePlace } from '../../app/workspace/useWorkspace';
import { batchLoader } from '../../lib/batchLoader';
import { branchReviewKey } from './branchReviewKey';
import { standingReviewsOf } from './branchReviews';

/**
 * The review that stands for a branch, by its object id: what its chip, its hover card and its details show. Each
 * branch is its own query, so a view asks only for the branches it shows (the rows drawn, the headers in view and a
 * margin); the asks of one turn are read together, in blocks of `BRANCH_REVIEWS_BLOCK`, one `cm find review` each
 * (`branchReviewsLoaderOf`). Kept per branch and rarely read again (`SLOW_CHANGING_QUERY`); under the reviews' area,
 * so a write on a review or a Refresh reads again the branches still shown, in blocks too.
 */
export function branchReviewQuery(place: Place, branchId: number) {
  return {
    queryKey: branchReviewKey(place, branchId),
    // A branch scrolled out of view before its block is read is dropped from it (`batchLoader`'s withdrawn asks).
    queryFn: ({ signal }: { signal: AbortSignal }) => branchReviewsLoaderOf(place).load(branchId, signal),
    ...SLOW_CHANGING_QUERY,
  };
}

/**
 * The review that stands for one branch: a row's chip, a branch's details. None while it's read, null with none.
 * `enabled` once the row stays in view (`useSettled`), so a row a scroll passes over asks nothing.
 */
export function useBranchReview(branchId: number, enabled: boolean): CodeReviewSummary | null | undefined {
  const { data } = useQuery({ ...branchReviewQuery(usePlace(), branchId), enabled });
  return data;
}

/** The reviews that stand for several branches, by branch id, those read so far: the Branch Explorer's headers in view. */
export function useBranchReviews(branchIds: readonly number[]): ReadonlyMap<number, CodeReviewSummary> {
  const place = usePlace();
  // Stable while the branches are, so the map changes only when a read lands (the canvas redraws on a new one).
  const combine = useCallback(
    (results: { data?: CodeReviewSummary | null }[]) => {
      const byBranch = new Map<number, CodeReviewSummary>();
      results.forEach((result, index) => result.data && byBranch.set(branchIds[index]!, result.data));
      return byBranch;
    },
    [branchIds],
  );
  return useQueries({ queries: branchIds.map((branchId) => branchReviewQuery(place, branchId)), combine });
}

/** How long the loader gathers asks before it reads them: a few frames. */
const GATHER_MS = 50;

const loaders = new Map<string, ReturnType<typeof newLoader>>();

/** One loader per place, so that the branches asked in one turn, from any view of the window, share their reads. */
function branchReviewsLoaderOf(place: Place) {
  const key = placeId(place);
  let loader = loaders.get(key);
  if (!loader) {
    loader = newLoader(place);
    loaders.set(key, loader);
  }
  return loader;
}

function newLoader(place: Place) {
  return batchLoader<number, CodeReviewSummary | null>({
    maxBatch: BRANCH_REVIEWS_BLOCK,
    // A view's rows and headers settle a frame or two apart (the table's first rows are drawn before the rest): one
    // window gathers them, so a screen is one read.
    schedule: (flush) => setTimeout(flush, GATHER_MS),
    read: async (branchIds) => standingReviewsOf(branchIds, await api.codeReviews.listSummaries(place, { targetBranchIds: branchIds })),
  });
}
