import { describe, expect, it } from 'vitest';
import { stagePillRows } from './stagePillRows';

describe('stagePillRows', () => {
  it('counts the onion blend pill, and nothing in the modes without pills', () => {
    expect(stagePillRows({ mode: 'onion', diffsCompares: 'shape', regionCount: 0, looksLoaded: false })).toBe(1);
    expect(stagePillRows({ mode: 'sideBySide', diffsCompares: 'look', regionCount: 3, looksLoaded: false })).toBe(0);
    expect(stagePillRows({ mode: null, diffsCompares: 'shape', regionCount: 0, looksLoaded: false })).toBe(0);
  });

  it('counts the shape Diffs tolerance, and the regions row under it when there are regions', () => {
    expect(stagePillRows({ mode: 'differences', diffsCompares: 'shape', regionCount: 0, looksLoaded: false })).toBe(1);
    expect(stagePillRows({ mode: 'differences', diffsCompares: 'shape', regionCount: 2, looksLoaded: true })).toBe(2);
  });

  it('counts the loading note while Diffs by look waits for the textures, and nothing once it compares', () => {
    expect(stagePillRows({ mode: 'differences', diffsCompares: 'look', regionCount: 0, looksLoaded: false })).toBe(1);
    expect(stagePillRows({ mode: 'differences', diffsCompares: 'look', regionCount: 0, looksLoaded: true })).toBe(0);
  });
});
