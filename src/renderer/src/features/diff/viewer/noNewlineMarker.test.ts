import { describe, expect, it } from 'vitest';
import { showsNoNewlineMarker } from './noNewlineMarker';

describe('showsNoNewlineMarker', () => {
  it('shows it when only the final line break changed', () => {
    expect(showsNoNewlineMarker('a\nb\n', 'a\nb')).toBe(true);
    expect(showsNoNewlineMarker('a\nb', 'a\nb\r\n')).toBe(true);
  });

  it('hides it when neither side ends with a line break', () => {
    expect(showsNoNewlineMarker('a\nb', 'a\nc')).toBe(false);
  });

  it('hides it when a side is empty', () => {
    expect(showsNoNewlineMarker('', "Now I'm editing it")).toBe(false);
    expect(showsNoNewlineMarker('gone', '')).toBe(false);
  });

  it('has nothing to hide when both sides end with a line break', () => {
    expect(showsNoNewlineMarker('a\n', 'b\n')).toBe(false);
  });
});
