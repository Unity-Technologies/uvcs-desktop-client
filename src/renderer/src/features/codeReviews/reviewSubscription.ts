import type { ReviewSubscription, ReviewSubscriptionReason } from '@shared/domain/codeReview';

/**
 * Whether the review's subscription is to be read (`useReviewSubscription`), by how its last read went: no more once a
 * read failed (a server without the command fails it every time), so a write or a Refresh on the page doesn't ask it
 * again for nothing.
 */
export function asksForSubscription(lastRead: 'pending' | 'error' | 'success'): boolean {
  return lastRead !== 'error';
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
      buttonTip: "Stop this review's emails until you comment, are mentioned or are added as a reviewer",
    };
  }
  return {
    text: subscription.reason === 'unsubscribed' ? "You don't get emails about this review." : "You aren't subscribed to this review.",
    subscribes: true,
    buttonLabel: 'Subscribe',
    buttonTip: "Get this review's emails",
  };
}

/**
 * The subscription once the user subscribed (`subscribes`) or unsubscribed, as the server records it (subscribed by
 * hand, or unsubscribed): what Notifications shows from when the write succeeds until the read it causes answers, so
 * the button doesn't go back to what it said for that moment.
 */
export function subscriptionAfter(subscription: ReviewSubscription, subscribes: boolean): ReviewSubscription {
  return { ...subscription, subscribed: subscribes, reason: subscribes ? 'manual' : 'unsubscribed' };
}
