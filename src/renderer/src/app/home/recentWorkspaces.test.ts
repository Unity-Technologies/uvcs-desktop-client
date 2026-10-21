import { describe, expect, it } from 'vitest';
import { describedEntry, entryMatches, headsNamingRepository, recentWorkspaceEntries, unlistedRecentPaths } from './recentWorkspaces';

const game = { name: 'game', path: '/wk/game', guid: 'g1' };
const tools = { name: 'tools', path: '/wk/tools', guid: 'g2' };

describe('recent workspaces', () => {
  it("leaves to cm the workspaces whose head doesn't name their repository (a Unity organization's)", () => {
    const branch = { kind: 'branch', name: '/main' } as const;
    const heads = { '/wk/game': { repository: 'game@local', repositoryName: 'game', selector: branch }, '/wk/cloud': { repository: null, repositoryName: '3dtest/cloud', selector: branch } };

    expect(Object.keys(headsNamingRepository(heads))).toEqual(['/wk/game']);
    expect(headsNamingRepository(undefined)).toEqual({});
  });

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

describe('describedEntry', () => {
  const branch = { kind: 'branch', name: '/main' } as const;
  // A Unity organization's workspace whose server `cm wi` names only by an id.
  const cloudHead = { repository: null, repositoryName: '3dtest/cloud', selector: branch };
  const cloud = { workspace: { name: 'cloud', path: '/wk/cloud', guid: 'g3' }, missing: false };

  it("keeps the repository's name from its head while cm hasn't named its server", () => {
    const described = describedEntry(cloud, cloudHead, {});

    expect(described).toEqual({ ...cloud, repository: undefined, repositoryName: '3dtest/cloud', selector: branch });
    expect(entryMatches(described, '3dtest')).toBe(true);
  });

  it('takes the whole repository from cm once it names it, and from the file when it does', () => {
    expect(describedEntry(cloud, cloudHead, { '/wk/cloud': '3dtest/cloud@AcmeStudio@unity' })).toMatchObject({ repository: '3dtest/cloud@AcmeStudio@unity', repositoryName: '3dtest/cloud' });
    expect(describedEntry({ workspace: game, missing: false }, { repository: 'game@local', repositoryName: 'game', selector: branch }, {})).toMatchObject({ repository: 'game@local', repositoryName: 'game' });
    expect(describedEntry({ workspace: game, missing: false }, undefined, { '/wk/game': null })).toEqual({ workspace: game, missing: false, repository: null, repositoryName: undefined, selector: null });
  });
});
