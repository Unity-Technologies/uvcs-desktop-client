import { describe, expect, it } from 'vitest';
import { repositoryFileSearchNote, searchesFor } from './repositoryFileSearch';

const player = { path: 'Assets/Player.cs', isDirectory: false };

describe('searchesFor', () => {
  it('searches from two characters on, spaces aside', () => {
    expect(searchesFor('')).toBe(false);
    expect(searchesFor('p')).toBe(false);
    expect(searchesFor(' p ')).toBe(false);
    expect(searchesFor('pl')).toBe(true);
    expect(searchesFor('p l')).toBe(true);
  });
});

describe('repositoryFileSearchNote', () => {
  it('asks for two characters before anything is searched', () => {
    expect(repositoryFileSearchNote({ kind: 'tooShort' }, 'p', '/main')).toBe('Type 2 or more characters to find a file in /main.');
  });

  it('says the first search reads the files from the server, and a later one only searches', () => {
    expect(repositoryFileSearchNote({ kind: 'searching', paths: [], source: null }, 'player', '/main')).toBe('Reading the files of /main from the server…');
    expect(repositoryFileSearchNote({ kind: 'searching', paths: [], source: 'server' }, 'player', '/main')).toBe('Reading the files of /main from the server…');
    expect(repositoryFileSearchNote({ kind: 'searching', paths: [], source: 'disk' }, 'player', '/main')).toBe('Searching…');
  });

  it('says nothing once there are results, found or still coming', () => {
    expect(repositoryFileSearchNote({ kind: 'searching', paths: [player], source: 'server' }, 'player', '/main')).toBeNull();
    expect(repositoryFileSearchNote({ kind: 'found', paths: [player] }, 'player', '/main')).toBeNull();
  });

  it('says when nothing matched, and why a search failed', () => {
    expect(repositoryFileSearchNote({ kind: 'found', paths: [] }, ' zzz ', '/main')).toBe('No files match “zzz”.');
    expect(repositoryFileSearchNote({ kind: 'failed', message: 'The server is not available' }, 'player', '/main')).toBe("Couldn't search the files: The server is not available");
  });
});
