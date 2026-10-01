import { describe, expect, it } from 'vitest';
import { MERGE_INTO_WORKSPACE, serverMergeLabel } from './mergeMenuLabels';

describe('merge menu labels', () => {
  it('names where a server merge goes by the branch’s own name, or that a branch is picked next', () => {
    expect(serverMergeLabel('/main')).toBe('Merge to main on the server…');
    expect(serverMergeLabel('/main/child-br-cr-sample/empty-branch2/child_1/subtask')).toBe('Merge to subtask on the server…');
    expect(serverMergeLabel()).toBe('Merge to another branch on the server…');
  });

  it('keeps “on the server” within a menu’s width however long the destination’s name is', () => {
    const label = serverMergeLabel('/main/rendering/shader-variant-stripping-regression-after-upgrading-to-unity-6');
    expect(label).toBe('Merge to shader-variant…ng-to-unity-6 on the server…');
  });

  it('never reads the same for a workspace merge and a server merge to the branch the workspace is on', () => {
    expect(MERGE_INTO_WORKSPACE).not.toMatch(/main|server/);
    expect(serverMergeLabel('/main')).toContain('server');
  });
});
