import { describe, expect, it } from 'vitest';
import { MAIN_BRANCH_GUID } from '@shared/domain/branch';
import { withRecentBranch } from './recentBranches';

const guid = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;

describe('withRecentBranch', () => {
  it('moves the branch first, in lowercase, once', () => {
    expect(withRecentBranch([guid(1), guid(2), guid(3)], guid(3).toUpperCase())).toEqual([guid(3), guid(1), guid(2)]);
  });

  it('keeps five, as the official client lists', () => {
    expect(withRecentBranch([1, 2, 3, 4, 5].map(guid), guid(6))).toEqual([6, 1, 2, 3, 4].map(guid));
  });

  it('never keeps /main', () => {
    expect(withRecentBranch([guid(1)], MAIN_BRANCH_GUID.toUpperCase())).toEqual([guid(1)]);
  });
});
