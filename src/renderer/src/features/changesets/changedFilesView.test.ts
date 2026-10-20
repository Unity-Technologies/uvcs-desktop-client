import { describe, expect, it } from 'vitest';
import { changedFilesView } from './changedFilesView';

const asked = { matchingCount: 0, requested: true, failed: false, collapsed: false };
const read = (listedCount: number, matchingCount = listedCount) => ({ ...asked, listedCount, matchingCount });

describe('changedFilesView', () => {
  it('offers to show the files until asked, reading nothing', () => {
    expect(changedFilesView({ ...asked, listedCount: undefined, requested: false })).toMatchObject({ title: 'Changes', offersToShow: true, loading: false, listsFiles: false, collapsible: false });
  });

  it('loads once asked, until the files are read or reading them fails', () => {
    expect(changedFilesView({ ...asked, listedCount: undefined })).toMatchObject({ offersToShow: false, loading: true });
    expect(changedFilesView({ ...asked, listedCount: undefined, failed: true })).toMatchObject({ offersToShow: false, loading: false });
  });

  it('counts the files the diff lists', () => {
    expect(changedFilesView(read(2))).toMatchObject({ title: '2 files changed', listsFiles: true, expanded: true, collapsible: true, noChanges: false });
    expect(changedFilesView(read(1)).title).toBe('1 file changed');
  });

  it('says there are no file changes when the diff lists none', () => {
    expect(changedFilesView(read(0))).toMatchObject({ title: '0 files changed', noChanges: true, listsFiles: false, expanded: false, layoutMenu: false });
  });

  it('gives a list past eight files its filter, which then holds the layout menu', () => {
    expect(changedFilesView(read(8))).toMatchObject({ filters: false, layoutMenu: true });
    expect(changedFilesView(read(9))).toMatchObject({ filters: true, layoutMenu: false });
  });

  it('says so when the filter hides every file', () => {
    expect(changedFilesView(read(9, 0))).toMatchObject({ noMatches: true, listsFiles: true });
    expect(changedFilesView(read(9, 3)).noMatches).toBe(false);
  });

  it('keeps only its title while hidden, which shows the list again', () => {
    expect(changedFilesView({ ...read(9), collapsed: true })).toEqual({
      title: '9 files changed',
      offersToShow: false,
      loading: false,
      noChanges: false,
      filters: false,
      noMatches: false,
      listsFiles: false,
      layoutMenu: false,
      expanded: false,
      collapsible: true,
    });
  });
});
