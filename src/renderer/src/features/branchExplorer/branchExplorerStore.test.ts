import '../../testing/fakeWindow';
import { beforeEach, describe, expect, it } from 'vitest';
import { repositoryKey } from '@shared/domain/repository';
import { repositorySettingsOf } from '@shared/domain/scopedSettings';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';
import { repositoryGuidFor } from '@shared/testing/stableIdsFor';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { BRANCH_EXPLORER_KEPT_KEY } from '../../app/settings/windowKeptSettings';
import { repositoryGuidToWrite } from '../../app/workspace/repositoryGuidToWrite';
import { shownToasts } from '../../testing/operationOutcome';
import { fakeApi } from '../../testing/fakeWindow';
import { setBranchPins, setExplorerRulesOn, setUserColors, useBranchExplorerPreferences } from './branchExplorerStore';

const preferences = () => useBranchExplorerPreferences.getState();
const persisted = () => JSON.parse(localStorage.getItem('branch-explorer-preferences')!).state as Record<string, unknown>;
const shownSettings = () => queryClient.getQueryData<AppSettings>(queryKeys.settings)!;
const GAME = repositoryGuidFor(1);
/** The repository's GUID by its spec, as the main process answers it: `racer@host` is `game@host` renamed elsewhere. */
const GUIDS: Record<string, string> = { 'game@host': GAME, 'racer@host': GAME };

beforeEach(() => {
  queryClient.clear();
  queryClient.setQueryData(queryKeys.settings, DEFAULT_SETTINGS);
  useBranchExplorerPreferences.setState({ revealRequest: null });
  fakeApi.answer('repositories.guidOf', (spec: string) => GUIDS[repositoryKey(spec)] ?? null);
});

describe('Branch Explorer preferences', () => {
  it('asks the main process to change one repository’s moved branches and rules, by its GUID, shown at once', async () => {
    fakeApi.answer('settings.updateRepositorySettings', () => new Promise(() => {}));
    void setBranchPins('game@host', [{ branch: 4, row: 1 }]);
    void setExplorerRulesOn('game@host', false);
    await repositoryGuidToWrite('game@host');

    expect(fakeApi.argsOf('settings.updateRepositorySettings')).toEqual([
      [GAME, { branchPins: [{ branch: 4, row: 1 }] }],
      [GAME, { explorerRulesOff: true }],
    ]);
    expect(shownSettings().repositorySettings).toEqual({ [GAME]: { branchPins: [{ branch: 4, row: 1 }], explorerRulesOff: true } });
    expect(fakeApi.argsOf('repositories.guidOf')).toEqual([['game@host']]);
  });

  it('keeps a repository’s rules and moved branches once it is renamed anywhere', async () => {
    fakeApi.answer('settings.updateRepositorySettings', () => new Promise(() => {}));
    void setBranchPins('game@host', [{ branch: 4, row: 1 }]);
    await repositoryGuidToWrite('game@host');

    const renamed = await repositoryGuidToWrite('racer@host');

    expect(repositorySettingsOf(shownSettings().repositorySettings, renamed)).toEqual({ branchPins: [{ branch: 4, row: 1 }] });
  });

  it('says a change wasn’t saved, and shows none, when the repository’s GUID can’t be read', async () => {
    fakeApi.answer('repositories.guidOf', () => {
      throw new Error('Unable to connect to host');
    });

    await setExplorerRulesOn('game@host', false);

    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't save the settings", detail: 'Unable to connect to host' }]);
    expect(fakeApi.argsOf('settings.updateRepositorySettings')).toEqual([]);
    expect(shownSettings().repositorySettings).toEqual({});
  });

  it('keeps the changeset colors in the app’s settings', () => {
    fakeApi.answer('settings.update', () => new Promise(() => {}));
    setUserColors({ users: [{ user: 'ana@example.com', hue: 120 }] });

    expect(fakeApi.argsOf('settings.update')).toEqual([[{ changesetColors: { users: [{ user: 'ana@example.com', hue: 120 }] } }]]);
  });

  it('remembers its view in the window’s storage, but no action or passing request', () => {
    preferences().set({ hideMergedBranches: true, revealRequest: { kind: 'changeset', id: 7 } });

    const state = persisted();
    expect(state.hideMergedBranches).toBe(true);
    for (const notRemembered of ['set', 'visibleBranches', 'revealRequest']) expect(state).not.toHaveProperty(notRemembered);
  });

  it('puts what version 2 kept per repository aside for the app’s settings, and remembers the rest', async () => {
    const kept = { rulesOff: { 'game@host': true }, pinsByRepository: { 'game@host': [{ branch: 4, row: 1 }] } };
    localStorage.setItem('branch-explorer-preferences', JSON.stringify({ state: { hideMergedBranches: true, ...kept }, version: 2 }));

    await useBranchExplorerPreferences.persist.rehydrate();

    expect(JSON.parse(localStorage.getItem(BRANCH_EXPLORER_KEPT_KEY)!)).toEqual(kept);
    expect(persisted()).not.toHaveProperty('pinsByRepository');
    expect(persisted()).not.toHaveProperty('rulesOff');
    expect(preferences().hideMergedBranches).toBe(true);
  });
});
