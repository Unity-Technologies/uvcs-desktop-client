import { fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { MergeRequest, MergeResolutions } from '@shared/domain/merge';
import { shownToasts, whereTheWindowIs } from '../../testing/operationOutcome';
import { completeMerge } from './mergeOperations';

const ws = '/ws';
const destinationBranch = '/main/child-br-cr-sample/empty-branch2/child_1/subtask';
const request: MergeRequest = { kind: 'merge', sourceSpec: 'br:/main/child-br-cr-sample/empty-branch2/child_1/subtask/merge-test', destinationBranch };
const resolutions: MergeResolutions = { directoryConflicts: [], files: {} };

describe('completeMerge', () => {
  it('says where a server merge created its changeset, naming the branch by its own name', async () => {
    fakeApi.answer('merge.run', () => ({ changesetId: 42 }));

    expect(await completeMerge(ws, request, resolutions)).toEqual({ changesetId: 42 });

    expect(fakeApi.argsOf('merge.run')).toEqual([[ws, request, resolutions, expect.any(String)]]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Created changeset 42 on subtask' }]);
  });

  it('explains a destination that moved meanwhile, and opens the merge that finishes it', async () => {
    fakeApi.answer('merge.run', () => ({ changesetId: 43, destinationMoved: true }));

    expect(await completeMerge(ws, request, resolutions)).toBeNull();

    expect(shownToasts()).toEqual([
      {
        kind: 'info',
        title: 'subtask moved while merging',
        detail: 'Someone checked in on subtask at the same time, so the merge (changeset 43) sits beside the new head. Merge it into subtask to finish.',
      },
    ]);
    expect(whereTheWindowIs().pages.at(-1)).toEqual({ kind: 'merge', request: { kind: 'merge', sourceSpec: 'cs:43', destinationBranch } });
  });
});
