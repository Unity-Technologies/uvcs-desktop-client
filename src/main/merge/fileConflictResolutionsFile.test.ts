import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { FileConflict, MergePlan } from '@shared/domain/merge';
import { fileConflictResolutionsFile } from './fileConflictResolutionsFile';

const conflict = (path: string): FileConflict => ({ path, destinationPath: path, itemId: 1, baseChangeset: 1, sourceChangeset: 2, destinationChangeset: 3, repository: 'game@local', destinationRevisionId: 30, destinationIsBinary: false });
const plan = (...paths: string[]): MergePlan => ({ status: 'ready', changes: [], fileConflicts: paths.map(conflict), directoryConflicts: [], warnings: [] });
const directory = join('tmp', 'merge');

describe('fileConflictResolutionsFile', () => {
  it('names a side to keep, and a result file for each merged text, by the path cm printed', () => {
    const file = fileConflictResolutionsFile(
      plan('/src/a.cs', '/art/logo.png', '/src/b.cs', '/README.md'),
      {
        '/src/a.cs': { choice: 'text', text: 'merged a\n' },
        '/art/logo.png': { choice: 'source' },
        '/src/b.cs': { choice: 'text', text: 'merged b\n' },
        '/README.md': { choice: 'destination' },
      },
      directory,
    );

    expect(JSON.parse(file.json)).toEqual({
      resolutions: [
        { path: '/src/a.cs', resultFile: join(directory, 'result-1') },
        { path: '/art/logo.png', keep: 'source' },
        { path: '/src/b.cs', resultFile: join(directory, 'result-2') },
        { path: '/README.md', keep: 'destination' },
      ],
    });
    expect(file.resultFiles).toEqual([
      { file: join(directory, 'result-1'), text: 'merged a\n' },
      { file: join(directory, 'result-2'), text: 'merged b\n' },
    ]);
  });

  it("keeps the source on the server even when the page read its text, so cm uploads nothing for it", () => {
    const file = fileConflictResolutionsFile(plan('/a.txt'), { '/a.txt': { choice: 'source', text: 'incoming\n' } }, directory);

    expect(JSON.parse(file.json).resolutions).toEqual([{ path: '/a.txt', keep: 'source' }]);
    expect(file.resultFiles).toEqual([]);
  });

  it("keeps the base in a result file, as cm keeps only a side by name: its text as read, else its revision for cm cat to save", () => {
    const file = fileConflictResolutionsFile(plan('/a.txt', '/b.png'), { '/a.txt': { choice: 'base', text: 'base\n' }, '/b.png': { choice: 'base' } }, directory);

    expect(JSON.parse(file.json).resolutions).toEqual([
      { path: '/a.txt', resultFile: join(directory, 'result-1') },
      { path: '/b.png', resultFile: join(directory, 'result-2') },
    ]);
    expect(file.resultFiles).toEqual([
      { file: join(directory, 'result-1'), text: 'base\n' },
      { file: join(directory, 'result-2'), revision: { spec: 'itemid:1#cs:1@game@local', repository: 'game@local', path: '/b.png' } },
    ]);
  });

  it('names result files by number, whatever characters the conflicting path holds', () => {
    const file = fileConflictResolutionsFile(plan('/docs/café "notes"\\x.md'), { '/docs/café "notes"\\x.md': { choice: 'text', text: 'ü\r\n' } }, directory);

    expect(JSON.parse(file.json).resolutions).toEqual([{ path: '/docs/café "notes"\\x.md', resultFile: join(directory, 'result-1') }]);
    expect(file.resultFiles).toEqual([{ file: join(directory, 'result-1'), text: 'ü\r\n' }]);
  });
});
