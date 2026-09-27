import { describe, expect, it } from 'vitest';
import { parseBranches, parseChangesets, parseHiddenBranches, parseLabels, parseMergeLinks, roundTripDate } from './branchExplorerRecords';

const F = '\u001f';
const R = '\u001e';

describe('branch explorer records', () => {
  it('parses branches and flags the hidden ones', () => {
    const output = `31266319${F}/main/task${F}/main${F}jane${F}2026-09-01T10:00:00+02:00${F}12${F}Multi\nline${R}\n`;
    expect(parseBranches(output, new Set(['/main/task']))).toEqual([
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

  it('parses hidden branches with their object ids', () => {
    expect(parseHiddenBranches(`37${F}/main/task1${R}\n`)).toEqual([{ id: 37, name: '/main/task1' }]);
  });

  it('parses changesets, keeping -1 for the root parent', () => {
    const output = `0${F}/main${F}${F}2026-09-01${F}jane${F}${R}\n5${F}/main/task${F}4${F}2026-09-02${F}joe${F}Fix${R}\n`;
    expect(parseChangesets(output).map(({ id, parent, branch }) => ({ id, parent, branch }))).toEqual([
      { id: 0, parent: -1, branch: '/main' },
      { id: 5, parent: 4, branch: '/main/task' },
    ]);
  });

  it('maps merge types and skips unknown ones', () => {
    const output = `merge${F}10${F}11${R}\ncherrypick${F}15${F}16${R}\ncherrypicksubstractive${F}3${F}9${R}\nweird${F}1${F}2${R}\n`;
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
    expect(parseLabels(`v1.0${F}3${F}jane${F}2026-09-01${F}First${R}\n`)).toEqual([
      { name: 'v1.0', changeset: 3, owner: 'jane', date: '2026-09-01', comment: 'First' },
    ]);
  });

  it('reads 280,000 changesets (codice) in linear time', () => {
    let output = '';
    for (let id = 0; id < 280_000; id++) output += `${id}${F}/main/task${id % 20_000}${F}${id - 1}${F}2026-09-25T10:11:12.0000000+02:00${F}jane${F}comment ${id}${R}\n`;
    const start = performance.now();
    const changesets = parseChangesets(output);
    // About 0.1 s here.
    expect(performance.now() - start).toBeLessThan(2000);
    expect(changesets).toHaveLength(280_000);
  });
});

