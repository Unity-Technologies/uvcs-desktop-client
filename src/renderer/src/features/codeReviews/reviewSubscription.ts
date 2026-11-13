import type { ReviewSubscription, ReviewSubscriptionReason } from '@shared/domain/codeReview';
import { isCmVersionAtLeast, type CmVersionNumbers } from '../../lib/cmVersion';

/**
 * The first `cm` with `cm codereview subscription`, `subscribe` and `unsubscribe`, the version reviews need already
 * (docs/features/code-reviews.md). An older one doesn't fail on them: `cm codereview <a> <b>` creates a review of `a`
 * titled `b`, so asking would try to create one instead.
 */
const FIRST_CM_WITH_REVIEW_SUBSCRIPTIONS: CmVersionNumbers = [11, 0, 16, 10616];

/** Whether this `cm` (its version as `cm version` prints it) can read and change a review's email subscription. */
export function readsReviewSubscriptions(cmVersion: string | undefined): boolean {
  return isCmVersionAtLeast(cmVersion, FIRST_CM_WITH_REVIEW_SUBSCRIPTIONS);
}

/** What the review page's Notifications shows: why the user gets its emails or doesn't, and the one button. */
export interface SubscriptionSection {
  text: string;
  /** Whether the button subscribes (the user gets no emails now) or unsubscribes. */
  subscribes: boolean;
  buttonLabel: 'Subscribe' | 'Unsubscribe';
  buttonTip: string;
}

/** Why a subscribed user gets the emails; a reason `cm` doesn't know says only that they do. */
const WHY_SUBSCRIBED: Partial<Record<ReviewSubscriptionReason, string>> = {
  owner: 'You get emails because you opened this review.',
  reviewer: "You get emails because you're a reviewer.",
  commented: 'You get emails because you commented.',
  mentioned: 'You get emails because you were mentioned.',
  manual: 'You get emails because you subscribed.',
};

/**
 * What Notifications shows, or nothing: not while the subscription isn't read (still reading, or the read failed, as
 * on a server without the command), nor when the repository sends no review emails, where a button would change
 * nothing the user sees. Who never subscribed (`none`) reads as not subscribed, not as getting no emails: a reviewer
 * group they belong to may still send them.
 */
export function subscriptionSection(subscription: ReviewSubscription | undefined): SubscriptionSection | undefined {
  if (!subscription?.emailsEnabled) return undefined;
  if (subscription.subscribed) {
    return {
      text: WHY_SUBSCRIBED[subscription.reason] ?? 'You get emails about this review.',
      subscribes: false,
      buttonLabel: 'Unsubscribe',
      buttonTip: "Stop this review's emails until you take part in it again",
    };
  }
  return {
    text: subscription.reason === 'unsubscribed' ? "You don't get emails about this review." : "You aren't subscribed to this review.",
    subscribes: true,
    buttonLabel: 'Subscribe',
    buttonTip: "Get this review's emails",
  };
}
