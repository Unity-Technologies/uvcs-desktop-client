import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { listedEntries } from '../diff/listedEntries';
import { changedFilesView } from './changedFilesView';

const file = (path: string): DiffEntry => ({ status: 'added', path, itemType: 'file', baseRevisionId: -1, revisionId: 5, repository: 'game@local' });
const folder = (path: string): DiffEntry => ({ ...file(path), itemType: 'directory' });
const files = (count: number) => Array.from({ length: count }, (_, index) => file(`src/file${index}.ts`));

const asked = { matchingCount: 0, requested: true, failed: false, collapsed: false };
const read = (entries: DiffEntry[], matchingCount = entries.length) => ({ ...asked, listedCount: listedEntries(entries).length, matchingCount });

describe('changedFilesView', () => {
  it('offers to show the files until asked, reading nothing', () => {
    expect(changedFilesView({ ...asked, listedCount: undefined, requested: false })).toMatchObject({ title: 'Changes', offersToShow: true, loading: false, listsFiles: false, collapsible: false });
  });

  it('loads once asked, until the files are read or reading them fails', () => {
    expect(changedFilesView({ ...asked, listedCount: undefined })).toMatchObject({ offersToShow: false, loading: true });
    expect(changedFilesView({ ...asked, listedCount: undefined, failed: true })).toMatchObject({ offersToShow: false, loading: false });
  });

  it('counts the files as the diff lists them: a folder added with its files is one of them only through them', () => {
    const view = changedFilesView(read([folder('Assets'), file('Assets/hero.png'), file('Assets/hero.mat')]));

    expect(view).toMatchObject({ title: '2 files changed', listsFiles: true, expanded: true, collapsible: true, noChanges: false });
  });

  it('says there are no file changes when the diff lists none', () => {
    expect(changedFilesView(read([]))).toMatchObject({ title: '0 files changed', noChanges: true, listsFiles: false, expanded: false, layoutMenu: false });
  });

  it('gives a list past eight files its filter, which then holds the layout menu', () => {
    expect(changedFilesView(read(files(8)))).toMatchObject({ filters: false, layoutMenu: true });
    expect(changedFilesView(read(files(9)))).toMatchObject({ filters: true, layoutMenu: false });
  });

  it('says so when the filter hides every file', () => {
    expect(changedFilesView(read(files(9), 0))).toMatchObject({ noMatches: true, listsFiles: true });
    expect(changedFilesView(read(files(9), 3)).noMatches).toBe(false);
  });

  it('keeps only its title while hidden, which shows the list again', () => {
    expect(changedFilesView({ ...read(files(9)), collapsed: true })).toEqual({
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
