import { describe, expect, it } from 'vitest';
import { diffedText, diffsEveryKeystroke, MAX_DIFFED_PER_KEYSTROKE_CHARS } from './diffWhileTyping';

describe('diffsEveryKeystroke', () => {
  it('diffs a text again at every keystroke up to the limit, both versions together', () => {
    const half = 'x'.repeat(MAX_DIFFED_PER_KEYSTROKE_CHARS / 2);
    expect(diffsEveryKeystroke('a\n', 'b\n')).toBe(true);
    expect(diffsEveryKeystroke(half, half)).toBe(true);
    expect(diffsEveryKeystroke(half, `${half}y`)).toBe(false);
  });
});

describe('diffedText', () => {
  const half = 'x'.repeat(MAX_DIFFED_PER_KEYSTROKE_CHARS / 2);

  it('diffs a small text as typed', () => {
    expect(diffedText({ original: 'a\n', saved: 'a\n', current: 'ab\n', paused: 'a\n' })).toBe('ab\n');
  });

  it('diffs a big text typed into as it was when typing last paused', () => {
    expect(diffedText({ original: half, saved: half, current: `${half}yz`, paused: `${half}y` })).toBe(`${half}y`);
  });

  it('diffs a big text as read once it is typed back to it, without waiting for a pause', () => {
    expect(diffedText({ original: `${half}a`, saved: `${half}b`, current: `${half}b`, paused: `${half}bc` })).toBe(`${half}b`);
  });
});
