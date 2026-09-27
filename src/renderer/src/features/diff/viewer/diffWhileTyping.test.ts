import { describe, expect, it } from 'vitest';
import { diffsEveryKeystroke, MAX_DIFFED_PER_KEYSTROKE_CHARS } from './diffWhileTyping';

describe('diffsEveryKeystroke', () => {
  it('diffs a text again at every keystroke up to the limit, both versions together', () => {
    const half = 'x'.repeat(MAX_DIFFED_PER_KEYSTROKE_CHARS / 2);
    expect(diffsEveryKeystroke('a\n', 'b\n')).toBe(true);
    expect(diffsEveryKeystroke(half, half)).toBe(true);
    expect(diffsEveryKeystroke(half, `${half}y`)).toBe(false);
  });
});
