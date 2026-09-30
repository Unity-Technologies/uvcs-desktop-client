import { describe, expect, it } from 'vitest';
import { countCharactersRead } from '@shared/testing/countCharactersRead';
import { parseBranches, parseChangesets, parseLabels, parseMergeLinks, roundTripDate } from './branchExplorerRecords';
import { formatOutput } from './testing/cmOutput';

describe('branch explorer records', () => {
  it('parses branches, flagged as hidden when read from the hidden ones', () => {
    const output = formatOutput([31266319, '/main/task', '/main', 'jane', '2026-09-01T10:00:00+02:00', 12, 'Multi\nline']);
    expect(parseBranches(output, true)).toEqual([
      {
        id: 31266319,
        name: '/main/task',
        parent: '/main',
        owner: 'jane',
        date: '2026-09-01T10:00:00+02:00',
        headChangeset: 12,
        comment: 'Multi\nline',
        isHidden: true,
      },
    ]);
  });

  it('parses changesets, keeping -1 for the root parent', () => {
    const output = formatOutput([0, '/main', '', '2026-09-01', 'jane', ''], [5, '/main/task', 4, '2026-09-02', 'joe', 'Fix']);
    expect(parseChangesets(output).map(({ id, parent, branch }) => ({ id, parent, branch }))).toEqual([
      { id: 0, parent: -1, branch: '/main' },
      { id: 5, parent: 4, branch: '/main/task' },
    ]);
  });

  it('maps merge types and skips unknown ones', () => {
    const output = formatOutput(['merge', 10, 11], ['cherrypick', 15, 16], ['cherrypicksubstractive', 3, 9], ['weird', 1, 2]);
    expect(parseMergeLinks(output)).toEqual([
      { type: 'merge', sourceChangeset: 10, destinationChangeset: 11 },
      { type: 'cherryPick', sourceChangeset: 15, destinationChangeset: 16 },
      { type: 'subtractive', sourceChangeset: 3, destinationChangeset: 9 },
    ]);
  });

  it('spells query days in the round-trip date format', () => {
    expect(roundTripDate('2026-08-26')).toMatch(/^2026-08-26T00:00:00\.0000000[+-]\d{2}:\d{2}$/);
  });

  it('parses labels', () => {
    expect(parseLabels(formatOutput(['v1.0', 3, 'jane', '2026-09-01', 'First']))).toEqual([
      { name: 'v1.0', changeset: 3, owner: 'jane', date: '2026-09-01', comment: 'First' },
    ]);
  });

  it('reads the changesets of a big repository in one pass: a few reads of each character, whatever the size', () => {
    const output = formatOutput(...Array.from({ length: 5_000 }, (_, id) => [id, `/main/task${id % 2_000}`, id - 1, '2026-09-25T10:11:12.0000000+02:00', 'jane', `comment ${id}`]));
    const { result: changesets, charactersRead } = countCharactersRead(() => parseChangesets(output));
    // About 3 reads of each character; a pass over the rest of the output per record reads each thousands of times.
    expect(charactersRead / output.length).toBeLessThan(5);
    expect(changesets).toHaveLength(5_000);
  });
});

