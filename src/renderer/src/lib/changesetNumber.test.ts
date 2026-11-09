import { describe, expect, it } from 'vitest';
import { typedChangesetNumber } from './changesetNumber';

describe('typedChangesetNumber', () => {
  it('reads no number past a safe integer, which would reach cm rounded or as 1e+24', () => {
    expect(typedChangesetNumber('1000000000000000000000000')).toBeUndefined();
    expect(typedChangesetNumber(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  });


  it('reads a number or a changeset spec, in any case, around spaces', () => {
    expect(['12', 'cs:12', 'CS:12', ' cs:0 '].map(typedChangesetNumber)).toEqual([12, 12, 12, 0]);
  });

  it('reads nothing else', () => {
    expect(['', 'cs:', '12a', 'cs:1 2', 'sh:3', '-4', '1.5', 'cs:12@game'].map(typedChangesetNumber)).toEqual(Array(8).fill(undefined));
  });
});
