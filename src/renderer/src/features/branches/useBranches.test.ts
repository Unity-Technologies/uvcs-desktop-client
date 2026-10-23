import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { branchesKey } from './useBranches';

describe('The branches read for a workspace', () => {
  it("keeps an xlinked repository's apart from the workspace's, which every branch view shares", () => {
    expect(branchesKey('/ws', {})).toEqual(['workspace', '/ws', 'branches', {}]);
    expect(branchesKey('/ws', {}, 'lib@local')).not.toEqual(branchesKey('/ws', {}));
    expect(branchesKey('/ws', {}, 'lib@local')).not.toEqual(branchesKey('/ws', {}, 'art@local'));
  });

  it('stays among the branches, so what refreshes branches refreshes them too', () => {
    expect(branchesKey('/ws', {}, 'lib@local').slice(0, 3)).toEqual(branchesKey('/ws', {}).slice(0, 3));
  });
});
