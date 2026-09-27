import { describe, expect, it } from 'vitest';
import { MERGE_INTO_WORKSPACE, serverMergeLabel } from './mergeMenuLabels';

describe('merge menu labels', () => {
  it('names where a server merge goes, or that a branch is picked next', () => {
    expect(serverMergeLabel('/main')).toBe('Merge to /main on the server…');
    expect(serverMergeLabel()).toBe('Merge to another branch on the server…');
  });

  it('never reads the same for a workspace merge and a server merge to the branch the workspace is on', () => {
    expect(MERGE_INTO_WORKSPACE).not.toMatch(/main|server/);
    expect(serverMergeLabel('/main')).toContain('server');
  });
});
