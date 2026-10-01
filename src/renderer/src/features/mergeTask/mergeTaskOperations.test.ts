import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';

import { whereTheWindowIs } from '../../testing/operationOutcome';
import { openTaskMerge } from './mergeTaskOperations';

describe('finishing a task', () => {
  it('opens the merge page for merging it into its parent on the server, nothing picked yet', () => {
    openTaskMerge({ id: 7, name: '/main/task001', parent: '/main', comment: 'Task 001' });

    expect(whereTheWindowIs().pages).toEqual([
      {
        kind: 'merge',
        request: { kind: 'merge', sourceSpec: 'br:/main/task001', destinationBranch: '/main' },
        task: { branch: { id: 7, name: '/main/task001', parent: '/main', comment: 'Task 001' }, choices: { markReviewed: false, hideBranch: false } },
      },
    ]);
  });
});
