import { describe, expect, it } from 'vitest';
import { isOnIn, withOnIn } from './offByRepository';

describe('withOnIn', () => {
  it('turns it off in one repository, and back on', () => {
    const off = withOnIn({}, 'game', false);
    expect(off).toEqual({ game: true });
    expect(isOnIn(off, 'game')).toBe(false);
    expect(isOnIn(off, 'tools')).toBe(true);
    expect(withOnIn(off, 'game', true)).toEqual({});
  });

  it('keeps it on with no repository known yet', () => {
    expect(isOnIn({ game: true }, undefined)).toBe(true);
  });
});
