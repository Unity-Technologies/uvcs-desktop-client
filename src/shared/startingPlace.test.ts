import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from './domain/place';
import { pageWindowQuery, startingPageIn, startingPlaceIn, startingPlaceQuery, startingSeedIn, startingViewIn } from './startingPlace';

/** The query as Electron's `loadFile(path, { query })` writes it into the page's address. */
const search = (query: Record<string, string>): string => `?${new URLSearchParams(query)}`;

describe('startingPlace', () => {
  it('names the workspace in the address and reads it back, whatever its path holds', () => {
    for (const path of ['/Users/ana/wk', 'C:\\Users\\Ana Díaz\\wk & co', '/tmp/a?b=c#d%20e']) {
      expect(startingPlaceIn(search(startingPlaceQuery(workspacePlace(path))))).toEqual(workspacePlace(path));
    }
  });

  it('names a repository explored without a workspace, a Unity organization\'s too', () => {
    for (const repository of ['game@local', 'game@acme@cloud', 'art&co@localhost:8087']) {
      expect(startingPlaceIn(search(startingPlaceQuery(repositoryPlace(repository))))).toEqual(repositoryPlace(repository));
    }
  });

  it('names none for a window on the home screen', () => {
    expect(startingPlaceQuery(undefined)).toEqual({});
    expect(startingPlaceQuery(undefined, 'branches')).toEqual({});
    expect(startingPlaceIn('')).toBeNull();
  });

  it('names the view a reopened window showed, and none otherwise', () => {
    expect(startingViewIn(search(startingPlaceQuery(workspacePlace('/Users/ana/wk'), 'branchExplorer')))).toBe('branchExplorer');
    expect(startingViewIn(search(startingPlaceQuery(repositoryPlace('game@local'), 'labels')))).toBe('labels');
    expect(startingViewIn(search(startingPlaceQuery(workspacePlace('/Users/ana/wk'))))).toBeNull();
  });

  it("names a page window's place and page, read back whole whatever its paths and titles hold", () => {
    const page = { kind: 'diff', title: 'Changeset 7 — «año» & co', target: { kind: 'branch', branch: '/main/tarea?#%20' } };
    const address = search(pageWindowQuery(workspacePlace('C:\\Users\\Ana Díaz\\wk'), page));

    expect(startingPlaceIn(address)).toEqual(workspacePlace('C:\\Users\\Ana Díaz\\wk'));
    expect(startingPageIn(address)).toEqual(page);
    expect(startingPlaceIn(search(pageWindowQuery(repositoryPlace('game@local'), page)))).toEqual(repositoryPlace('game@local'));
  });

  it("hands a page window the object its page shows, and nothing when there's none or it isn't one", () => {
    const page = { kind: 'diff', title: 'Shelve 4', target: { kind: 'shelve', shelveId: 4 } };
    const shelve = { id: 4, guid: 'aaaaaaaa-0000-0000-0000-000000000004', owner: 'ana', date: '2026-10-01T10:00:00Z', comment: 'Ña & co?', parentChangeset: 9, repository: 'game@local' };
    const seed = { readAt: 1_700_000_000_000, shelve };

    expect(startingSeedIn(search(pageWindowQuery(workspacePlace('/wk'), page, seed)))).toEqual(seed);
    expect(startingSeedIn(search(pageWindowQuery(workspacePlace('/wk'), page)))).toBeNull();
    expect(startingSeedIn(search({ seed: '{"shelve":{}}' }))).toBeNull();
    expect(startingSeedIn(search({ seed: 'nope' }))).toBeNull();
  });

  it('names no page for a window of a place, nor for an address whose page is not one', () => {
    expect(startingPageIn(search(startingPlaceQuery(workspacePlace('/Users/ana/wk'))))).toBeNull();
    expect(startingPageIn(search({ page: 'not json' }))).toBeNull();
    expect(startingPageIn(search({ page: '{"title":"no kind"}' }))).toBeNull();
    expect(startingPageIn(search({ page: 'null' }))).toBeNull();
  });
});
