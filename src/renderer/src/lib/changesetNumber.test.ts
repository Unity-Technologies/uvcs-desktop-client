import { describe, expect, it } from 'vitest';
import { typedChangesetNumber } from './changesetNumber';

describe('typedChangesetNumber', () => {
  it('reads a number or a changeset spec, in any case, around spaces', () => {
    expect(['12', 'cs:12', 'CS:12', ' cs:0 '].map(typedChangesetNumber)).toEqual([12, 12, 12, 0]);
  });

  it('reads nothing else', () => {
    expect(['', 'cs:', '12a', 'cs:1 2', 'sh:3', '-4', '1.5', 'cs:12@game'].map(typedChangesetNumber)).toEqual(Array(8).fill(undefined));
  });
});
