import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import { SettingsStore } from '../settings/SettingsStore';
import { createSettingsService } from './settingsService';
import { serviceContext } from './testing/serviceContext';

function settingsService() {
  const settings = new SettingsStore(join(mkdtempSync(join(tmpdir(), 'settings-service-')), 'settings.json'));
  const followed: string[][] = [];
  const context = serviceContext(fakeCmClient().cm, { settings, organizationRenames: { listed: async () => undefined, follow: async (servers) => void followed.push([...servers]) } });
  return { service: createSettingsService(context), followed };
}

describe('an organization that starts keeping something', () => {
  it('has its id recorded when it becomes a favorite, so the favorite follows it through a rename', async () => {
    const { service, followed } = settingsService();

    expect((await service.setFavoriteOrganization('acme@unity', true)).favoriteOrganizations).toEqual(['acme@unity']);
    expect(followed).toEqual([['acme@unity']]);
  });

  it('has its id recorded when its settings change', async () => {
    const { service, followed } = settingsService();

    expect((await service.updateServerSettings('acme@unity', { homeProject: '5a1c2d3e-0000-4000-8000-00000000abcd' })).serverSettings).toEqual({
      'acme@unity': { homeProject: '5a1c2d3e-0000-4000-8000-00000000abcd' },
    });
    expect(followed).toEqual([['acme@unity']]);
  });
});
