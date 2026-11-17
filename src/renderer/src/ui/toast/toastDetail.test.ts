import { describe, expect, it } from 'vitest';
import { autoDismissMsOf, detailToggleOf, errorCopyTextOf } from './toastDetail';
import { AUTO_DISMISS_MS } from './toastStore';

describe('detailToggleOf', () => {
  it('offers no toggle when the whole detail fits in the folded lines', () => {
    expect(detailToggleOf({ hasDetail: true, clipped: false, unfolded: false })).toBeNull();
  });

  it('offers to show more when the folded detail hides some of its text', () => {
    expect(detailToggleOf({ hasDetail: true, clipped: true, unfolded: false })).toBe('Show more');
  });

  it('offers to show less once the detail is unfolded', () => {
    expect(detailToggleOf({ hasDetail: true, clipped: true, unfolded: true })).toBe('Show less');
  });

  it('offers no toggle once the toast has no detail left, whatever was measured or unfolded before', () => {
    expect(detailToggleOf({ hasDetail: false, clipped: true, unfolded: false })).toBeNull();
    expect(detailToggleOf({ hasDetail: false, clipped: true, unfolded: true })).toBeNull();
  });
});

describe('autoDismissMsOf', () => {
  it('counts down as its kind does while the detail is folded', () => {
    expect(autoDismissMsOf('error', { hasDetail: true, unfolded: false })).toBe(AUTO_DISMISS_MS.error);
    expect(autoDismissMsOf('progress', { hasDetail: true, unfolded: false })).toBeNull();
  });

  it('keeps a toast the user unfolded to read until they dismiss it', () => {
    expect(autoDismissMsOf('error', { hasDetail: true, unfolded: true })).toBeNull();
    expect(autoDismissMsOf('success', { hasDetail: true, unfolded: true })).toBeNull();
  });

  it('counts down as its kind does once it has no detail left to read', () => {
    expect(autoDismissMsOf('success', { hasDetail: false, unfolded: true })).toBe(AUTO_DISMISS_MS.success);
  });
});

describe('errorCopyTextOf', () => {
  it("copies an error toast's title and message, one per line", () => {
    expect(errorCopyTextOf({ kind: 'error', title: 'Something went wrong', detail: 'Failed to fetch module' })).toBe(
      'Something went wrong\nFailed to fetch module',
    );
  });

  it('offers no copy for an error with no message, nor for toasts that tell no failure', () => {
    expect(errorCopyTextOf({ kind: 'error', title: 'Something went wrong' })).toBeNull();
    expect(errorCopyTextOf({ kind: 'info', title: 'Branch name copied', detail: '/main/task' })).toBeNull();
    expect(errorCopyTextOf({ kind: 'progress', title: 'Updating', detail: '3 of 10 files' })).toBeNull();
  });
});
