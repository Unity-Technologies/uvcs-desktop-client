import { describe, expect, it } from 'vitest';
import { reviewEventText } from './reviewEventText';

describe('reviewEventText', () => {
  it('names the reviewers asked, joined as a sentence', () => {
    expect(reviewEventText({ kind: 'reviewRequested', reviewers: ['ana@acme.com'] })).toBe('requested a review from Ana');
    expect(reviewEventText({ kind: 'reviewRequested', reviewers: ['ana@acme.com', 'bob.smith', 'qa-team'] })).toBe('requested a review from Ana, Bob Smith and Qa Team');
  });

  it("says a review was requested when an older server didn't name who from", () => {
    expect(reviewEventText({ kind: 'reviewRequested', reviewers: [] })).toBe('requested a review');
  });

  it('says what each status change means', () => {
    const status = (to: 'Under review' | 'Reviewed' | 'Rework required') => reviewEventText({ kind: 'statusChanged', status: to, comment: '', guid: 'g' });

    expect([status('Reviewed'), status('Rework required'), status('Under review')]).toEqual(['marked it Reviewed', 'asked for rework', 'marked it Under review']);
  });

  it('says who was asked again or removed, and what a title was renamed from and to', () => {
    expect(reviewEventText({ kind: 'reviewRequestedAgain', reviewer: 'bob.smith' })).toBe('asked Bob Smith to review it again');
    expect(reviewEventText({ kind: 'reviewRequestedAgain', reviewer: '' })).toBe('asked for a review again');
    expect(reviewEventText({ kind: 'reviewerRemoved', reviewer: 'qa-team' })).toBe('removed Qa Team from the reviewers');
    expect(reviewEventText({ kind: 'titleChanged', from: 'Switch', to: 'Switching keeps changes' })).toBe('renamed it from “Switch” to “Switching keeps changes”');
  });

  it("shows what it doesn't read yet as written", () => {
    expect(reviewEventText({ kind: 'other', text: '[mergerequest-status-draft-to-open]' })).toBe('[mergerequest-status-draft-to-open]');
  });
});
