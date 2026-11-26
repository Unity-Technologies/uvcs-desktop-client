import { useQuery } from '@tanstack/react-query';
import type { Place } from '@shared/domain/place';
import { isReviewModeOn, needsReviewModeKey, withReviewMode } from '@shared/domain/reviewModePlaces';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { IMMUTABLE_QUERY, queryClient } from '../../app/queryClient';
import { saveShown, useSettings } from '../../app/settings/useSettings';
import { toast } from '../../ui/toast/toastStore';

/** The keys of a review, said the same wherever review mode is offered or shown. */
export const REVIEW_KEYS = 'R marks a file, J and K move';

/**
 * What review mode is kept by for the place: its workspace's or repository's GUID, which a rename or a move keeps
 * (`api.review.reviewModeKey`). Asked once per place, as a GUID never changes.
 */
function reviewModeKeyQuery(place: Place) {
  return {
    queryKey: queryKeys.inPlace(place, 'reviewModeKey'),
    queryFn: () => api.review.reviewModeKey(place),
    staleTime: Infinity,
    meta: IMMUTABLE_QUERY,
  };
}

/** Off until the place's key is known; its key is asked only while review mode is on somewhere (`needsReviewModeKey`). */
export function useReviewModeOn(place: Place): boolean {
  const { reviewModeWorkspaces } = useSettings();
  const { data: key } = useQuery({ ...reviewModeKeyQuery(place), enabled: needsReviewModeKey(reviewModeWorkspaces) });
  return isReviewModeOn(reviewModeWorkspaces, key);
}

/**
 * Turns review mode on or off for the place, shown at once. The main process changes the stored list
 * (`api.review.setReviewMode`): another window's change, or the move of what was kept by the place's path, is never
 * written over. Turning it on is taking the offer, so the hint never shows again.
 */
export async function setReviewMode(place: Place, on: boolean): Promise<void> {
  const key = await queryClient.fetchQuery(reviewModeKeyQuery(place));
  await saveShown(
    (current) => ({ ...current, reviewModeWorkspaces: withReviewMode(current.reviewModeWorkspaces, key, on), ...(on && { reviewModeHintDone: true }) }),
    () => api.review.setReviewMode(place, on),
  );
}

/** Review mode came on without its button (R, or marking a file from a menu): say so, how it works, and the way back. */
export function announceReviewMode(place: Place): void {
  toast.info('Review mode on', REVIEW_KEYS, { label: 'Turn off', run: () => void setReviewMode(place, false) });
}
