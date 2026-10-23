import { describe, expect, it } from 'vitest';
import { nextRepositoryFileSearch, repositoryFileSearchView, searchesFor, type RepositoryFileSearch } from './repositoryFileSearch';

const player = { path: 'Assets/Player.cs', isDirectory: false };
const readme = { path: 'README.md', isDirectory: false };

describe('searchesFor', () => {
  it('searches from two characters on, spaces aside', () => {
    expect(searchesFor('')).toBe(false);
    expect(searchesFor('p')).toBe(false);
    expect(searchesFor(' p ')).toBe(false);
    expect(searchesFor('pl')).toBe(true);
    expect(searchesFor('p l')).toBe(true);
  });
});

describe('nextRepositoryFileSearch', () => {
  const searching = (searchId: string, paths = [player]): RepositoryFileSearch => ({ kind: 'searching', searchId, paths, source: 'server' });

  it('shows the best results as they come, then all of them', () => {
    let search = nextRepositoryFileSearch({ kind: 'tooShort' }, { kind: 'started', searchId: 's1' });
    expect(search).toEqual({ kind: 'searching', searchId: 's1', paths: [], source: null });

    search = nextRepositoryFileSearch(search, { kind: 'progress', searchId: 's1', paths: [player], source: 'server' });
    expect(search).toEqual(searching('s1'));

    expect(nextRepositoryFileSearch(search, { kind: 'found', searchId: 's1', paths: [player, readme] })).toEqual({ kind: 'found', paths: [player, readme] });
    expect(nextRepositoryFileSearch(search, { kind: 'failed', searchId: 's1', message: 'Offline' })).toEqual({ kind: 'failed', message: 'Offline' });
  });

  it("keeps the last search's results on screen until a new search's own come", () => {
    expect(nextRepositoryFileSearch({ kind: 'found', paths: [player] }, { kind: 'started', searchId: 's2' })).toEqual({ kind: 'searching', searchId: 's2', paths: [player], source: null });
    expect(nextRepositoryFileSearch(searching('s1'), { kind: 'started', searchId: 's2' })).toEqual({ kind: 'searching', searchId: 's2', paths: [player], source: null });
    expect(nextRepositoryFileSearch({ kind: 'failed', message: 'Offline' }, { kind: 'started', searchId: 's2' })).toEqual({ kind: 'searching', searchId: 's2', paths: [], source: null });
  });

  it('ignores what a search a newer query replaced tells, or one cleared by a query too short', () => {
    const current = searching('s2');
    expect(nextRepositoryFileSearch(current, { kind: 'progress', searchId: 's1', paths: [readme], source: 'disk' })).toBe(current);
    expect(nextRepositoryFileSearch(current, { kind: 'found', searchId: 's1', paths: [readme] })).toBe(current);
    expect(nextRepositoryFileSearch(current, { kind: 'failed', searchId: 's1', message: 'Offline' })).toBe(current);

    const cleared = nextRepositoryFileSearch(current, { kind: 'tooShort' });
    expect(cleared).toEqual({ kind: 'tooShort' });
    expect(nextRepositoryFileSearch(cleared, { kind: 'found', searchId: 's2', paths: [readme] })).toBe(cleared);
  });
});

describe('repositoryFileSearchView', () => {
  it('asks for two characters before anything is searched', () => {
    expect(repositoryFileSearchView({ kind: 'tooShort' }, 'p', '/main')).toEqual({ paths: [], loading: false, note: 'Type 2 or more characters to find a file in /main.' });
  });

  it('waits for the first results, saying the first search reads the files from the server, and a later one only searches', () => {
    const waiting = (source: 'server' | 'disk' | null) => repositoryFileSearchView({ kind: 'searching', searchId: 's1', paths: [], source }, 'player', '/main');
    expect(waiting(null)).toEqual({ paths: [], loading: true, note: 'Reading the files of /main from the server…' });
    expect(waiting('server').note).toBe('Reading the files of /main from the server…');
    expect(waiting('disk').note).toBe('Searching…');
  });

  it('shows the results, found or still coming, and says nothing beside them', () => {
    expect(repositoryFileSearchView({ kind: 'searching', searchId: 's1', paths: [player], source: 'server' }, 'player', '/main')).toEqual({ paths: [player], loading: false, note: null });
    expect(repositoryFileSearchView({ kind: 'found', paths: [player] }, 'player', '/main')).toEqual({ paths: [player], loading: false, note: null });
  });

  it('says when nothing matched, and why a search failed', () => {
    expect(repositoryFileSearchView({ kind: 'found', paths: [] }, ' zzz ', '/main')).toEqual({ paths: [], loading: false, note: 'No files match “zzz”.' });
    expect(repositoryFileSearchView({ kind: 'failed', message: 'The server is not available' }, 'player', '/main')).toEqual({
      paths: [],
      loading: false,
      note: "Couldn't search the files: The server is not available",
    });
  });
});
