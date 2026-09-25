import { describe, expect, it } from 'vitest';
import { trimToFit } from './trimToFit';

const measure = (text: string): number => Array.from(text).length;

describe('trimToFit', () => {
  it('keeps text that fits', () => {
    expect(trimToFit('src/app/', 8, measure)).toBe('src/app/');
  });

  it('cuts the end and adds an ellipsis', () => {
    expect(trimToFit('src/app/main/', 6, measure)).toBe('src/a…');
  });

  it('returns nothing when not even the ellipsis fits', () => {
    expect(trimToFit('src/', 0, measure)).toBe('');
  });

  it('never splits a surrogate pair', () => {
    expect(trimToFit('a😀bcd', 3, measure)).toBe('a😀…');
  });
});
