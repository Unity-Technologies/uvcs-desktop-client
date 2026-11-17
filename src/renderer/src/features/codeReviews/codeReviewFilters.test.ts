import '../../testing/fakeWindow';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { describe, expect, it } from 'vitest';
import type { CodeReview } from '@shared/domain/codeReview';
import { compactFilter } from '../../lib/compactFilter';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { EVERYONE, MINE } from '../../lib/peopleFilter';
import { isFiltering } from '../../lib/viewFilters';
import { codeReviewsListQuery, codeReviewsQuery, isNarrowed, matchesKind, matchesOpenedByMe, matchesReviewers, matchesState, showsStateChip, stateUnderKind, matchesWaiting, openedByMeCount, openedChipLabel, reviewFilterTexts, waitingChipLabel } from './codeReviewFilters';
import { CLEARED_CODE_REVIEW_FILTERS, restoredReviewersFilter, useCodeReviewsViewStore } from './codeReviewsViewStore';

const today = new Date(2026, 8, 25);

const ASKED = { since: 'last3Months', people: EVERYONE, status: 'any', mergeRequestState: 'active', reviewers: EVERYONE } as const;

describe('what Merge requests asks the server for', () => {
  it('asks by date alone with the defaults (the last three months), whatever the status or assignment left out', () => {
    expect(compactFilter(codeReviewsQuery(ASKED, today))).toEqual({ sinceDate: '2026-06-26' });
  });

  it("asks the server for the user's reviews when I'm a reviewer is alone, and for every review when others are picked, kept locally", () => {
    expect(codeReviewsQuery({ ...ASKED, reviewers: MINE }, today).reviewerIsMe).toBe(true);
    expect(compactFilter(codeReviewsQuery({ ...ASKED, reviewers: { mine: true, others: ['zoe'] } }, today))).toEqual(compactFilter(codeReviewsQuery(ASKED, today)));
    expect(compactFilter(codeReviewsQuery({ ...ASKED, reviewers: { mine: false, others: ['zoe'] } }, today))).toEqual(compactFilter(codeReviewsQuery(ASKED, today)));
  });

  it('asks the same under Waiting for me and Opened by me: they keep the reviews read, so their counts are what pressing them shows', () => {
    const asked = compactFilter(codeReviewsQuery(ASKED, today));
    // The view's filters, chips and all, as the view store holds them: the query must ignore the chips. That the view
    // hands this function the store's filters, rather than widening the read itself, is the view's wiring (a `.tsx`).
    for (const chips of [{ waitingForMe: true, openedByMe: false }, { waitingForMe: false, openedByMe: true }, { waitingForMe: true, openedByMe: true }]) {
      const filters = { ...ASKED, ...chips };
      expect(compactFilter(codeReviewsQuery(filters, today))).toEqual(asked);
    }
  });

  it('puts who created them, the assignment and the status into the query', () => {
    expect(codeReviewsQuery({ since: 'anyTime', people: { mine: true, others: ['zoe', 'ana'] }, status: 'Reviewed', mergeRequestState: 'active', reviewers: MINE }, today)).toEqual({
      owners: ['me', 'ana', 'zoe'],
      reviewerIsMe: true,
      status: 'Reviewed',
      sinceDate: undefined,
    });
  });
});

describe('the State chip', () => {
  const plain = codeReviewSummary({ id: 1 });
  const of = (state: 'Draft' | 'Open' | 'Merged' | 'Closed', id: number) => codeReviewSummary({ id, mergeRequest: { state, destination: '/main' } });
  const all = [plain, of('Draft', 2), of('Open', 3), of('Merged', 4), of('Closed', 5)];
  const kept = (state: Parameters<typeof matchesState>[1]) => all.filter((review) => matchesState(review, state)).map((review) => review.id);

  it("reads the list under the Kind chip's state: with Code reviews alone, the State chip's left over asks for no state", () => {
    const merged = { ...ASKED, kind: 'codeReviews', mergeRequestState: 'merged' } as const;
    expect(compactFilter(codeReviewsListQuery(merged, today))).toEqual(compactFilter(codeReviewsQuery({ ...ASKED, mergeRequestState: 'all' }, today)));
    expect(codeReviewsListQuery({ ...merged, kind: 'mergeRequests' }, today).mergeRequestState).toBe('Merged');
    expect(codeReviewsListQuery({ ...merged, kind: 'any' }, today).mergeRequestState).toBe('Merged');
  });

  it('asks the server for Merged and Closed, and for no state under Active and All, which share one query', () => {
    expect(codeReviewsQuery({ ...ASKED, mergeRequestState: 'merged' }, today).mergeRequestState).toBe('Merged');
    expect(codeReviewsQuery({ ...ASKED, mergeRequestState: 'closed' }, today).mergeRequestState).toBe('Closed');
    expect(compactFilter(codeReviewsQuery({ ...ASKED, mergeRequestState: 'all' }, today))).toEqual(compactFilter(codeReviewsQuery(ASKED, today)));
  });

  it('keeps the code reviews and the merge requests still to merge under Active', () => {
    expect(kept('active')).toEqual([1, 2, 3]);
  });

  it('keeps one state under Merged and Closed, and everything under All', () => {
    expect([kept('merged'), kept('closed'), kept('all')]).toEqual([[4], [5], [1, 2, 3, 4, 5]]);
  });
});

