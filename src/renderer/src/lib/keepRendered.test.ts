import { describe, expect, it } from 'vitest';
import { keepRendered } from './keepRendered';

describe('keepRendered', () => {
  it('adds the row kept, in order, before or after the rows in view', () => {
    expect(keepRendered([10, 11, 12], 3, 100)).toEqual([3, 10, 11, 12]);
    expect(keepRendered([10, 11, 12], 60, 100)).toEqual([10, 11, 12, 60]);
  });

  it('leaves the rows in view alone when it is among them, there is none, or the list has shrunk past it', () => {
    expect(keepRendered([10, 11, 12], 11, 100)).toEqual([10, 11, 12]);
    expect(keepRendered([10, 11, 12], null, 100)).toEqual([10, 11, 12]);
    expect(keepRendered([0, 1], 40, 2)).toEqual([0, 1]);
  });
});
