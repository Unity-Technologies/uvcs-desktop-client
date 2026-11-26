import '../../testing/fakeWindow';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { BRANCH_EXPLORER_KEPT_KEY } from '../../app/settings/windowKeptSettings';
import { fakeApi } from '../../testing/fakeWindow';
import { setBranchPins, setExplorerRulesOn, setUserColors, useBranchExplorerPreferences } from './branchExplorerStore';

const preferences = () => useBranchExplorerPreferences.getState();
const persisted = () => JSON.parse(localStorage.getItem('branch-explorer-preferences')!).state as Record<string, unknown>;
const shownSettings = () => queryClient.getQueryData<AppSettings>(queryKeys.settings)!;

beforeEach(() => {
  queryClient.setQueryData(queryKeys.settings, DEFAULT_SETTINGS);
  useBranchExplorerPreferences.setState({ revealRequest: null });
});

describe('Branch Explorer preferences', () => {
  it('asks the main process to change one repository’s moved branches and rules, shown at once', () => {
    fakeApi.answer('settings.updateRepositorySettings', () => new Promise(() => {}));
    setBranchPins('game@host', [{ branch: 4, row: 1 }]);
    setExplorerRulesOn('game@host', false);

    expect(fakeApi.argsOf('settings.updateRepositorySettings')).toEqual([
      ['game@host', { branchPins: [{ branch: 4, row: 1 }] }],
      ['game@host', { explorerRulesOff: true }],
    ]);
    expect(shownSettings().repositorySettings).toEqual({ 'game@host': { branchPins: [{ branch: 4, row: 1 }], explorerRulesOff: true } });
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
    fakeApi.answer('settings.addWindowSettings', () => new Promise(() => {}));

    await useBranchExplorerPreferences.persist.rehydrate();

    expect(JSON.parse(localStorage.getItem(BRANCH_EXPLORER_KEPT_KEY)!)).toEqual(kept);
    expect(fakeApi.argsOf('settings.addWindowSettings')).toEqual([
      [{ repositorySettings: { 'game@host': { explorerRulesOff: true, branchPins: [{ branch: 4, row: 1 }] } }, serverSettings: {}, changesetColors: { users: [] } }],
    ]);
    expect(persisted()).not.toHaveProperty('pinsByRepository');
    expect(persisted()).not.toHaveProperty('rulesOff');
    expect(preferences().hideMergedBranches).toBe(true);
  });
});