describe('the code reviews filter', () => {
  const review: CodeReview = {
    ...codeReviewSummary({ id: 31, title: 'Login screen', owner: 'ana.diaz', reviewers: [{ name: 'bob.smith', status: 'Reviewed' }, { name: 'qa-team', status: 'Under review' }] }),
    target: { kind: 'branch', branch: '/main/login' },
  };
  const matches = (search: string, shown = review) => matchesWordFilter(reviewFilterTexts(shown), search);

  it('looks through the number, title, target, author and every reviewer', () => {
    expect(['31', 'login screen', '/main/login', 'Ana Diaz', 'Bob Smith', 'bob.smith', 'qa-team'].every((search) => matches(search))).toBe(true);
    expect(matches('checkout')).toBe(false);
  });

  it('reads a review nobody was asked to review', () => {
    expect(matches('login', { ...review, reviewers: [] })).toBe(true);
  });

  it("looks through a merge request's destination and state too", () => {
    const request: CodeReview = { ...review, mergeRequest: { state: 'Draft', destination: '/main/release' } };
    expect([matches('release', request), matches('draft', request), matches('draft')]).toEqual([true, true, false]);
  });
});

describe('the reviewers filter', () => {
  const byZoe = codeReviewSummary({ id: 1, owner: 'dan', reviewers: [{ name: 'zoe', status: 'Under review' }] });
  const byAna = codeReviewSummary({ id: 2, owner: 'dan', reviewers: [{ name: 'ana', status: 'Reviewed' }, { name: 'bob', status: 'Under review' }] });
  const nobody = codeReviewSummary({ id: 3, owner: 'dan', reviewers: [] });
  const kept = (pick: Parameters<typeof matchesReviewers>[1]) => [byZoe, byAna, nobody].filter((review) => matchesReviewers(review, pick, 'ana')).map((review) => review.id);

  it('keeps every review with nobody picked', () => {
    expect(kept(EVERYONE)).toEqual([1, 2, 3]);
  });

  it("keeps the reviews any picked reviewer is asked on, the user's under I'm a reviewer", () => {
    expect(kept({ mine: false, others: ['zoe'] })).toEqual([1]);
    expect(kept({ mine: true, others: ['zoe'] })).toEqual([1, 2]);
    expect(kept(MINE)).toEqual([2]);
  });
});

describe('Waiting for me', () => {
  const asked = codeReviewSummary({ id: 1, owner: 'zoe', reviewers: [{ name: 'ana', status: 'Under review' }] });
  const reviewed = codeReviewSummary({ id: 2, owner: 'zoe', reviewers: [{ name: 'ana', status: 'Reviewed' }] });
  const ownInRework = codeReviewSummary({ id: 3, owner: 'ana', status: 'Rework required', openIssueCount: 2 });

  it('keeps the reviews waiting for the user, their own ones in rework too', () => {
    expect([asked, reviewed, ownInRework].filter((review) => matchesWaiting(review, true, 'ana')).map((review) => review.id)).toEqual([1, 3]);
  });

  it('keeps every row while off, and nothing waiting while the user is still unknown', () => {
    expect([asked, reviewed, ownInRework].every((review) => matchesWaiting(review, false, 'ana'))).toBe(true);
    expect(matchesWaiting(asked, true, undefined)).toBe(false);
  });

  it('counts the reviews waiting on its chip', () => {
    expect([waitingChipLabel(0), waitingChipLabel(2)]).toEqual(['Waiting for me', 'Waiting for me · 2']);
  });
});

