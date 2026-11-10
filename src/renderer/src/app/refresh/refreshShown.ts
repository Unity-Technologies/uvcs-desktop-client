import type { QueryClient } from '@tanstack/react-query';
import type { CodeReview } from '@shared/domain/codeReview';
import type { Place } from '@shared/domain/place';
import { codeReviewKey } from '../../features/codeReviews/codeReviewKey';
import type { Page } from '../navigation/pages';
import { useNavigation } from '../navigation/navigationStore';
import { invalidatePlaceIn, queryClient } from '../queryClient';
import { pageRefreshScope } from './pageRefreshScope';

/**
 * Refresh: reads again what the window shows of the place, or only what the page in front shows when it says
 * (`pageRefreshScope`). The Refresh command (⌘R, the menu's) and the views' and pages' Refresh buttons all run it.
 */
export function refreshShown(place: Place): Promise<void> {
  return refreshShownIn(queryClient, place, useNavigation.getState().pages.at(-1));
}

/** `refreshShown` on a given client, with this page in front. */
export function refreshShownIn(client: QueryClient, place: Place, frontPage: Page | undefined): Promise<void> {
  const reviewTargetOf = (reviewId: number) => client.getQueryData<CodeReview>(codeReviewKey(place, reviewId))?.target;
  return invalidatePlaceIn(client, place, pageRefreshScope(frontPage, reviewTargetOf));
}
