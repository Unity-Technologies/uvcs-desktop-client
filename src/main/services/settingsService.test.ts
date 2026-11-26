import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseRepositoryGuid } from '@shared/domain/stableIds';
import { formatOutput } from '../cm/testing/cmOutput';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import { SettingsStore } from '../settings/SettingsStore';
import { createSettingsService } from './settingsService';
import { serviceContext } from './testing/serviceContext';

const GAME = parseRepositoryGuid('0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d')!;

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

describe('addWindowSettings', () => {
  it('keeps what a window brings for a repository under its GUID when a listing already taught it', async () => {
    const fake = fakeCmClient({ 'repository list': formatOutput(['2', 'game', 'acme@cloud', 'ana', 'VCS', GAME]) });
    const settings = new SettingsStore(join(mkdtempSync(join(tmpdir(), 'uvcs-settings-')), 'settings.json'));
    const context = serviceContext(fake.cm, { settings });
    await context.repositoryGuids.list('acme@cloud');

    await createSettingsService(context).addWindowSettings({
      repositorySettings: { 'Game@acme@cloud': { branchPins: [{ branch: 4, row: 1 }] }, 'tools@acme@cloud': { explorerRulesOff: true } },
      serverSettings: {},
      changesetColors: { users: [] },
    });

    expect(settings.get().repositorySettings).toEqual({ [GAME]: { branchPins: [{ branch: 4, row: 1 }] }, 'tools@acme@cloud': { explorerRulesOff: true } });
    expect(fake.lines()).toHaveLength(1);
  });
});
