import { describe, expect, it } from 'vitest';
import type { CodeReviewer } from '@shared/domain/codeReview';
import { isPicked, pickChanges, pickerEmptyText, startPick, togglePicked } from './reviewerPick';

const ANA: CodeReviewer = { name: 'ana@acme.com', status: 'Reviewed' };
const BOB: CodeReviewer = { name: 'bob@acme.com', status: 'Under review' };

describe('the reviewer pick', () => {
  it('starts with the reviewers checked, changing nothing', () => {
    const pick = startPick([ANA, BOB]);
    expect(isPicked(pick, 'ANA@acme.com')).toBe(true);
    expect(pickChanges(pick)).toEqual({ add: [], remove: [] });
  });

  it('adds who was checked and removes who was unchecked, whatever the case', () => {
    const pick = togglePicked(togglePicked(startPick([ANA, BOB]), 'Bob@acme.com'), 'eva@acme.com');
    expect(pickChanges(pick)).toEqual({ add: ['eva@acme.com'], remove: ['bob@acme.com'] });
  });

  it('changes nothing for a user checked then unchecked', () => {
    expect(pickChanges(togglePicked(togglePicked(startPick([ANA]), 'eva@acme.com'), 'eva@acme.com'))).toEqual({ add: [], remove: [] });
  });

  it("never removes someone another person added while it was open: it goes by the reviewers it opened with", () => {
    const pick = togglePicked(startPick([ANA]), 'eva@acme.com');
    // Carl joined meanwhile; he was never in the pick, so nothing removes him.
    expect(pickChanges(pick)).toEqual({ add: ['eva@acme.com'], remove: [] });
  });
});

describe('pickerEmptyText', () => {
  it('says the users are being read, then that nobody matches', () => {
    expect(pickerEmptyText({ listFailed: false, loading: true, search: '' })).toBe('Reading the users…');
    expect(pickerEmptyText({ listFailed: false, loading: false, search: ' zed ' })).toBe('No one matches “zed”');
  });

  it('asks for a name where the server can not list everyone', () => {
    expect(pickerEmptyText({ listFailed: true, loading: false, search: '' })).toBe('Type a name.');
    expect(pickerEmptyText({ listFailed: true, loading: false, search: 'zed' })).toBe('No one matches “zed”');
  });
});
