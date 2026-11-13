import { REVIEW_SUBSCRIPTION_REASONS, type ReviewSubscription, type ReviewSubscriptionReason } from '@shared/domain/codeReview';
import type { CmPlace } from './cmPlace';

/**
 * `cm codereview subscription`: whether the signed-in user gets the review's emails, why, and whether its repository
 * sends any. Its three values are fixed English words in any client language, none holding a space, so one line of
 * them separated by spaces reads back without ambiguity (`parseReviewSubscription`).
 */
export function reviewSubscriptionArgs(reviewId: number, at: CmPlace): string[] {
  return ['codereview', 'subscription', String(reviewId), '--format={subscribed} {reason} {emails}', ...at.repositoryOption];
}

/** `cm codereview subscribe` or `unsubscribe`: the signed-in user only; `cm` can't subscribe anyone else. */
export function setSubscriptionArgs(reviewId: number, subscribed: boolean, at: CmPlace): string[] {
  return ['codereview', subscribed ? 'subscribe' : 'unsubscribe', String(reviewId), ...at.repositoryOption];
}

/**
 * Reads what `reviewSubscriptionArgs` prints (`yes reviewer enabled`). A reason this version doesn't know reads as
 * `other`; an answer that isn't three such words throws, so nothing is shown from it rather than a guess.
 */
export function parseReviewSubscription(output: string): ReviewSubscription {
  const words = output.trim().split(/\s+/);
  const [subscribed, reason, emails] = words;
  if (words.length !== 3 || !isOneOf(subscribed, ['yes', 'no']) || !isOneOf(emails, ['enabled', 'disabled'])) {
    throw new Error(`Unexpected answer from cm codereview subscription: ${output.trim()}`);
  }
  return { subscribed: subscribed === 'yes', reason: reasonOf(reason!), emailsEnabled: emails === 'enabled' };
}

function reasonOf(value: string): ReviewSubscriptionReason {
  return REVIEW_SUBSCRIPTION_REASONS.find((reason) => reason === value) ?? 'other';
}

function isOneOf(value: string | undefined, words: readonly string[]): boolean {
  return value !== undefined && words.includes(value);
}
