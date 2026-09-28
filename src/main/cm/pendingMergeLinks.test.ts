import { describe, expect, it } from 'vitest';
import { mergeLinksOf, pendingMergeLinks } from './pendingMergeLinks';

describe('mergeLinksOf', () => {
  it('reads a merge, as the parser keeps it and as cm writes it', () => {
    expect(mergeLinksOf('Merge from 242')).toEqual([{ type: 'merge', sourceChangeset: 242 }]);
    expect(mergeLinksOf(' (Merge from 242)')).toEqual([{ type: 'merge', sourceChangeset: 242 }]);
  });

  it('reads cherry picks and subtractives, and intervals by where they start', () => {
    expect(mergeLinksOf('Merge from 58, Cherrypick from 3 to 7, Subtractive from 9')).toEqual([
      { type: 'merge', sourceChangeset: 58 },
      { type: 'intervalCherryPick', sourceChangeset: 7, intervalStart: 3 },
      { type: 'subtractive', sourceChangeset: 9 },
    ]);
    expect(mergeLinksOf('Cherrypick from 4')).toEqual([{ type: 'cherryPick', sourceChangeset: 4 }]);
    expect(mergeLinksOf('Subtractive from 2 to 5')).toEqual([{ type: 'intervalSubtractive', sourceChangeset: 5, intervalStart: 2 }]);
    expect(mergeLinksOf('Merge from 2 to 5')).toEqual([{ type: 'interval', sourceChangeset: 5, intervalStart: 2 }]);
  });

  it('reads localized words by the numbers alone', () => {
    expect(mergeLinksOf('Merge desde 12, Cherrypick desde 3 hasta 7')).toEqual([
      { type: 'merge', sourceChangeset: 12 },
      { type: 'intervalCherryPick', sourceChangeset: 7, intervalStart: 3 },
    ]);
  });

  it("leaves out an xlinked repository's merges and anything else", () => {
    expect(mergeLinksOf('Merge from 12 on rep:lib@server, Merge from 3')).toEqual([{ type: 'merge', sourceChangeset: 3 }]);
    expect(mergeLinksOf('')).toEqual([]);
    expect(mergeLinksOf('Replaced')).toEqual([]);
  });
});

describe('pendingMergeLinks', () => {
  it('lists each merge once', () => {
    expect(pendingMergeLinks(new Set(['Merge from 242', 'Merge from 242, Cherrypick from 9', 'Cherrypick from 3 to 9']))).toEqual([
      { type: 'merge', sourceChangeset: 242 },
      { type: 'cherryPick', sourceChangeset: 9 },
      { type: 'intervalCherryPick', sourceChangeset: 9, intervalStart: 3 },
    ]);
  });
});
