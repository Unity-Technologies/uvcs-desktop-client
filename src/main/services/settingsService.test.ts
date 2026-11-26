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
