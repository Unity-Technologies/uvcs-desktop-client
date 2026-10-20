import { describe, expect, it } from 'vitest';
import { diffPaneOf } from './diffPane';

const nothingSelected = { entrySelected: false, folderSelected: false };

describe('diffPaneOf', () => {
  it('stays blank while the files are read', () => {
    expect(diffPaneOf({ listedCount: undefined, shownCount: 0, ...nothingSelected })).toBe('blank');
  });

  it('says there are no differences when the diff lists no file', () => {
    expect(diffPaneOf({ listedCount: 0, shownCount: 0, ...nothingSelected })).toBe('noDifferences');
  });

  it('shows the diff of the file selected, or what the folder selected holds', () => {
    expect(diffPaneOf({ listedCount: 3, shownCount: 3, entrySelected: true, folderSelected: false })).toBe('entry');
    expect(diffPaneOf({ listedCount: 3, shownCount: 3, entrySelected: false, folderSelected: true })).toBe('folder');
    expect(diffPaneOf({ listedCount: 3, shownCount: 3, ...nothingSelected })).toBe('blank');
  });

  it('has no match while filters hide every file, even with one still selected', () => {
    expect(diffPaneOf({ listedCount: 2, shownCount: 0, entrySelected: true, folderSelected: false })).toBe('noMatches');
  });
});
