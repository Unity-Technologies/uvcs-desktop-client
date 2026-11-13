import { describe, expect, it } from 'vitest';
import type { ReviewSubscription, ReviewSubscriptionReason } from '@shared/domain/codeReview';
import { asksForSubscription, readsReviewSubscriptions, subscriptionAfter, subscriptionSection } from './reviewSubscription';

const subscribed = (reason: ReviewSubscriptionReason): ReviewSubscription => ({ subscribed: true, reason, emailsEnabled: true });
const notSubscribed = (reason: ReviewSubscriptionReason): ReviewSubscription => ({ subscribed: false, reason, emailsEnabled: true });

describe('readsReviewSubscriptions', () => {
  it('asks a cm that has the commands', () => {
    expect(readsReviewSubscriptions('11.0.16.10616')).toBe(true);
    expect(readsReviewSubscriptions('11.0.17.1')).toBe(true);
  });

  it('never asks an older cm, which would take the command for a review to create, nor one it cannot read', () => {
    expect(readsReviewSubscriptions('11.0.16.10615')).toBe(false);
    expect(readsReviewSubscriptions(undefined)).toBe(false);
  });
});

describe('asksForSubscription', () => {
  it('asks a cm that has the command, until it answers and every time it is to be read again', () => {
    expect(asksForSubscription('11.0.16.10616', 'pending')).toBe(true);
    expect(asksForSubscription('11.0.16.10616', 'success')).toBe(true);
  });

  // A server without the command fails it every time: a write or a Refresh would ask it again for nothing.
  it('stops asking once a read failed', () => {
    expect(asksForSubscription('11.0.16.10616', 'error')).toBe(false);
  });

  it('never asks a cm without the command', () => {
    expect(asksForSubscription('11.0.16.10615', 'pending')).toBe(false);
  });
});

describe('subscriptionSection', () => {
  it.each([
    ['owner', 'You get emails because you opened this review.'],
    ['reviewer', "You get emails because you're a reviewer."],
    ['commented', 'You get emails because you commented.'],
    ['mentioned', 'You get emails because you were mentioned.'],
    ['manual', 'You get emails because you subscribed.'],
    ['other', 'You get emails about this review.'],
  ] as const)('says why a user subscribed as %j gets the emails, and offers to unsubscribe', (reason, text) => {
    expect(subscriptionSection(subscribed(reason))).toEqual({
      text,
      subscribes: false,
      buttonLabel: 'Unsubscribe',
      buttonTip: "Stop this review's emails until you comment, are mentioned or are added as a reviewer",
    });
  });

  it('says a user who unsubscribed gets no emails, and offers to subscribe', () => {
    expect(subscriptionSection(notSubscribed('unsubscribed'))).toEqual({
      text: "You don't get emails about this review.",
      subscribes: true,
      buttonLabel: 'Subscribe',
      buttonTip: "Get this review's emails",
    });
  });

  // A reviewer group they belong to may still send them its emails: "no emails" would be wrong.
  it.each(['none', 'other'] as const)('says a user with no subscription of their own (%j) is not subscribed', (reason) => {
    expect(subscriptionSection(notSubscribed(reason))).toMatchObject({ text: "You aren't subscribed to this review.", subscribes: true, buttonLabel: 'Subscribe' });
  });

  it('goes by whether the user is subscribed, whatever the reason says', () => {
    expect(subscriptionSection({ subscribed: false, reason: 'reviewer', emailsEnabled: true })?.subscribes).toBe(true);
  });

  it('shows nothing when the repository sends no review emails', () => {
    expect(subscriptionSection({ subscribed: true, reason: 'owner', emailsEnabled: false })).toBeUndefined();
    expect(subscriptionSection({ subscribed: false, reason: 'unsubscribed', emailsEnabled: false })).toBeUndefined();
  });

  it('shows nothing while the subscription is being read, or when it could not be', () => {
    expect(subscriptionSection(undefined)).toBeUndefined();
  });
});

describe('subscriptionAfter', () => {
  it('reads as subscribed by hand once the user subscribes', () => {
    expect(subscriptionAfter(notSubscribed('unsubscribed'), true)).toEqual({ subscribed: true, reason: 'manual', emailsEnabled: true });
  });

  it('reads as unsubscribed once the user unsubscribes, whatever subscribed them', () => {
    expect(subscriptionAfter(subscribed('reviewer'), false)).toEqual({ subscribed: false, reason: 'unsubscribed', emailsEnabled: true });
  });
});
