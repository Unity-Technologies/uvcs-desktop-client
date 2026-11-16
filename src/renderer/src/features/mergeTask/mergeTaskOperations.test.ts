import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';

import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { whereTheWindowIs } from '../../testing/operationOutcome';
import { openMergeRequestMerge, openTaskMerge } from './mergeTaskOperations';

describe('finishing a task', () => {
  it('opens the merge page for merging it into its parent on the server, nothing picked yet', () => {
    openTaskMerge({ id: 7, name: '/main/task001', parent: '/main', comment: 'Task 001' });

    expect(whereTheWindowIs().pages).toEqual([
      {
        kind: 'merge',
        request: { kind: 'merge', sourceSpec: 'br:/main/task001', destinationBranch: '/main' },
        task: { branch: { name: '/main/task001', comment: 'Task 001' }, destination: '/main', choices: { markReviewed: false, hideBranch: false } },
      },
    ]);
  });

  it("opens the merge page for a merge request, into the request's destination rather than the parent", () => {
    const request = codeReviewSummary({ id: 12, title: 'Add login', mergeRequest: { state: 'Open', destination: '/main' } });

    openMergeRequestMerge(request, '/main/release/task');

    expect(whereTheWindowIs().pages).toEqual([
      {
        kind: 'merge',
        request: { kind: 'merge', sourceSpec: 'br:/main/release/task', destinationBranch: '/main' },
        task: { branch: { name: '/main/release/task', comment: '' }, destination: '/main', mergeRequest: { id: 12, title: 'Add login' }, choices: { markReviewed: false, hideBranch: false } },
      },
    ]);
  });
});
