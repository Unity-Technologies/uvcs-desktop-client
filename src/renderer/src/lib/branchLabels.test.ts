import { describe, expect, it } from 'vitest';
import { distinctBranchNames } from './branchLabels';

describe('distinctBranchNames', () => {
  it('names each branch by its last segment', () => {
    expect(distinctBranchNames('/main/child-br-cr-sample/empty-branch2/child_1/subtask', '/main/child-br-cr-sample/empty-branch2/child_1')).toEqual([
      'subtask',
      'child_1',
    ]);
    expect(distinctBranchNames('/main/task001', '/main')).toEqual(['task001', 'main']);
  });

  it('keeps more segments while the names are the same', () => {
    expect(distinctBranchNames('/main/task/task', '/main/task')).toEqual(['task/task', 'main/task']);
    expect(distinctBranchNames('/main/a/fix', '/main/b/fix')).toEqual(['a/fix', 'b/fix']);
  });

  it('gives the whole names when nothing shorter tells them apart', () => {
    expect(distinctBranchNames('/main', '/main')).toEqual(['/main', '/main']);
  });
});
