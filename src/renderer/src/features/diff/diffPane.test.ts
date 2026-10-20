import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { diffPaneOf } from './diffPane';
import { listedEntries } from './listedEntries';

const entry = (path: string, itemType: DiffEntry['itemType'] = 'file', status: DiffEntry['status'] = 'added'): DiffEntry => ({
  status,
  path,
  itemType,
  baseRevisionId: -1,
  revisionId: 5,
  repository: 'game@local',
});
const listed = (entries: DiffEntry[]) => listedEntries(entries).length;
const nothingSelected = { entrySelected: false, folderSelected: false };

describe('diffPaneOf', () => {
  it('stays blank while the files are read', () => {
    expect(diffPaneOf({ listedCount: undefined, shownCount: 0, ...nothingSelected })).toBe('blank');
  });

  it('says there are no differences when the diff lists no file', () => {
    expect(diffPaneOf({ listedCount: listed([]), shownCount: 0, ...nothingSelected })).toBe('noDifferences');
  });

  it('shows the diff of the file selected, or what the folder selected holds', () => {
    const count = listed([entry('Assets', 'directory'), entry('Assets/hero.png'), entry('src/app.ts', 'file', 'changed')]);

    expect(diffPaneOf({ listedCount: count, shownCount: count, entrySelected: true, folderSelected: false })).toBe('entry');
    expect(diffPaneOf({ listedCount: count, shownCount: count, entrySelected: false, folderSelected: true })).toBe('folder');
    expect(diffPaneOf({ listedCount: count, shownCount: count, ...nothingSelected })).toBe('blank');
  });

  it('stays blank while filters hide every file, even with one still selected', () => {
    expect(diffPaneOf({ listedCount: 2, shownCount: 0, entrySelected: true, folderSelected: false })).toBe('blank');
  });
});
