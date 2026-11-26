import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';
import { cmFails, fakeCmClient } from '../cm/testing/fakeCmClient';
import { UnityOrganizationIds } from '../cm/UnityOrganizationIds';
import { OrganizationRenames } from './OrganizationRenames';

/** Settings held in memory, as `SettingsStore` holds them, and the ids `cm getconfig organization` prints by name. */
function renamesOver(settings: Partial<AppSettings>, idsByName: Record<string, string>) {
  let current: AppSettings = { ...DEFAULT_SETTINGS, ...settings };
  let writes = 0;
  const store = {
    get: () => current,
    update: (changes: Partial<AppSettings>) => {
      writes++;
      return (current = { ...current, ...changes });
    },
  };
  const fake = fakeCmClient({
    'getconfig organization': ({ args }) => idsByName[args[2]!] ?? cmFails(`Organization configuration not found for '${args[2]}'.`),
  });
  return { ...fake, renames: new OrganizationRenames(store, new UnityOrganizationIds(fake.cm)), settings: () => current, writes: () => writes };
}

describe('OrganizationRenames', () => {
  it("keeps a favorite and the project picked through the organization's rename, the old name still listed", async () => {
    const before = renamesOver({ favoriteOrganizations: ['acme@unity'], serverSettings: { 'acme@unity': { homeProject: 'Racing' } } }, { 'acme@unity': '1375943370549\n' });
    await before.renames.follow(['acme@unity', 'arcade@unity']);

    // A later session: cm knows the organization by its new name only, and the old profile is still there.
    const after = renamesOver(before.settings(), { 'acmestudio@unity': '1375943370549\n' });
    await after.renames.follow(['acme@unity', 'acmestudio@unity', 'arcade@unity']);

    expect(after.settings().favoriteOrganizations).toEqual(['acmestudio@unity']);
    expect(after.settings().serverSettings).toEqual({ 'acmestudio@unity': { homeProject: 'Racing', organizationId: '1375943370549' } });
  });

  it('reads each id once for the session, and asks and writes nothing while no organization keeps anything', async () => {
    const quiet = renamesOver({}, {});
    await quiet.renames.follow(['acme@unity', 'arcade@unity']);
    expect(quiet.lines()).toEqual([]);

    const { renames, lines, writes } = renamesOver({ favoriteOrganizations: ['acme@unity'] }, { 'acme@unity': '1375943370549\n' });
    await renames.follow(['acme@unity', 'arcade@unity']);
    await renames.follow(['acme@unity', 'arcade@unity']);
    expect(lines()).toEqual(['getconfig organization acme@unity --format={unityid}', 'getconfig organization arcade@unity --format={unityid}']);
    expect(writes()).toBe(1);
  });
});
