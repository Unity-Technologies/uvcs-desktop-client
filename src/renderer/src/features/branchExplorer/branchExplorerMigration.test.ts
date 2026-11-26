import { describe, expect, it } from 'vitest';
import { EVERYONE, MINE } from '../../lib/peopleFilter';
import { DEFAULT_GRAPH_VIEW_OPTIONS, graphViewOptionsOf } from './canvas/graphViewOptions';
import { newRule } from './model/explorerRules';
import { hiddenAfterMigration, migrateBranchExplorerPreferences, rememberedPreferences } from './branchExplorerMigration';

describe('migrateBranchExplorerPreferences', () => {
  it('keeps the people picked from version 1 on, and drops whether the details were open', () => {
    const migrated = migrateBranchExplorerPreferences({ dateRange: 'lastWeek', people: MINE, detailsOpen: false, showComments: false }, 1);
    expect(migrated).toEqual({ remembered: { dateRange: 'lastWeek', people: MINE, showComments: false }, kept: null });
  });

  it('turns version 0 date ranges into the shared presets, and starts with everyone', () => {
    expect(migrateBranchExplorerPreferences({ dateRange: 'nonsense', people: MINE }, 0).remembered).toEqual({ dateRange: 'lastMonth', people: EVERYONE });
  });

  it('puts the rules, moved branches and colors of version 2 aside for the app\u2019s settings, remembering the rest', () => {
    const rule = newRule('include', 'r1');
    const migrated = migrateBranchExplorerPreferences(
      {
        dateRange: 'lastWeek',
        rulesByRepository: { 'game@host': [rule] },
        rulesOff: { 'game@host': true },
        userColors: { users: [{ user: 'ana', hue: 120 }] },
        userColorsOff: {},
        pinsByRepository: { 'game@host': [{ branch: 4, row: 1 }] },
      },
      2,
    );
    expect(migrated).toEqual({
      remembered: { dateRange: 'lastWeek' },
      kept: {
        rulesByRepository: { 'game@host': [rule] },
        rulesOff: { 'game@host': true },
        userColors: { users: [{ user: 'ana', hue: 120 }] },
        userColorsOff: {},
        pinsByRepository: { 'game@host': [{ branch: 4, row: 1 }] },
      },
    });
  });

  it('reads nothing remembered as nothing to keep', () => {
    expect(migrateBranchExplorerPreferences(undefined, 1)).toEqual({ remembered: {}, kept: null });
  });
});

describe('hiddenAfterMigration', () => {
  it("hides the Branch Explorer's details when they were closed, keeping the other views'", () => {
    expect(hiddenAfterMigration({ detailsOpen: false }, { labels: true }, 'branchExplorer')).toEqual({ labels: true, branchExplorer: true });
  });

  it('keeps them hidden when they already were', () => {
    expect(hiddenAfterMigration({ detailsOpen: false }, { branchExplorer: true }, 'branchExplorer')).toEqual({ branchExplorer: true });
  });

  it('leaves every view as it was when they were open, or nothing was remembered', () => {
    expect(hiddenAfterMigration({ detailsOpen: true }, { labels: true }, 'branchExplorer')).toEqual({ labels: true });
    expect(hiddenAfterMigration({}, {}, 'branchExplorer')).toEqual({});
    expect(hiddenAfterMigration(undefined, {}, 'branchExplorer')).toEqual({});
  });
});

describe('rememberedPreferences', () => {
  const current = { dateRange: 'lastMonth', people: EVERYONE, ...DEFAULT_GRAPH_VIEW_OPTIONS };

  it('starts the display options remembered before there were more at their defaults, keeping the ones remembered', () => {
    const started = rememberedPreferences({ dateRange: 'lastWeek', showComments: false, showAvatars: true }, current);
    expect(graphViewOptionsOf(started)).toEqual({ ...DEFAULT_GRAPH_VIEW_OPTIONS, showComments: false });
    expect(started.dateRange).toBe('lastWeek');
  });

  it('starts with the defaults when nothing was remembered', () => {
    expect(rememberedPreferences(undefined, current)).toEqual(current);
  });
});
