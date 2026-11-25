import { describe, expect, it } from 'vitest';
import type { ReviewChip } from '../../codeReviews/reviewChip';
import { reviewChipLayout, STATUS_ICON } from './reviewChipLayout';

const measure = (text: string) => text.length * 5;
const tip = { kind: 'tip', tip: '', tipSub: '' } as const;
const chip = (fields: Partial<ReviewChip>): ReviewChip => ({ stateText: false, statusText: false, verdictRoom: false, hover: tip, label: '', ...fields });

describe('reviewChipLayout', () => {
  it("draws a merge request's state as a pill with its name, then its verdict's icon after it", () => {
    const layout = reviewChipLayout(chip({ state: 'Open', stateText: true, verdict: 'ready' }), measure);
    expect(layout.pill).toEqual({ kind: 'state', width: 5 + 9 + 3 + 20 + 5, text: { x: 17, value: 'Open' } });
    expect(layout.icon).toEqual({ x: 42 + 4 });
    expect(layout.width).toBe(46 + STATUS_ICON);
  });

  it("draws a merge request with no verdict yet as its pill alone", () => {
    const layout = reviewChipLayout(chip({ state: 'Merged', stateText: true }), measure);
    expect(layout.icon).toBeUndefined();
    expect(layout.width).toBe(layout.pill.width);
  });

  it("draws a code review's status as the pill, with its short name", () => {
    const layout = reviewChipLayout(chip({ status: 'Under review', statusText: true }), measure);
    expect(layout.pill).toMatchObject({ kind: 'status', text: { value: 'In review' } });
    expect(layout.icon).toBeUndefined();
  });

  it('keeps only the glyph in the pill when the name has no room', () => {
    expect(reviewChipLayout(chip({ state: 'Open' }), measure).pill).toEqual({ kind: 'state', width: 19 });
  });
});
