import { describe, expect, it } from 'vitest';
import { startingWorkspaceIn, startingWorkspaceQuery } from './startingWorkspace';

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
    expect(startingWorkspaceIn('')).toBeNull();
  });
});
