import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { REVIEW_SUBSCRIPTION_REASONS } from '@shared/domain/codeReview';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { cmPlace } from './cmPlace';
import { parseReviewSubscription, reviewSubscriptionArgs, setSubscriptionArgs } from './reviewSubscription';

const IN_WORKSPACE = cmPlace(workspacePlace(join(tmpdir(), 'wkspaces', 'game')));
const ON_REPOSITORY = cmPlace(repositoryPlace('game@local'));

describe('reviewSubscriptionArgs', () => {
  it('asks for the three values alone, by name', () => {
    expect(reviewSubscriptionArgs(43, IN_WORKSPACE)).toEqual(['codereview', 'subscription', '43', '--format={subscribed} {reason} {emails}']);
  });

  it('names the repository outside a workspace', () => {
    expect(reviewSubscriptionArgs(43, ON_REPOSITORY)).toEqual(['codereview', 'subscription', '43', '--format={subscribed} {reason} {emails}', '--repository=game@local']);
  });
});

describe('setSubscriptionArgs', () => {
  it('subscribes and unsubscribes the signed-in user', () => {
    expect(setSubscriptionArgs(43, true, IN_WORKSPACE)).toEqual(['codereview', 'subscribe', '43']);
    expect(setSubscriptionArgs(43, false, ON_REPOSITORY)).toEqual(['codereview', 'unsubscribe', '43', '--repository=game@local']);
  });
});

describe('parseReviewSubscription', () => {
  it('reads whether the user is subscribed, why, and whether the repository sends emails', () => {
    expect(parseReviewSubscription('yes reviewer enabled\n')).toEqual({ subscribed: true, reason: 'reviewer', emailsEnabled: true });
    expect(parseReviewSubscription('no unsubscribed disabled')).toEqual({ subscribed: false, reason: 'unsubscribed', emailsEnabled: false });
  });

  it.each(REVIEW_SUBSCRIPTION_REASONS)('reads the reason %j', (reason) => {
    expect(parseReviewSubscription(`no ${reason} enabled`).reason).toBe(reason);
  });

  it('reads a reason a newer cm adds as other', () => {
    expect(parseReviewSubscription('yes watcher enabled').reason).toBe('other');
  });

  it('reads Windows line ends', () => {
    expect(parseReviewSubscription('yes owner enabled\r\n')).toEqual({ subscribed: true, reason: 'owner', emailsEnabled: true });
  });

  it.each(['', 'yes owner', 'yes owner enabled extra', 'maybe owner enabled', 'yes owner on', "The specified code review '9' could not be found."])(
    'refuses an answer it cannot read: %j',
    (output) => {
      expect(() => parseReviewSubscription(output)).toThrow('Unexpected answer from cm codereview subscription');
    },
  );
});
