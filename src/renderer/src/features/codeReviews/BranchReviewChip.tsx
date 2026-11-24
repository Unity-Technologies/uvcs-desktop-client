import { useQuery } from '@tanstack/react-query';
import type { Place } from '@shared/domain/place';
import { useSettled } from '../../lib/useSettled';
import { CodeReviewChip } from './CodeReviewChip';
import { branchReviewQuery } from './useBranchReviews';

/**
 * A branch's review in a list to pick a branch from: the Branches view's chip (`CodeReviewChip`), its hover card and
 * its click opening the review once `leave` closed what holds the list; nothing for a branch without one. Asked once
 * the row stays drawn (`useSettled`), with the other rows in view, in one read (`branchReviewQuery`).
 */
export function BranchReviewChip({ place, branchId, leave }: { place: Place; branchId: number; leave: () => void }) {
  const { data: review } = useQuery({ ...branchReviewQuery(place, branchId), enabled: useSettled() });
  return review ? <CodeReviewChip review={review} beforeOpen={leave} insideButton /> : null;
}
