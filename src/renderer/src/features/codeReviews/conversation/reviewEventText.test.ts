import { describe, expect, it } from 'vitest';
import type { ReviewEvent } from '@shared/domain/reviewConversation';
import { isShownEvent, reviewEventRow } from './reviewEventText';

describe('reviewEventRow', () => {
  it('names the reviewers asked, joined as a sentence', () => {
    expect(reviewEventRow({ kind: 'reviewRequested', reviewers: ['ana@acme.com'] })).toEqual({ icon: 'reviewRequested', text: 'requested a review from Ana' });
    expect(reviewEventRow({ kind: 'reviewRequested', reviewers: ['ana@acme.com', 'bob.smith', 'qa-team'] }).text).toBe('requested a review from Ana, Bob Smith and Qa Team');
  });

  it("says a review was requested when an older server didn't name who from", () => {
    expect(reviewEventRow({ kind: 'reviewRequested', reviewers: [] }).text).toBe('requested a review');
  });

  it('says what each status change means, in its icon, with what its reviewer said', () => {
    expect(reviewEventRow({ kind: 'statusChanged', status: 'Reviewed', comment: 'Ship it', guid: 'g' })).toEqual({ icon: 'Reviewed', text: 'marked it Reviewed', comment: 'Ship it' });
    expect(reviewEventRow({ kind: 'statusChanged', status: 'Rework required', comment: '', guid: 'g' })).toEqual({ icon: 'Rework required', text: 'asked for rework' });
    expect(reviewEventRow({ kind: 'statusChanged', status: 'Under review', comment: ' \n', guid: 'g' })).toEqual({ icon: 'Under review', text: 'marked it Under review' });
  });

  it('says who was asked again or removed, and what a title was renamed from and to', () => {
    expect(reviewEventRow({ kind: 'reviewRequestedAgain', reviewer: 'bob.smith' })).toEqual({ icon: 'reviewRequestedAgain', text: 'asked Bob Smith to review it again' });
    expect(reviewEventRow({ kind: 'reviewRequestedAgain', reviewer: '' }).text).toBe('asked for a review again');
    expect(reviewEventRow({ kind: 'reviewerRemoved', reviewer: 'qa-team' })).toEqual({ icon: 'reviewerRemoved', text: 'removed Qa Team from the reviewers' });
    expect(reviewEventRow({ kind: 'titleChanged', from: 'Switch', to: 'Switching keeps changes' })).toEqual({ icon: 'renamed', text: 'renamed it from “Switch” to “Switching keeps changes”' });
  });
});

describe('isShownEvent', () => {
  const at = { id: 1, author: 'ana', date: '' };

  it("leaves out what this version doesn't read, so the server's own text never shows", () => {
    expect(isShownEvent({ ...at, kind: 'other', text: '[mergerequest-status-draft-to-open]' } as ReviewEvent)).toBe(false);
    expect(isShownEvent({ ...at, kind: 'titleChanged', from: 'a', to: 'b' })).toBe(true);
  });
});
