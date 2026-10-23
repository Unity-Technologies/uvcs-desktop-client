import { describe, expect, it } from 'vitest';
import { serverGroups } from './serverGroups';

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
