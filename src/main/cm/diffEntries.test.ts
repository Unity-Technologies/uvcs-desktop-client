import { describe, expect, it } from 'vitest';
import { parseDiffEntries } from './diffEntries';

const F = '\u001f';
const R = '\u001e\n';

describe('parseDiffEntries', () => {
  it('reads changed, added, deleted and moved items', () => {
    const output = [
      ['C', '"src/conflict.txt"', '""', '56', '93', 'F'],
      ['A', '"data.bin"', '""', '-1', '92', 'B'],
      ['D', '"src/cd.txt"', '""', '-1', '17', 'F'],
      ['M', '"src/md-moved.txt"', '"src/md.txt"', '-1', '16', 'F'],
    ]
      .map((fields) => fields.join(F) + R)
      .join('');

    expect(parseDiffEntries(output)).toEqual([
      { status: 'changed', path: 'src/conflict.txt', oldPath: undefined, itemType: 'file', baseRevisionId: 56, revisionId: 93 },
      { status: 'added', path: 'data.bin', oldPath: undefined, itemType: 'binaryFile', baseRevisionId: -1, revisionId: 92 },
      { status: 'deleted', path: 'src/cd.txt', oldPath: undefined, itemType: 'file', baseRevisionId: 17, revisionId: -1 },
      { status: 'moved', path: 'src/md-moved.txt', oldPath: 'src/md.txt', itemType: 'file', baseRevisionId: 16, revisionId: 16 },
    ]);
  });
});
