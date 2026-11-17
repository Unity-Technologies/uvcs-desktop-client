import { describe, expect, it } from 'vitest';
import { autoDismissMsOf, detailToggleOf, errorCopyTextOf } from './toastDetail';
import { AUTO_DISMISS_MS } from './toastStore';

describe('detailToggleOf', () => {
  it('offers no toggle when the whole detail fits in the folded lines', () => {
    expect(detailToggleOf(false, false)).toBeNull();
  });

  it('offers to show more when the folded detail hides some of its text', () => {
    expect(detailToggleOf(true, false)).toBe('Show more');
  });

  it('offers to show less once the detail is unfolded', () => {
    expect(detailToggleOf(true, true)).toBe('Show less');
  });
});

describe('autoDismissMsOf', () => {
  it('counts down as its kind does while the detail is folded', () => {
    expect(autoDismissMsOf('error', false)).toBe(AUTO_DISMISS_MS.error);
    expect(autoDismissMsOf('progress', false)).toBeNull();
  });

  it('keeps a toast the user unfolded to read until they dismiss it', () => {
    expect(autoDismissMsOf('error', true)).toBeNull();
    expect(autoDismissMsOf('success', true)).toBeNull();
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
