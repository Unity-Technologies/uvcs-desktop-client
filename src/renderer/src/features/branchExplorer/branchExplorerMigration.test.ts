import { describe, expect, it } from 'vitest';
import { EVERYONE, MINE } from '../../lib/peopleFilter';
import { detailsOpenOf, migrateBranchExplorerPreferences } from './branchExplorerMigration';

describe('migrateBranchExplorerPreferences', () => {
  it('keeps the people picked from version 1 on, and drops whether the details were open', () => {
    const mine = MINE;
    const migrated = migrateBranchExplorerPreferences({ dateRange: 'lastWeek', people: mine, detailsOpen: false, showComments: false }, 1);
    expect(migrated).toEqual({ dateRange: 'lastWeek', people: mine, showComments: false });
  });

  it('turns version 0 date ranges into the shared presets, and starts with everyone', () => {
    expect(migrateBranchExplorerPreferences({ dateRange: 'nonsense', people: MINE }, 0)).toEqual({ dateRange: 'lastMonth', people: EVERYONE });
  });

  it('reads nothing remembered as nothing to keep', () => {
    expect(migrateBranchExplorerPreferences(undefined, 1)).toEqual({});
  });
});

describe('detailsOpenOf', () => {
  it('is open unless the details were closed', () => {
    expect(detailsOpenOf({ detailsOpen: false })).toBe(false);
    expect(detailsOpenOf({ detailsOpen: true })).toBe(true);
    expect(detailsOpenOf({})).toBe(true);
    expect(detailsOpenOf(undefined)).toBe(true);
  });
});
