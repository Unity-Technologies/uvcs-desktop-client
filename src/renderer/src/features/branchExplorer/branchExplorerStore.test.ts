import '../../testing/fakeWindow';
import { beforeEach, describe, expect, it } from 'vitest';
import { rememberedPreferences } from './branchExplorerMigration';
import { useBranchExplorerPreferences } from './branchExplorerStore';
import { DEFAULT_USER_COLORS } from './model/userColors';

const preferences = () => useBranchExplorerPreferences.getState();
const persisted = () => JSON.parse(localStorage.getItem('branch-explorer-preferences')!).state as Record<string, unknown>;

beforeEach(() => {
  useBranchExplorerPreferences.setState({ rulesByRepository: {}, rulesOff: {}, userColors: DEFAULT_USER_COLORS, userColorsOff: {}, revealRequest: null });
});

describe('Branch Explorer preferences', () => {
  it('turns the rules of one repository off and on, leaving the others on', () => {
    preferences().setRulesOn('game@local', false);

    expect(preferences().rulesOff).toEqual({ 'game@local': true });

    preferences().setRulesOn('game@local', true);

    expect(preferences().rulesOff).toEqual({});
  });

  it('remembers the changeset colors and which rules are off, but no action or passing request', () => {
    preferences().set({ userColors: { users: [{ user: 'ana@example.com', hue: 120 }] } });
    preferences().setUserColorsOn('game@local', false);
    preferences().setRulesOn('game@local', false);
    preferences().set({ revealRequest: { kind: 'changeset', id: 7 } });

    const state = persisted();

    expect(state.userColors).toEqual({ users: [{ user: 'ana@example.com', hue: 120 }] });
    expect(state.userColorsOff).toEqual({ 'game@local': true });
    expect(state.rulesOff).toEqual({ 'game@local': true });
    for (const notRemembered of ['set', 'setRules', 'setRulesOn', 'setUserColorsOn', 'visibleBranches', 'revealRequest']) {
      expect(state).not.toHaveProperty(notRemembered);
    }
  });

  it('gives preferences remembered before the colors and the switch their defaults', () => {
    const remembered = rememberedPreferences({ dateRange: 'lastWeek' }, preferences());

    expect(remembered.userColors).toEqual(DEFAULT_USER_COLORS);
    expect(remembered.rulesOff).toEqual({});
    expect(remembered.userColorsOff).toEqual({});
    expect(remembered.dateRange).toBe('lastWeek');
  });
});