describe('Opened by me', () => {
  const underReview = codeReviewSummary({ id: 1, owner: 'ana', status: 'Under review' });
  const inRework = codeReviewSummary({ id: 2, owner: 'ana', status: 'Rework required' });
  const done = codeReviewSummary({ id: 3, owner: 'ana', status: 'Reviewed' });
  const zoes = codeReviewSummary({ id: 4, owner: 'zoe', status: 'Under review' });
  const all = [underReview, inRework, done, zoes];

  it("keeps the user's reviews not reviewed yet, as the official client's Opened by me", () => {
    expect(all.filter((review) => matchesOpenedByMe(review, true, 'ana')).map((review) => review.id)).toEqual([1, 2]);
    expect(all.every((review) => matchesOpenedByMe(review, false, 'ana'))).toBe(true);
    expect(matchesOpenedByMe(underReview, true, undefined)).toBe(false);
  });

  it("keeps the user's merge requests still to merge, reviewed ones too, and never a merged or closed one", () => {
    const request = (id: number, state: 'Draft' | 'Open' | 'Merged' | 'Closed', status: 'Reviewed' | 'Under review') => codeReviewSummary({ id, owner: 'ana', status, mergeRequest: { state, destination: '/main' } });
    const requests = [request(5, 'Open', 'Reviewed'), request(6, 'Draft', 'Under review'), request(7, 'Merged', 'Under review'), request(8, 'Closed', 'Under review')];
    expect(requests.filter((review) => matchesOpenedByMe(review, true, 'ana')).map((review) => review.id)).toEqual([5, 6]);
  });

  it('counts them on its chip', () => {
    expect(openedByMeCount(all, 'ana')).toBe(2);
    expect([openedChipLabel(0), openedChipLabel(2)]).toEqual(['Opened by me', 'Opened by me · 2']);
  });
});

describe('the reviewer filter remembered by an older version', () => {
  it("reads the I'm a reviewer chip as I'm a reviewer among the reviewers", () => {
    expect(restoredReviewersFilter({ reviewerIsMe: true })).toEqual({ reviewers: MINE });
    expect(restoredReviewersFilter({ reviewerIsMe: false })).toEqual({});
  });
});

describe("Merge requests' Clear filters", () => {
  it('turns the reviewers, Waiting for me, the status and the state back too, keeping the time range', () => {
    const store = useCodeReviewsViewStore;
    store.getState().update({ text: '', people: EVERYONE, status: 'Reviewed', reviewers: EVERYONE, waitingForMe: false, since: 'lastYear' });
    expect(isFiltering(store.getState(), CLEARED_CODE_REVIEW_FILTERS)).toBe(true);

    store.getState().update({ people: MINE, mergeRequestState: 'merged', reviewers: { mine: false, others: ['zoe'] }, waitingForMe: true, openedByMe: true });
    store.getState().clear();

    const { text, people, status, mergeRequestState, reviewers, waitingForMe, openedByMe, since } = store.getState();
    expect({ text, people, status, mergeRequestState, reviewers, waitingForMe, openedByMe, since }).toEqual({ text: '', people: EVERYONE, status: 'any', mergeRequestState: 'active', reviewers: EVERYONE, waitingForMe: false, openedByMe: false, since: 'lastYear' });
    expect(isFiltering(store.getState(), CLEARED_CODE_REVIEW_FILTERS)).toBe(false);
  });
});

describe('whether the list is narrowed', () => {
  it('is when the State chip at rest hides every review read, so it says none match instead of none yet', () => {
    expect(isNarrowed(false, 3, 0)).toBe(true);
  });

  it('is while a filter is on, and is not when every review read shows', () => {
    expect([isNarrowed(true, 3, 3), isNarrowed(false, 3, 3), isNarrowed(false, 0, 0)]).toEqual([true, false, false]);
  });
});

describe('the Kind chip', () => {
  const request = { mergeRequest: { state: 'Open' as const, destination: '/main' } };
  const review = {};

  it('keeps both kinds by default, and one kind alone when picked, with no read of its own', () => {
    expect([request, review].map((each) => matchesKind(each, 'any'))).toEqual([true, true]);
    expect([request, review].map((each) => matchesKind(each, 'mergeRequests'))).toEqual([true, false]);
    expect([request, review].map((each) => matchesKind(each, 'codeReviews'))).toEqual([false, true]);
  });

  it("drops the State chip and its state with code reviews alone, which have none, and keeps it otherwise", () => {
    expect(stateUnderKind('codeReviews', 'merged')).toBe('all');
    expect(stateUnderKind('mergeRequests', 'merged')).toBe('merged');
    expect(stateUnderKind('any', 'active')).toBe('active');
    expect([showsStateChip('any'), showsStateChip('mergeRequests'), showsStateChip('codeReviews')]).toEqual([true, true, false]);
  });
});
