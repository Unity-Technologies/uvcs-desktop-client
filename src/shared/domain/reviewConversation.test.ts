import { describe, expect, it } from 'vitest';
import { mergedChangesetOf, type ReviewEventChange } from './reviewConversation';

const opened: ReviewEventChange = { kind: 'mergeRequestState', from: 'Draft', to: 'Open' };
const mergedIn = (changesetId?: number): ReviewEventChange => ({ kind: 'mergeRequestState', from: 'Open', to: 'Merged', ...(changesetId !== undefined && { changesetId }) });
const reopened: ReviewEventChange = { kind: 'mergeRequestState', from: 'Merged', to: 'Open' };
const renamed: ReviewEventChange = { kind: 'titleChanged', from: 'A', to: 'B' };

describe('mergedChangesetOf', () => {
  it('takes the changeset of the move to Merged, whatever came after that moved nothing', () => {
    expect(mergedChangesetOf([opened, mergedIn(6), renamed])).toBe(6);
  });

  it('takes the newest merge when the request was merged again', () => {
    expect(mergedChangesetOf([mergedIn(6), reopened, mergedIn(9)])).toBe(9);
  });

  it('has none once a later move took the request out of Merged', () => {
    expect(mergedChangesetOf([mergedIn(6), reopened])).toBeUndefined();
  });

  it('has none when the move to Merged named no changeset, or nothing was merged', () => {
    expect(mergedChangesetOf([mergedIn()])).toBeUndefined();
    expect(mergedChangesetOf([opened, renamed])).toBeUndefined();
    expect(mergedChangesetOf([])).toBeUndefined();
  });
});
