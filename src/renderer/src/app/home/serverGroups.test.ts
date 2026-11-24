import { describe, expect, it } from 'vitest';
import { canBeFavorite, favoriteButtonLabel, ORGANIZATION_FILTER_MIN, serverEntryDetail, serverGroups, showsOrganizationFilter } from './serverGroups';

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

describe('serverGroups with favorites', () => {
  const servers = ['local', 'codice@cloud', 'data@cloud', 'snakes-org@unity', 'unity@unity', 'build:8087'].map(profile);
  const listed = (groups: ReturnType<typeof serverGroups>) => groups.map(({ label, servers: inGroup }) => [label, inGroup.map((entry) => entry.server)]);

  it('lists the favorites first, by name, and only there', () => {
    expect(listed(serverGroups(servers, { favorites: ['unity@unity', 'data@cloud'] }))).toEqual([
      ['Favorites', ['data@cloud', 'unity@unity']],
      ['Unity organizations', ['snakes-org@unity']],
      ['Cloud organizations', ['codice@cloud']],
      ['Servers', ['local', 'build:8087']],
    ]);
  });

  it('leaves out a group whose every organization is a favorite', () => {
    expect(listed(serverGroups(servers, { favorites: ['snakes-org@unity', 'unity@unity'] })).map(([label]) => label)).toEqual([
      'Favorites',
      'Cloud organizations',
      'Servers',
    ]);
  });

  it("ignores a favorite the account doesn't hold, and a server, which can't be one", () => {
    expect(listed(serverGroups(servers, { favorites: ['other@unity', 'build:8087'] }))[0]).toEqual(['Unity organizations', ['snakes-org@unity', 'unity@unity']]);
  });

  it('matches a favorite whatever its case', () => {
    expect(listed(serverGroups(servers, { favorites: ['Unity@unity'] }))[0]).toEqual(['Favorites', ['unity@unity']]);
  });
});

describe('serverGroups with a filter', () => {
  const servers = ['local', 'core_prod_az_eastus@cloud', 'core_int_gcp_westeu@cloud', 'codice@cloud', 'Core-Tools@unity'].map(profile);

  it('lists the organizations whose name holds the text, whatever its case', () => {
    expect(serverGroups(servers, { filter: 'CORE' }).map(({ label, servers: inGroup }) => [label, inGroup.map((entry) => entry.server)])).toEqual([
      ['Unity organizations', ['Core-Tools@unity']],
      ['Cloud organizations', ['core_int_gcp_westeu@cloud', 'core_prod_az_eastus@cloud']],
      ['Servers', ['local']],
    ]);
  });

  it('takes each word typed, in any order, as every list filter does', () => {
    expect(serverGroups(servers, { filter: 'eastus prod' })[0]).toEqual({ label: 'Cloud organizations', servers: [profile('core_prod_az_eastus@cloud')] });
  });

  it('matches the name shown, not the kind after it', () => {
    expect(serverGroups(servers, { filter: 'cloud' }).map((group) => group.label)).toEqual(['Servers']);
  });

  it('keeps this computer and the servers, which it never filters', () => {
    expect(serverGroups([...servers, profile('build:8087')], { filter: 'zzz' }).map(({ servers: inGroup }) => inGroup.map((entry) => entry.server))).toEqual([
      ['local', 'build:8087'],
    ]);
  });

  it('filters the favorites too', () => {
    const groups = serverGroups(servers, { favorites: ['codice@cloud', 'core_prod_az_eastus@cloud'], filter: 'prod' });
    expect(groups.map(({ label, servers: inGroup }) => [label, inGroup.map((entry) => entry.server)])).toEqual([
      ['Favorites', ['core_prod_az_eastus@cloud']],
      ['Servers', ['local']],
    ]);
  });

  it('lists everything with no text, or only spaces', () => {
    expect(serverGroups(servers, { filter: '  ' })).toEqual(serverGroups(servers));
  });
});

describe('showsOrganizationFilter', () => {
  const organizations = (count: number) => Array.from({ length: count }, (_, index) => profile(index % 2 ? `org${index}@unity` : `org${index}@cloud`));

  it('offers the filter from ten organizations, Unity and cloud ones together', () => {
    expect(ORGANIZATION_FILTER_MIN).toBe(10);
    expect(showsOrganizationFilter(organizations(9))).toBe(false);
    expect(showsOrganizationFilter(organizations(10))).toBe(true);
  });

  it("doesn't count this computer or the servers", () => {
    expect(showsOrganizationFilter([...organizations(9), profile('local'), profile('build:8087')])).toBe(false);
  });
});

describe('canBeFavorite', () => {
  it('takes organizations, not this computer or a server', () => {
    expect(['acme@unity', 'acme@cloud', 'local', 'build:8087'].map(canBeFavorite)).toEqual([true, true, false, false]);
  });
});

describe('favoriteButtonLabel', () => {
  it('names the organization, as a sidebar holds one star per organization', () => {
    expect(favoriteButtonLabel('acme', false)).toBe('Add acme to favorites');
    expect(favoriteButtonLabel('acme', true)).toBe('Remove acme from favorites');
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
