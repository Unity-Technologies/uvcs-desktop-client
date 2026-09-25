import { describe, expect, it } from 'vitest';
import type { IncomingSummary } from '@shared/domain/incoming';
import { branchHeadMovedOnServer, loadedChangesetChanged } from './headChanges';

const onMain = (loadedChangeset: number) => ({ selector: { kind: 'branch' as const, name: '/main' }, loadedChangeset });
const summary = (loadedChangeset: number, headChangeset: number): IncomingSummary => ({
  branch: '/main',
  loadedChangeset,
  headChangeset,
  changesetCount: headChangeset - loadedChangeset,
  authors: [],
});

describe('loadedChangesetChanged', () => {
  it('tells checkins, updates and switches from rewrites that load the same thing', () => {
    expect(loadedChangesetChanged(onMain(3), onMain(3))).toBe(false);
    expect(loadedChangesetChanged(onMain(3), onMain(4))).toBe(true);
    expect(loadedChangesetChanged(onMain(3), { selector: { kind: 'branch', name: '/main/task' }, loadedChangeset: 3 })).toBe(true);
  });
});

describe('branchHeadMovedOnServer', () => {
  it('spots checkins by others', () => {
    expect(branchHeadMovedOnServer(summary(3, 3), summary(3, 5))).toBe(true);
    expect(branchHeadMovedOnServer(summary(3, 5), summary(3, 5))).toBe(false);
  });

  it('leaves our own checkins and updates, which refresh everything anyway', () => {
    expect(branchHeadMovedOnServer(summary(3, 3), summary(4, 4))).toBe(false);
    expect(branchHeadMovedOnServer(summary(3, 5), summary(5, 5))).toBe(false);
  });
});
