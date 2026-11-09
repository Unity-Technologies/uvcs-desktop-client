import '../testing/fakeWindow';
import { beforeEach, describe, expect, it } from 'vitest';
import { DETAILS_WIDTH, detailsHidden, detailsWidthOf, toggledDetails, useDetailsPaneStore, withDetailsShown, withDetailsToggled } from './detailsPaneStore';

/** The view that started without its details. */
const TAB = {};

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

  it('hides details a view starts without, whatever the user left them as elsewhere (a review with no comments on its code)', () => {
    expect(detailsHidden({ hidden: {}, startedHidden: { reviewComments: TAB } }, 'reviewComments')).toBe(true);
  });
});

describe('toggledDetails', () => {
  it("shows details a view started without, keeping the user's own choice: the next review starts as they left it", () => {
    expect(toggledDetails({ hidden: {}, startedHidden: { reviewComments: TAB } }, 'reviewComments')).toEqual({ hidden: {}, startedHidden: {} });
    expect(toggledDetails({ hidden: { reviewComments: true }, startedHidden: { reviewComments: TAB } }, 'reviewComments')).toEqual({ hidden: {}, startedHidden: {} });
  });

  it('hides or shows them as the user chose otherwise', () => {
    expect(toggledDetails({ hidden: {}, startedHidden: {} }, 'reviewComments')).toEqual({ hidden: { reviewComments: true }, startedHidden: {} });
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

describe('withDetailsShown', () => {
  it("shows one view's details, leaving them shown when they were", () => {
    expect(withDetailsShown({ labels: true, branches: true }, 'branches')).toEqual({ labels: true });
    expect(withDetailsShown({ labels: true }, 'branches')).toEqual({ labels: true });
  });
});

describe('a view started without its details', () => {
  // The store is the module's: each test starts with no view started hidden.
  beforeEach(() => useDetailsPaneStore.setState({ startedHidden: {} }));

  it("is forgotten only by the view that started it: one review's tab left keeps the next one's start", () => {
    const store = useDetailsPaneStore.getState();
    const leaving = {};
    const arriving = {};
    store.startHidden('reviewComments', leaving);
    // The next review's tab starts before the one it replaces is cleaned up.
    store.startHidden('reviewComments', arriving);
    store.forgetStarted('reviewComments', leaving);

    expect(detailsHidden(useDetailsPaneStore.getState(), 'reviewComments')).toBe(true);

    store.forgetStarted('reviewComments', arriving);
    expect(detailsHidden(useDetailsPaneStore.getState(), 'reviewComments')).toBe(false);
  });
});
