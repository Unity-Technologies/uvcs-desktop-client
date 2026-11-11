import { describe, expect, it } from 'vitest';
import {
  listsTreeNow,
  nextRepositoryFileSearch,
  repositoryFileSearchKey,
  repositoryFileSearchView,
  searchesFor,
  type RepositoryFileSearch,
  type RepositoryFileSearchView,
} from './repositoryFileSearch';

const player = { path: 'Assets/Player.cs', isDirectory: false };
const readme = { path: 'README.md', isDirectory: false };

describe('searchesFor', () => {
  it('searches from the first character, spaces aside', () => {
    expect(searchesFor('')).toBe(false);
    expect(searchesFor('  ')).toBe(false);
    expect(searchesFor('p')).toBe(true);
    expect(searchesFor(' p ')).toBe(true);
  });
});

describe('listsTreeNow', () => {
  it('lists the tree only once something is typed', () => {
    expect(listsTreeNow(12, '')).toBe(false);
    expect(listsTreeNow(12, '   ')).toBe(false);
    expect(listsTreeNow(12, 'p')).toBe(true);
  });

  it('lists nothing while there is no changeset to search', () => {
    expect(listsTreeNow(null, 'p')).toBe(false);
  });
});

describe('nextRepositoryFileSearch', () => {
  const searching = (searchId: string, query = 'player', paths = [player]): RepositoryFileSearch => ({
    kind: 'searching',
    searchId,
    query,
    results: { query, paths },
    source: 'server',
  });

  it('shows the best results as they come, then all of them, each tied to the query searched', () => {
    let search = nextRepositoryFileSearch({ kind: 'empty' }, { kind: 'started', searchId: 's1', query: 'player' });
    expect(search).toEqual({ kind: 'searching', searchId: 's1', query: 'player', results: null, source: null });

    search = nextRepositoryFileSearch(search, { kind: 'progress', searchId: 's1', paths: [player], source: 'server' });
    expect(search).toEqual(searching('s1'));

    expect(nextRepositoryFileSearch(search, { kind: 'found', searchId: 's1', paths: [player, readme] })).toEqual({
      kind: 'found',
      results: { query: 'player', paths: [player, readme] },
    });
    expect(nextRepositoryFileSearch(search, { kind: 'failed', searchId: 's1', message: 'Offline' })).toEqual({
      kind: 'failed',
      message: 'Offline',
    });
  });

  it("keeps the last search's results, and the query they answer, until a new search's own come", () => {
    const shown = { query: 'pla', paths: [player] };
    expect(nextRepositoryFileSearch({ kind: 'found', results: shown }, { kind: 'started', searchId: 's2', query: 'play' })).toEqual({
      kind: 'searching',
      searchId: 's2',
      query: 'play',
      results: shown,
      source: null,
    });
    expect(nextRepositoryFileSearch(searching('s1', 'pla'), { kind: 'started', searchId: 's2', query: 'play' })).toMatchObject({
      query: 'play',
      results: shown,
    });
    expect(nextRepositoryFileSearch({ kind: 'failed', message: 'Offline' }, { kind: 'started', searchId: 's2', query: 'play' })).toMatchObject({
      results: null,
    });
  });

  it('ignores what a search a newer query replaced tells, or one cleared by emptying the query', () => {
    const current = searching('s2');
    expect(nextRepositoryFileSearch(current, { kind: 'progress', searchId: 's1', paths: [readme], source: 'disk' })).toBe(current);
    expect(nextRepositoryFileSearch(current, { kind: 'found', searchId: 's1', paths: [readme] })).toBe(current);
    expect(nextRepositoryFileSearch(current, { kind: 'failed', searchId: 's1', message: 'Offline' })).toBe(current);

    const cleared = nextRepositoryFileSearch(current, { kind: 'empty' });
    expect(cleared).toEqual({ kind: 'empty' });
    expect(nextRepositoryFileSearch(cleared, { kind: 'found', searchId: 's2', paths: [readme] })).toBe(cleared);
  });
});

