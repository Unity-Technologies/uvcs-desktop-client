import { describe, expect, it } from 'vitest';
import { pageWindowQuery, startingPageIn, startingSeedIn, startingViewIn, startingWorkspaceIn, startingWorkspaceQuery } from './startingWorkspace';

/** The query as Electron's `loadFile(path, { query })` writes it into the page's address. */
const search = (query: Record<string, string>): string => `?${new URLSearchParams(query)}`;

describe('startingWorkspace', () => {
  it('names the workspace in the address and reads it back, whatever its path holds', () => {
    for (const path of ['/Users/ana/wk', 'C:\\Users\\Ana Díaz\\wk & co', '/tmp/a?b=c#d%20e']) {
      expect(startingWorkspaceIn(search(startingWorkspaceQuery(path)))).toBe(path);
    }
  });

  it('names none for a window on the home screen', () => {
    expect(startingWorkspaceQuery(undefined)).toEqual({});
    expect(startingWorkspaceQuery(undefined, 'branches')).toEqual({});
    expect(startingWorkspaceIn('')).toBeNull();
  });

  it('names the view a reopened window showed, and none otherwise', () => {
    expect(startingViewIn(search(startingWorkspaceQuery('/Users/ana/wk', 'branchExplorer')))).toBe('branchExplorer');
    expect(startingViewIn(search(startingWorkspaceQuery('/Users/ana/wk')))).toBeNull();
  });

  it("names a page window's workspace and page, read back whole whatever its paths and titles hold", () => {
    const page = { kind: 'diff', title: 'Changeset 7 — «año» & co', target: { kind: 'branch', branch: '/main/tarea?#%20' } };
    const address = search(pageWindowQuery('C:\\Users\\Ana Díaz\\wk', page));

    expect(startingWorkspaceIn(address)).toBe('C:\\Users\\Ana Díaz\\wk');
    expect(startingPageIn(address)).toEqual(page);
  });

  it("hands a page window the object its page shows, and nothing when there's none or it isn't one", () => {
    const page = { kind: 'diff', title: 'Shelve 4', target: { kind: 'shelve', shelveId: 4 } };
    const shelve = { id: 4, guid: 'aaaaaaaa-0000-0000-0000-000000000004', owner: 'ana', date: '2026-10-01T10:00:00Z', comment: 'Ña & co?', parentChangeset: 9, repository: 'game@local' };
    const seed = { readAt: 1_700_000_000_000, shelve };

    expect(startingSeedIn(search(pageWindowQuery('/wk', page, seed)))).toEqual(seed);
    expect(startingSeedIn(search(pageWindowQuery('/wk', page)))).toBeNull();
    expect(startingSeedIn(search({ seed: '{"shelve":{}}' }))).toBeNull();
    expect(startingSeedIn(search({ seed: 'nope' }))).toBeNull();
  });

  it('names no page for a workspace window, nor for an address whose page is not one', () => {
    expect(startingPageIn(search(startingWorkspaceQuery('/Users/ana/wk')))).toBeNull();
    expect(startingPageIn(search({ page: 'not json' }))).toBeNull();
    expect(startingPageIn(search({ page: '{"title":"no kind"}' }))).toBeNull();
    expect(startingPageIn(search({ page: 'null' }))).toBeNull();
  });
});
