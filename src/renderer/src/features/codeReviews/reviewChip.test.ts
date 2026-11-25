import { describe, expect, it } from 'vitest';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import type { CodeReviewStatus, MergeRequestState } from '@shared/domain/codeReview';
import { codeReviewLine, reviewChipOf } from './reviewChip';

const plain = (status: CodeReviewStatus) => codeReviewSummary({ id: 12, title: 'Add login', status });
const request = (state: MergeRequestState, status: CodeReviewStatus) => ({ ...plain(status), reviewers: [{ name: 'ana', status }], mergeRequest: { state, destination: '/main' } });

describe("a branch's review chip", () => {
  it("shows a code review's status, its name only where there's room", () => {
    expect(reviewChipOf(plain('Under review'), false)).toMatchObject({ status: 'Under review', statusText: true });
    expect(reviewChipOf(plain('Reviewed'), true)).toMatchObject({ status: 'Reviewed', statusText: false });
    expect(reviewChipOf(plain('Reviewed'), false).state).toBeUndefined();
  });

  it("names a merge request's state, then whether it can merge: ready once reviewed, blocked once changes are required", () => {
    expect(reviewChipOf(request('Open', 'Reviewed'), false)).toMatchObject({ state: 'Open', stateText: true, verdict: 'ready' });
    expect(reviewChipOf(request('Open', 'Rework required'), false)).toMatchObject({ state: 'Open', verdict: 'blocked' });
  });

  it('shows an Open request still under review as waiting', () => {
    expect(reviewChipOf(request('Open', 'Under review'), false).verdict).toBe('waiting');
  });

  it.each(['Draft', 'Merged', 'Closed'] as const)('shows no verdict on a %s request: it is not up for merging', (state) => {
    expect(reviewChipOf(request(state, 'Reviewed'), false)).toMatchObject({ state, stateText: true, verdict: undefined });
  });

  it("keeps a merge request's glyphs and drops the state's name when narrow", () => {
    expect(reviewChipOf(request('Open', 'Reviewed'), true)).toMatchObject({ state: 'Open', stateText: false, verdict: 'ready' });
    expect(reviewChipOf(request('Merged', 'Reviewed'), true)).toMatchObject({ state: 'Merged', stateText: false, verdict: undefined });
  });

  it("shows a merge request's summary card on hover, and never names its number", () => {
    const chip = reviewChipOf(request('Open', 'Rework required'), false);
    expect(chip.hover).toEqual({ kind: 'summary', request: request('Open', 'Rework required') });
    expect(chip.label).toBe('Open merge request: Add login');
  });

  it("names a code review's number and status in its tooltip and for a screen reader", () => {
    expect(reviewChipOf(plain('Reviewed'), false)).toMatchObject({
      hover: { kind: 'tip', tip: 'Add login', tipSub: 'Code review 12 · Reviewed · click to open' },
      label: 'Open code review 12: Add login',
    });
    expect(reviewChipOf(plain('Reviewed'), true).hover).toMatchObject({ tip: 'Reviewed: Add login' });
  });
});

describe("a branch's review chip in a column (the Branches view's)", () => {
  it.each([
    ['an open request waiting', request('Open', 'Under review')],
    ['a merged request, which has no verdict', request('Merged', 'Reviewed')],
    ['a code review', plain('Reviewed')],
  ])('keeps the verdict\'s room for %s, so every chip in the column ends on one line', (_, review) => {
    expect(reviewChipOf(review, false, { inColumn: true }).verdictRoom).toBe(true);
  });

  it('keeps it when narrow too', () => {
    expect(reviewChipOf(request('Merged', 'Reviewed'), true, { inColumn: true }).verdictRoom).toBe(true);
  });

  it('keeps no room out of a column: a chip after a name ends where its glyphs do', () => {
    expect(reviewChipOf(request('Merged', 'Reviewed'), false).verdictRoom).toBe(false);
    expect(reviewChipOf(plain('Reviewed'), false).verdictRoom).toBe(false);
  });
});

describe('codeReviewLine', () => {
  it('says what it is and where it stands', () => {
    expect(codeReviewLine(plain('Reviewed'))).toBe('Code review 12 · Reviewed');
  });
});
