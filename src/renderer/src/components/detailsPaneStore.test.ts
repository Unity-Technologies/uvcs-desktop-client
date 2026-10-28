import { describe, expect, it } from 'vitest';
import { DETAILS_WIDTH, detailsHidden, detailsWidthOf, withDetailsToggled } from './detailsPaneStore';

describe('detailsWidthOf', () => {
  it("keeps each view's own width", () => {
    const state = { widths: { branches: 380, files: 900 } };
    expect(detailsWidthOf(state, 'branches', DETAILS_WIDTH)).toBe(380);
    expect(detailsWidthOf(state, 'files', { initial: 560, min: 320, max: 1200 })).toBe(900);
  });

  it('starts a view at its default until it is resized', () => {
    expect(detailsWidthOf({ widths: { branches: 380 } }, 'labels', DETAILS_WIDTH)).toBe(DETAILS_WIDTH.initial);
  });

  it("keeps a remembered width within the view's limits", () => {
    expect(detailsWidthOf({ widths: { labels: 2000 } }, 'labels', DETAILS_WIDTH)).toBe(DETAILS_WIDTH.max);
    expect(detailsWidthOf({ widths: { labels: 10 } }, 'labels', DETAILS_WIDTH)).toBe(DETAILS_WIDTH.min);
  });
});

describe('detailsHidden', () => {
  it("shows a view's details until they are hidden", () => {
    expect(detailsHidden({ hidden: {} }, 'branches')).toBe(false);
    expect(detailsHidden({ hidden: { branches: true } }, 'branches')).toBe(true);
  });
});

describe('withDetailsToggled', () => {
  it("hides one view's details, leaving the others' as they were", () => {
    expect(withDetailsToggled({ labels: true }, 'branches')).toEqual({ labels: true, branches: true });
  });

  it('shows them again, forgetting the view', () => {
    expect(withDetailsToggled({ labels: true, branches: true }, 'branches')).toEqual({ labels: true });
  });
});
