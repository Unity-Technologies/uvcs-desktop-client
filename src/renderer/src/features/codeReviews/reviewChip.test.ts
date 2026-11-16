import { describe, expect, it } from 'vitest';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import type { CodeReviewStatus, MergeRequestState } from '@shared/domain/codeReview';
import { codeReviewLine, reviewChipOf } from './reviewChip';

const plain = (status: CodeReviewStatus) => codeReviewSummary({ id: 12, title: 'Add login', status });
const request = (state: MergeRequestState, status: CodeReviewStatus) => ({ ...plain(status), mergeRequest: { state, destination: '/main' } });

describe("a branch's review chip", () => {
  it("shows a code review's status, its name only where there's room", () => {
    expect(reviewChipOf(plain('Under review'), false)).toMatchObject({ status: 'Under review', statusText: true });
    expect(reviewChipOf(plain('Reviewed'), true)).toMatchObject({ status: 'Reviewed', statusText: false });
    expect(reviewChipOf(plain('Reviewed'), false).state).toBeUndefined();
  });

  it("names a merge request's state, then its review as an icon once decided while Open", () => {
    expect(reviewChipOf(request('Open', 'Reviewed'), false)).toMatchObject({ state: 'Open', stateText: true, status: 'Reviewed', statusText: false });
    expect(reviewChipOf(request('Open', 'Rework required'), false)).toMatchObject({ state: 'Open', status: 'Rework required' });
  });

  it('shows an Open request still under review by its state alone: Open says it waits for its review', () => {
    expect(reviewChipOf(request('Open', 'Under review'), false)).toMatchObject({ state: 'Open', status: undefined });
  });

  it.each(['Draft', 'Merged', 'Closed'] as const)('shows no review status on a %s request: it is not up for review', (state) => {
    expect(reviewChipOf(request(state, 'Reviewed'), false)).toMatchObject({ state, stateText: true, status: undefined });
  });

  it("keeps a merge request's glyphs and drops the state's name when narrow", () => {
    expect(reviewChipOf(request('Open', 'Reviewed'), true)).toMatchObject({ state: 'Open', stateText: false, status: 'Reviewed' });
    expect(reviewChipOf(request('Merged', 'Reviewed'), true)).toMatchObject({ state: 'Merged', stateText: false, status: undefined });
  });

  it("shows a merge request's summary card on hover, its status as a bare icon, and never names its number", () => {
    const chip = reviewChipOf(request('Open', 'Rework required'), false);
    expect(chip.hover).toEqual({ kind: 'summary', request: request('Open', 'Rework required') });
    expect(chip.statusForm).toBe('icon');
    expect(chip.label).toBe('Open merge request: Add login');
  });

  it("names a code review's number and status in its tooltip and for a screen reader", () => {
    expect(reviewChipOf(plain('Reviewed'), false)).toMatchObject({
      statusForm: 'badge',
      hover: { kind: 'tip', tip: 'Add login', tipSub: 'Code review 12 · Reviewed · click to open' },
      label: 'Open code review 12: Add login',
    });
    expect(reviewChipOf(plain('Reviewed'), true).hover).toMatchObject({ tip: 'Reviewed: Add login' });
  });
});

describe('codeReviewLine', () => {
  it('says what it is and where it stands', () => {
    expect(codeReviewLine(plain('Reviewed'))).toBe('Code review 12 · Reviewed');
  });
});
