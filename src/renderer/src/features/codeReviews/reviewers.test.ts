import { Eye, Flag, ThumbsUp } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import type { CodeReviewer } from '@shared/domain/codeReview';
import { canReRequest, changesOwnStatus, isAuthor, isReviewer, offeredReviewers, ownStatus, reviewerBadge, reviewerChanges, reviewerNames, reviewersText, reviewerText, shownReviewers, stackedReviewers } from './reviewers';

const ANA: CodeReviewer = { name: 'ana@acme.com', status: 'Reviewed' };
const BOB: CodeReviewer = { name: 'bob@acme.com', status: 'Under review' };
const QA: CodeReviewer = { name: 'qa-team', status: 'Rework required' };
const EVA: CodeReviewer = { name: 'eva@acme.com', status: 'Under review' };

describe('shownReviewers', () => {
  it('shows the first few and leaves the rest to "+N", naming none beside them', () => {
    expect(shownReviewers([ANA, BOB, QA, EVA], 3)).toEqual({ shown: [ANA, BOB, QA], rest: [EVA] });
    expect(shownReviewers([ANA, BOB], 3)).toEqual({ shown: [ANA, BOB], rest: [] });
  });

  it('names a sole reviewer beside their avatar, and shows nobody for a review nobody was asked to', () => {
    expect(shownReviewers([ANA], 3)).toEqual({ shown: [ANA], rest: [], soleName: 'Ana' });
    expect(shownReviewers([], 3)).toEqual({ shown: [], rest: [] });
  });
});

describe('stackedReviewers', () => {
  it('stacks the first three, each named with their status and badged with its icon, and names the rest in "+N"', () => {
    expect(stackedReviewers([ANA, BOB, QA, EVA])).toEqual({
      avatars: [
        { user: 'ana@acme.com', tip: 'Ana: Reviewed', badge: reviewerBadge('Reviewed') },
        { user: 'bob@acme.com', tip: 'Bob: Under review', badge: reviewerBadge('Under review') },
        { user: 'qa-team', tip: 'Qa Team: Rework required', badge: reviewerBadge('Rework required') },
      ],
      more: { count: 1, tip: 'Eva: Under review' },
    });
  });

  it('has no "+N" for three or fewer', () => {
    expect(stackedReviewers([ANA, BOB, QA]).more).toBeUndefined();
  });

  it("names a sole reviewer beside their avatar", () => {
    expect(stackedReviewers([ANA])).toEqual({ avatars: [{ user: 'ana@acme.com', tip: 'Ana: Reviewed', badge: reviewerBadge('Reviewed') }], soleName: 'Ana' });
  });
});

describe('reviewerText', () => {
  it("names a reviewer with their status, for their avatar's own tooltip", () => {
    expect(reviewerText(QA)).toBe('Qa Team: Rework required');
  });
});

describe('reviewerBadge', () => {
  it("badges every reviewer with their status's icon, in its color: an eye, a flag, a thumbs-up", () => {
    expect(reviewerBadge('Under review')).toEqual({ icon: Eye, color: 'var(--status-moved)' });
    expect(reviewerBadge('Rework required')).toEqual({ icon: Flag, color: 'var(--status-changed)' });
    expect(reviewerBadge('Reviewed')).toEqual({ icon: ThumbsUp, color: 'var(--status-added)' });
  });
});

describe('reviewersText', () => {
  it('names each reviewer with their status', () => {
    expect(reviewersText([ANA, QA])).toBe('Ana: Reviewed, Qa Team: Rework required');
  });

  it('says when nobody was asked', () => {
    expect(reviewersText([])).toBe('Nobody');
  });
});

describe('isReviewer', () => {
  it('finds the user among the reviewers, whatever the case cm wrote either in', () => {
    expect(isReviewer({ reviewers: [ANA, BOB] }, 'Bob@Acme.com')).toBe(true);
    expect(isReviewer({ reviewers: [ANA, BOB] }, 'eva@acme.com')).toBe(false);
  });

  it('answers no while the user is unknown', () => {
    expect(isReviewer({ reviewers: [ANA] }, undefined)).toBe(false);
  });
});

describe('ownStatus', () => {
  it('is the status the user gave as a reviewer', () => {
    expect(ownStatus({ reviewers: [ANA, BOB] }, 'ANA@acme.com')).toBe('Reviewed');
  });

  it("is none for a user who isn't a reviewer, or isn't known yet", () => {
    expect(ownStatus({ reviewers: [ANA] }, 'eva@acme.com')).toBeUndefined();
    expect(ownStatus({ reviewers: [ANA] }, undefined)).toBeUndefined();
  });
});

describe('changesOwnStatus', () => {
  it("changes nothing when the user picks the status they gave already", () => {
    expect(changesOwnStatus({ reviewers: [ANA] }, 'ana@acme.com', 'Reviewed')).toBe(false);
    expect(changesOwnStatus({ reviewers: [ANA] }, 'ana@acme.com', 'Rework required')).toBe(true);
  });

  it("changes something for a user who isn't a reviewer, or isn't known yet, whatever they pick", () => {
    expect(changesOwnStatus({ reviewers: [ANA] }, 'eva@acme.com', 'Under review')).toBe(true);
    expect(changesOwnStatus({ reviewers: [ANA] }, undefined, 'Under review')).toBe(true);
  });
});

describe('reviewerNames', () => {
  it('splits the names typed at commas, once each, ignoring blanks', () => {
    expect(reviewerNames(' ana, bob,,ana , ')).toEqual(['ana', 'bob']);
    expect(reviewerNames('')).toEqual([]);
  });
});

describe('reviewerChanges', () => {
  it('adds who was picked and removes who was unpicked, matching names whatever their case', () => {
    expect(reviewerChanges([ANA, BOB], ['ANA@acme.com', 'eva@acme.com'])).toEqual({ add: ['eva@acme.com'], remove: ['bob@acme.com'] });
  });

  it('changes nothing when the picked are the reviewers', () => {
    expect(reviewerChanges([ANA, BOB], ['bob@acme.com', 'ana@acme.com'])).toEqual({ add: [], remove: [] });
  });
});

describe('offeredReviewers', () => {
  it('offers the reviewers first, a group the server does not list among them, then everyone else by name', () => {
    expect(offeredReviewers(['zoe@acme.com', 'ana@acme.com', 'carl@acme.com'], [ANA, QA])).toEqual(['ana@acme.com', 'qa-team', 'carl@acme.com', 'zoe@acme.com']);
  });
});

describe('canReRequest and isAuthor', () => {
  it('asks again only a reviewer who gave a status', () => {
    expect([ANA, BOB, QA].map((reviewer) => canReRequest(reviewer, 'eva@acme.com'))).toEqual([true, false, true]);
  });

  it('never offers the user to ask themselves again', () => {
    expect(canReRequest(ANA, 'Ana@acme.com')).toBe(false);
  });

  it('knows the author among the reviewers, whatever the case', () => {
    expect(isAuthor({ owner: 'Ana@acme.com' }, ANA.name)).toBe(true);
    expect(isAuthor({ owner: 'Ana@acme.com' }, BOB.name)).toBe(false);
  });
});
