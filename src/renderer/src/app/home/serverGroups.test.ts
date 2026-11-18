import { describe, expect, it } from 'vitest';
import { serverEntryDetail, serverGroups } from './serverGroups';

const profile = (server: string) => ({ server, user: 'ana', workingMode: 'SSOWorkingMode' });

describe('serverGroups', () => {
  it('groups Unity organizations, then cloud organizations, then the servers, this computer first', () => {
    const groups = serverGroups(['local', 'codice@cloud', 'snakes-org@unity', 'build:8087', 'MyCroquerOrg@unity', 'libra4d@cloud'].map(profile));

    expect(groups.map(({ label, servers }) => [label, servers.map((listed) => listed.server)])).toEqual([
      ['Unity organizations', ['MyCroquerOrg@unity', 'snakes-org@unity']],
      ['Cloud organizations', ['codice@cloud', 'libra4d@cloud']],
      ['Servers', ['local', 'build:8087']],
    ]);
  });

  it('orders by name whatever the case, as people read them', () => {
    const groups = serverGroups(['unity@unity', 'alvaroberruezo@unity', 'Muse-tools@unity'].map(profile));

    expect(groups[0]?.servers.map((listed) => listed.server)).toEqual(['alvaroberruezo@unity', 'Muse-tools@unity', 'unity@unity']);
  });

  it('leaves out a kind the user has none of', () => {
    expect(serverGroups([profile('local')]).map((group) => group.label)).toEqual(['Servers']);
    expect(serverGroups([])).toEqual([]);
  });
});

describe('serverEntryDetail', () => {
  it("shows a server's user, open or folded", () => {
    expect(serverEntryDetail(profile('build:8087'), false)).toBe('ana');
    expect(serverEntryDetail(profile('build:8087'), true)).toBe('ana');
  });

  it('shows no user for an organization, whose account the switcher names, nor for this computer', () => {
    expect(serverEntryDetail(profile('acme@unity'), false)).toBeUndefined();
    expect(serverEntryDetail(profile('local'), false)).toBeUndefined();
  });

  it("shows an organization's kind folded, where the groups' titles don't show", () => {
    expect(serverEntryDetail(profile('acme@unity'), true)).toBe('Unity organization');
    expect(serverEntryDetail(profile('acme@cloud'), true)).toBe('Cloud organization');
  });

  it('shows nothing for a server whose user is unknown', () => {
    expect(serverEntryDetail({ server: 'build:8087', user: '', workingMode: '' }, false)).toBeUndefined();
  });
});
