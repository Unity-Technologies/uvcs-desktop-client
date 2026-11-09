import { describe, expect, it } from 'vitest';
import type { TreeItem } from '@shared/domain/explorer';
import type { ChangeKind, PendingChange } from '@shared/domain/pendingChanges';
import { filesCheckinChanges } from './filesCheckin';

const item = (path: string, overrides: Partial<TreeItem> = {}): TreeItem => ({
  path,
  name: path.slice(path.lastIndexOf('/') + 1),
  itemType: 'file',
  size: 1,
  date: '',
  isPrivate: false,
  isCheckedOut: false,
  changeset: 1,
  branch: '/main',
  owner: 'jane',
  revisionId: 2,
  parentRevisionId: -1,
  repository: 'game@local',
  itemId: 3,
  ...overrides,
});

const folder = (path: string, overrides: Partial<TreeItem> = {}): TreeItem => item(path, { itemType: 'directory', ...overrides });

const change = (path: string, kinds: ChangeKind[], extra: Partial<PendingChange> = {}): PendingChange => ({
  path,
  kinds,
  itemType: 'file',
  size: 1,
  lastModified: '',
  ...extra,
});

const pathsOf = (changes: PendingChange[]): string[] => changes.map((found) => found.path).sort();

describe('filesCheckinChanges', () => {
  it('checks in only the selected file, a new one added with it', () => {
    const pending = [change('notes.txt', ['private']), change('app.ts', ['changed']), change('other.txt', ['private'])];
    expect(pathsOf(filesCheckinChanges([item('notes.txt', { isPrivate: true })], pending))).toEqual(['notes.txt']);
  });

  it('checks in a private file the Changes filter hides, as a private change', () => {
    const changes = filesCheckinChanges([item('notes.txt', { isPrivate: true, size: 7 })], [change('app.ts', ['changed'])]);
    expect(changes).toEqual([{ path: 'notes.txt', kinds: ['private'], itemType: 'file', size: 7, lastModified: '' }]);
  });

  it('takes a controlled folder\'s controlled changes, leaving its private files', () => {
    const pending = [change('src/app.ts', ['changed']), change('src/deep/lib.ts', ['added']), change('src/new.ts', ['private']), change('docs/a.md', ['changed'])];
    expect(pathsOf(filesCheckinChanges([folder('src')], pending))).toEqual(['src/app.ts', 'src/deep/lib.ts']);
  });

  it('takes everything a private folder holds, since it is added whole', () => {
    const pending = [change('art', ['private'], { itemType: 'directory' }), change('art/a.png', ['private']), change('art/b/c.png', ['private']), change('d.png', ['private'])];
    expect(pathsOf(filesCheckinChanges([folder('art', { isPrivate: true })], pending))).toEqual(['art', 'art/a.png', 'art/b/c.png']);
  });

  it('takes every controlled change from the workspace root', () => {
    const pending = [change('a.ts', ['changed']), change('src/b.ts', ['deleted']), change('c.txt', ['private'])];
    expect(pathsOf(filesCheckinChanges([folder('')], pending))).toEqual(['a.ts', 'src/b.ts']);
  });

  it('brings the new folder holding a selected new file, which cm needs', () => {
    const pending = [change('art', ['private'], { itemType: 'directory' }), change('art/a.png', ['private']), change('art/b.png', ['private'])];
    expect(pathsOf(filesCheckinChanges([item('art/a.png', { isPrivate: true })], pending))).toEqual(['art', 'art/a.png']);
  });

  it('brings the rest of a pending merge', () => {
    const merged = { mergeInfo: 'Merge from 2' };
    const pending = [change('a.ts', ['changed'], merged), change('b.ts', ['changed'], merged), change('c.ts', ['changed'])];
    expect(pathsOf(filesCheckinChanges([item('a.ts')], pending))).toEqual(['a.ts', 'b.ts']);
  });

  it('never checks in ignored, cloaked or hidden items', () => {
    const pending = [change('build.log', ['ignored']), change('src/gen.ts', ['hiddenChanged']), change('src/app.ts', ['changed'])];
    expect(pathsOf(filesCheckinChanges([item('build.log', { isPrivate: true }), folder('src')], pending))).toEqual(['src/app.ts']);
  });

  it('checks in nothing for items with nothing pending', () => {
    expect(filesCheckinChanges([item('app.ts'), folder('src')], [change('docs/a.md', ['changed'])])).toEqual([]);
  });

  it('takes a change once when both it and its folder are selected', () => {
    const pending = [change('src/app.ts', ['changed'])];
    expect(pathsOf(filesCheckinChanges([folder('src'), item('src/app.ts')], pending))).toEqual(['src/app.ts']);
  });
});
