import { describe, expect, it } from 'vitest';
import { EVERYONE, MINE } from '../../lib/peopleFilter';
import { hiddenAfterMigration, migrateBranchExplorerPreferences } from './branchExplorerMigration';

describe('migrateBranchExplorerPreferences', () => {
  it('keeps the people picked from version 1 on, and drops whether the details were open', () => {
    const migrated = migrateBranchExplorerPreferences({ dateRange: 'lastWeek', people: MINE, detailsOpen: false, showComments: false }, 1);
    expect(migrated).toEqual({ dateRange: 'lastWeek', people: MINE, showComments: false });
  });

  it('turns version 0 date ranges into the shared presets, and starts with everyone', () => {
    expect(migrateBranchExplorerPreferences({ dateRange: 'nonsense', people: MINE }, 0)).toEqual({ dateRange: 'lastMonth', people: EVERYONE });
  });

  it('reads nothing remembered as nothing to keep', () => {
    expect(migrateBranchExplorerPreferences(undefined, 1)).toEqual({});
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
