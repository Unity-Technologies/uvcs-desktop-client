import { describe, expect, it } from 'vitest';
import { shortcutListens } from './viewShown';

describe('shortcutListens', () => {
  it('listens when asked to in a view shown, and never in a view kept mounted but hidden', () => {
    expect(shortcutListens(true, true)).toBe(true);
    expect(shortcutListens(true, false)).toBe(false);
    expect(shortcutListens(false, true)).toBe(false);
  });
});
