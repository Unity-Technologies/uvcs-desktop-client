import { describe, expect, it } from 'vitest';
import { parseDiffEntries } from './diffEntries';

const record = (...fields: string[]): string => `${fields.join('\u001f')}\u001e\n`;

describe('parseDiffEntries', () => {
  it('reads added, changed and deleted items sorted by path', () => {
    const output =
      record('A', '"/src/ui.ts"', '""', '-1', '36', 'F') +
      record('C', '"/assets/logo.png"', '""', '13', '37', 'B') +
      record('D', '"/docs/notes.md"', '""', '-1', '14', 'F');

    expect(parseDiffEntries(output)).toEqual([
      { status: 'changed', path: 'assets/logo.png', oldPath: undefined, itemType: 'binaryFile', baseRevisionId: 13, revisionId: 37 },
      { status: 'deleted', path: 'docs/notes.md', oldPath: undefined, itemType: 'file', baseRevisionId: 14, revisionId: -1 },
      { status: 'added', path: 'src/ui.ts', oldPath: undefined, itemType: 'file', baseRevisionId: -1, revisionId: 36 },
    ]);
  });

  it('shows the same revision on both sides of a pure move', () => {
    const [moved] = parseDiffEntries(record('M', '"/docs/changelog.md"', '"/docs/notes.md"', '-1', '14', 'F'));
    expect(moved).toMatchObject({ status: 'moved', oldPath: 'docs/notes.md', baseRevisionId: 14, revisionId: 14 });
  });

  it('merges a moved and changed item into one entry', () => {
    const output = record('C', '"/src/arith.ts"', '""', '55', '69', 'F') + record('M', '"/src/arith.ts"', '"/src/math.ts"', '-1', '69', 'F');
    expect(parseDiffEntries(output)).toEqual([
      { status: 'moved', path: 'src/arith.ts', oldPath: 'src/math.ts', itemType: 'file', baseRevisionId: 55, revisionId: 69 },
    ]);
  });

  it('reads a 100,000-file diff in linear time', () => {
    let output = '';
    for (let index = 0; index < 100_000; index++) output += record('C', `"/src/folder${index % 100}/file_${(index * 7919) % 100_000}.ts"`, '""', '12', '13', 'F');
    const start = performance.now();
    const entries = parseDiffEntries(output);
    // About 0.15 s here.
    expect(performance.now() - start).toBeLessThan(2000);
    expect(entries).toHaveLength(100_000);
  });
});
