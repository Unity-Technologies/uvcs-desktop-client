import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@shared/domain/settings';
import { fakeApi } from '../../testing/fakeWindow';
import { BRANCH_EXPLORER_KEPT_KEY, bringStoredWindowSettings, HOME_PROJECT_PICKS_KEY, keptInStorage, SYNC_TARGETS_KEY } from './windowKeptSettings';

const pin = { branch: 4, row: 1 };

function storing(items: Record<string, unknown>): Storage {
  localStorage.clear();
  for (const [key, value] of Object.entries(items)) localStorage.setItem(key, JSON.stringify(value));
  return localStorage;
}

describe('keptInStorage', () => {
  it('reads the Branch Explorer’s, the sync remotes and the home projects as the settings keep them', () => {
    const storage = storing({
      [BRANCH_EXPLORER_KEPT_KEY]: {
        rulesOff: { 'game@host': true },
        userColorsOff: { 'art@host': true },
        userColors: { users: [{ user: 'ana', hue: 120 }] },
        pinsByRepository: { 'game@host': [pin] },
      },
      [SYNC_TARGETS_KEY]: { state: { remoteByRepository: { 'game@host': 'game@cloud' } }, version: 0 },
      [HOME_PROJECT_PICKS_KEY]: { state: { picks: { 'acme@unity': 'Racing' } }, version: 0 },
    });

    expect(keptInStorage(storage)).toEqual({
      repositorySettings: {
        'game@host': { explorerRulesOff: true, branchPins: [pin], syncRemote: 'game@cloud' },
        'art@host': { changesetColorsOff: true },
      },
      serverSettings: { 'acme@unity': { homeProject: 'Racing' } },
      changesetColors: { users: [{ user: 'ana', hue: 120 }] },
    });
  });

  it('is null when the storage keeps none of them, and reads one it can’t parse as nothing', () => {
    expect(keptInStorage(storing({}))).toBeNull();
    localStorage.setItem(SYNC_TARGETS_KEY, '{not json');
    expect(keptInStorage(localStorage)).toEqual({ repositorySettings: {}, serverSettings: {}, changesetColors: { users: [] } });
  });
});

describe('bringStoredWindowSettings', () => {
  it('hands what the storage kept to the settings once, then forgets it there', async () => {
    const storage = storing({ [SYNC_TARGETS_KEY]: { state: { remoteByRepository: { 'game@host': 'game@cloud' } }, version: 0 } });
    fakeApi.answer('settings.addWindowSettings', async () => DEFAULT_SETTINGS);

    await bringStoredWindowSettings(storage);
    await bringStoredWindowSettings(storage);

    expect(fakeApi.argsOf('settings.addWindowSettings')).toEqual([
      [{ repositorySettings: { 'game@host': { syncRemote: 'game@cloud' } }, serverSettings: {}, changesetColors: { users: [] } }],
    ]);
    expect(storage.getItem(SYNC_TARGETS_KEY)).toBeNull();
  });

  it('keeps it in the storage for the next start when the settings can’t take it', async () => {
    const storage = storing({ [HOME_PROJECT_PICKS_KEY]: { state: { picks: { 'acme@unity': 'Racing' } }, version: 0 } });
    fakeApi.answer('settings.addWindowSettings', async () => {
      throw new Error('disk full');
    });

    await bringStoredWindowSettings(storage);

    expect(storage.getItem(HOME_PROJECT_PICKS_KEY)).not.toBeNull();
  });
});
