import { describe, expect, it } from 'vitest';
import type { IncomingChanges } from '@shared/domain/incoming';
import { incomingRefreshFailed, incomingViewState } from './incomingViewState';

const details = { changesets: [], moreChangesets: false, files: [], conflicts: [], blockedPaths: [] };
const behind: IncomingChanges = {
  branch: '/main',
  loadedChangeset: 40,
  headChangeset: 43,
  changesetCount: 3,
  countCapped: false,
  authors: ['ana@example.com'],
  ...details,
};
const upToDate: IncomingChanges = { ...behind, headChangeset: 40, changesetCount: 0, authors: [] };
const offBranch: IncomingChanges = { branch: null, changesetCount: 0, countCapped: false, authors: [], ...details };

describe('incomingViewState', () => {
  it('reads until the check first answers', () => {
    expect(incomingViewState(undefined, true, false)).toEqual({ kind: 'reading' });
  });

  it("says it couldn't check when the read failed", () => {
    expect(incomingViewState(undefined, false, true)).toEqual({ kind: 'failed' });
  });

  it('keeps what it read when reading again fails, as the workspace screen does', () => {
    expect(incomingViewState(behind, false, true)).toEqual({ kind: 'incoming', incoming: behind });
  });

  it('says nothing comes in off a branch', () => {
    expect(incomingViewState(offBranch, false, false)).toEqual({ kind: 'notOnBranch' });
  });

  it('is up to date with nothing new on the branch, and lists what came in otherwise', () => {
    expect(incomingViewState(upToDate, false, false)).toEqual({ kind: 'upToDate' });
    expect(incomingViewState(behind, false, false)).toEqual({ kind: 'incoming', incoming: behind });
  });
});

describe('incomingRefreshFailed', () => {
  it('says the check failed when it keeps what an earlier read found', () => {
    expect(incomingRefreshFailed(behind, true)).toBe(true);
    expect(incomingRefreshFailed(upToDate, true)).toBe(true);
  });

  it('has nothing to say when the read answered, or when the failure takes the whole view', () => {
    expect(incomingRefreshFailed(behind, false)).toBe(false);
    expect(incomingRefreshFailed(undefined, true)).toBe(false);
  });
});
