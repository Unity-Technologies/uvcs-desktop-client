import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { reviewModeLabel } from './reviewModeLabel';

describe('reviewModeLabel', () => {
  it('names the key that marks a file, as a person set it', () => {
    expect(reviewModeLabel('r', true)).toBe('Review mode in this workspace: mark files as you review them, in Changes and every diff (R)');
    expect(reviewModeLabel('mod+shift+m', false)).toBe('Review mode in this workspace: mark files as you review them, in Changes and every diff (Ctrl+Shift+M)');
  });

  it('names no key when a person removed it', () => {
    expect(reviewModeLabel(undefined, true)).toBe('Review mode in this workspace: mark files as you review them, in Changes and every diff');
  });
});
