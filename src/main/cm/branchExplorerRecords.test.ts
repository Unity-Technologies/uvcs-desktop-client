import { describe, expect, it } from 'vitest';
import { graphBranch, graphChangeset, graphLabel, graphMergeLink, roundTripDate } from './branchExplorerRecords';
import { parseRecords } from './formatRecords';
import { InternedStrings } from './InternedStrings';
import { formatOutput } from './testing/cmOutput';

describe('branch explorer records', () => {
  it('reads branches, flagged as hidden when read from the hidden ones', () => {
    const output = formatOutput([31266319, '/main/task', '/main', 'jane', '2026-09-01T10:00:00+02:00', 12, 'Multi\nline']);
    expect(parseRecords(output, graphBranch(true, new InternedStrings()))).toEqual([
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

  it('reads changesets, keeping -1 for the root parent', () => {
    const output = formatOutput([0, '/main', '', '2026-09-01', 'jane', ''], [5, '/main/task', 4, '2026-09-02', 'joe', 'Fix']);
    expect(parseRecords(output, graphChangeset(new InternedStrings())).map(({ id, parent, branch }) => ({ id, parent, branch }))).toEqual([
      { id: 0, parent: -1, branch: '/main' },
      { id: 5, parent: 4, branch: '/main/task' },
    ]);
  });

  it('maps merge types and skips unknown ones', () => {
    const output = formatOutput(['merge', 10, 11], ['cherrypick', 15, 16], ['cherrypicksubstractive', 3, 9], ['weird', 1, 2]);
    expect(parseRecords(output, graphMergeLink)).toEqual([
      { type: 'merge', sourceChangeset: 10, destinationChangeset: 11 },
      { type: 'cherryPick', sourceChangeset: 15, destinationChangeset: 16 },
      { type: 'subtractive', sourceChangeset: 3, destinationChangeset: 9 },
    ]);
  });

  it('spells query days in the round-trip date format', () => {
    expect(roundTripDate('2026-08-26')).toMatch(/^2026-08-26T00:00:00\.0000000[+-]\d{2}:\d{2}$/);
  });

  it('reads labels', () => {
    expect(parseRecords(formatOutput(['v1.0', 3, 'jane', '2026-09-01', 'First']), graphLabel(new InternedStrings()))).toEqual([
      { name: 'v1.0', changeset: 3, owner: 'jane', date: '2026-09-01', comment: 'First' },
    ]);
  });
});
