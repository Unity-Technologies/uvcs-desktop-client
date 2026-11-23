import { describe, expect, it } from 'vitest';
import { threadShownWhileHidden } from './reviewPins';

describe('threadShownWhileHidden', () => {
  it('hides the thread selected when comments were hidden', () => {
    expect(threadShownWhileHidden({ threadId: 7, seq: 3 }, 3)).toBeUndefined();
  });

  it('shows a thread gone to since, the same one gone to again included', () => {
    expect(threadShownWhileHidden({ threadId: 9, seq: 4 }, 3)).toBe(9);
    expect(threadShownWhileHidden({ threadId: 7, seq: 4 }, 3)).toBe(7);
  });

  it('shows the thread gone to when nothing was selected as they hid, and none with nothing gone to', () => {
    expect(threadShownWhileHidden({ threadId: 7, seq: 1 }, null)).toBe(7);
    expect(threadShownWhileHidden(null, null)).toBeUndefined();
  });
});