describe('repositoryFileSearchView', () => {
  const folder = { path: 'Assets', isDirectory: true };

  it('asks for a name before anything is searched', () => {
    expect(repositoryFileSearchView({ kind: 'empty' }, '', '/main')).toEqual({
      rows: [],
      loading: false,
      note: 'Type a name to find a file in /main.',
      current: false,
    });
  });

  it('waits for the first results, saying the first search reads the files from the server, and a later one only searches', () => {
    const waiting = (source: 'server' | 'disk' | null) =>
      repositoryFileSearchView({ kind: 'searching', searchId: 's1', query: 'player', results: null, source }, 'player', '/main');
    expect(waiting(null)).toEqual({ rows: [], loading: true, note: 'Reading the files of /main from the server…', current: false });
    expect(waiting('server').note).toBe('Reading the files of /main from the server…');
    expect(waiting('disk').note).toBe('Searching…');
  });

  it('draws each result with its icon and the characters the query matched, and says nothing beside them', () => {
    expect(repositoryFileSearchView({ kind: 'found', results: { query: 'as', paths: [folder, player] } }, 'as', '/main')).toEqual({
      rows: [
        { path: 'Assets', itemType: 'directory', matches: [0, 1] },
        { path: 'Assets/Player.cs', itemType: 'file', matches: [0, 1] },
      ],
      loading: false,
      note: null,
      current: true,
    });
    const coming = repositoryFileSearchView(
      { kind: 'searching', searchId: 's1', query: 'player', results: { query: 'player', paths: [player] }, source: 'server' },
      'player',
      '/main',
    );
    expect(coming).toMatchObject({ loading: false, note: null, current: true });
  });

  it("isn't current while its results answer a query the user typed past", () => {
    const search: RepositoryFileSearch = { kind: 'found', results: { query: 'pla', paths: [player] } };
    expect(repositoryFileSearchView(search, 'plan', '/main').current).toBe(false);
  });

  it('says when nothing matched, and why a search failed', () => {
    expect(repositoryFileSearchView({ kind: 'found', results: { query: ' zzz ', paths: [] } }, ' zzz ', '/main').note).toBe(
      'No files match “zzz”.',
    );
    expect(repositoryFileSearchView({ kind: 'failed', message: 'The server is not available' }, 'player', '/main')).toEqual({
      rows: [],
      loading: false,
      note: "Couldn't search the files: The server is not available",
      current: false,
    });
  });
});

describe('repositoryFileSearchKey', () => {
  const rowsOf = (paths: string[], current = true): RepositoryFileSearchView => ({
    rows: paths.map((path) => ({ path, itemType: 'file', matches: [] })),
    loading: false,
    note: null,
    current,
  });

  it('picks the highlighted result on Enter', () => {
    expect(repositoryFileSearchKey('Enter', 1, rowsOf(['a.cs', 'b.cs']))).toEqual({ kind: 'pick', path: 'b.cs' });
  });

  it('picks nothing on Enter while the results answer an older query', () => {
    expect(repositoryFileSearchKey('Enter', 0, rowsOf(['a.cs'], false))).toBeNull();
  });

  it('picks the last result when the highlight sat past fewer results', () => {
    expect(repositoryFileSearchKey('Enter', 5, rowsOf(['a.cs', 'b.cs']))).toEqual({ kind: 'pick', path: 'b.cs' });
  });

  it('moves the highlight with the arrows, even over results still settling', () => {
    expect(repositoryFileSearchKey('ArrowDown', 0, rowsOf(['a.cs', 'b.cs'], false))).toEqual({ kind: 'highlight', index: 1 });
    expect(repositoryFileSearchKey('ArrowUp', 1, rowsOf(['a.cs', 'b.cs']))).toEqual({ kind: 'highlight', index: 0 });
  });

  it('picks nothing without results', () => {
    expect(repositoryFileSearchKey('Enter', 0, rowsOf([]))).toBeNull();
  });
});
