import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { BULK_PRIVATE_FILES, bulkPrivateFiles, bulkPrivateMessage } from './bulkPrivate';

function change(path: string, kinds: PendingChange['kinds'] = ['private'], itemType: PendingChange['itemType'] = 'file'): PendingChange {
  return { path, kinds, itemType, size: 1, lastModified: '' };
}

const folder = (path: string): PendingChange => change(path, ['private'], 'directory');
const files = (directory: string, count: number): PendingChange[] => Array.from({ length: count }, (_, index) => change(`${directory}/f${index}.g`));

describe('bulkPrivateFiles', () => {
  it('stays quiet for a few new files', () => {
    expect(bulkPrivateFiles([folder('src/feature'), ...files('src/feature', 3), change('a.ts', ['changed'])])).toBeNull();
    expect(bulkPrivateFiles(files('src', BULK_PRIVATE_FILES))).toBeNull();
  });

  it('counts private files past the limit, by the outermost private folder holding them', () => {
    const bulk = bulkPrivateFiles([
      folder('gen'),
      folder('gen/sub'),
      ...files('gen', 40),
      ...files('gen/sub', 20),
      folder('tools/obj'),
      ...files('tools/obj', 30),
      change('src/app.ts', ['changed']),
    ]);
    expect(bulk?.fileCount).toBe(90);
    expect(bulk?.folders).toEqual(['gen', 'tools/obj']);
    expect(bulk?.changes).toHaveLength(93);
  });

  it('falls back to the files’ folders when no folder is private', () => {
    expect(bulkPrivateFiles([...files('assets/a', 30), ...files('assets/b', 31)])?.folders).toEqual(['assets/b', 'assets/a']);
  });

  it('asks about a generated folder whatever its size', () => {
    expect(bulkPrivateFiles([folder('obj'), ...files('obj', 2)])).toMatchObject({ fileCount: 2, folders: ['obj'] });
    expect(bulkPrivateFiles([folder('Library'), change('Library/cache.bin')])?.folders).toEqual(['Library']);
  });

  it('ignores private files left out of the check-in', () => {
    expect(bulkPrivateFiles([change('src/a.ts', ['changed'])])).toBeNull();
  });
});

describe('bulkPrivateMessage', () => {
  it('names the count and the first folders', () => {
    expect(bulkPrivateMessage({ fileCount: 3000, folders: ['gen', 'obj', 'bin'], changes: [] })).toBe('3,000 private files are included (gen/, obj/…)');
    expect(bulkPrivateMessage({ fileCount: 60, folders: ['gen'], changes: [] })).toBe('60 private files are included (gen/)');
    expect(bulkPrivateMessage({ fileCount: 1, folders: [], changes: [] })).toBe('1 private file is included');
  });
});
