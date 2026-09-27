import { describe, expect, it } from 'vitest';
import { entryMatches, recentWorkspaceEntries, unlistedRecentPaths } from './recentWorkspaces';

const game = { name: 'game', path: '/wk/game', guid: 'g1' };
const tools = { name: 'tools', path: '/wk/tools', guid: 'g2' };

describe('recent workspaces', () => {
  it('finds the recent paths cm does not list', () => {
    expect(unlistedRecentPaths([game, tools], ['/wk/gone', '/wk/game'])).toEqual(['/wk/gone']);
  });

  it('keeps recent order and names missing folders after their last segment', () => {
    const entries = recentWorkspaceEntries([game, tools], ['/wk/tools', '/old/art', '/wk/game'], ['/old/art']);
    expect(entries).toEqual([
      { workspace: tools, missing: false },
      { workspace: { name: 'art', path: '/old/art', guid: '/old/art' }, missing: true },
      { workspace: game, missing: false },
    ]);
  });

  it('skips unlisted paths whose folder still exists', () => {
    expect(recentWorkspaceEntries([game], ['/wk/unregistered', '/wk/game'], [])).toEqual([{ workspace: game, missing: false }]);
  });
});

describe('entryMatches', () => {
  const entry = { workspace: game, missing: false, repository: 'space-racer@local', selector: { kind: 'branch' as const, name: '/main/task-7' } };

  it('finds every word of the search anywhere in the name, path, repository or branch', () => {
    expect(entryMatches(entry, 'racer task-7')).toBe(true);
    expect(entryMatches(entry, 'GAME /wk')).toBe(true);
    expect(entryMatches(entry, 'racer art')).toBe(false);
  });

  it('ignores the spaces around the search, and matches everything without one', () => {
    expect(entryMatches(entry, ' game ')).toBe(true);
    expect(entryMatches(entry, '  ')).toBe(true);
  });
});
