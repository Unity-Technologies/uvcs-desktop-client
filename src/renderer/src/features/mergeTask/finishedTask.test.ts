import { describe, expect, it } from 'vitest';
import { finishedTaskFor, finishedTaskKey, type FinishedTask } from './finishedTask';

const merged: FinishedTask = { branch: '/main/task001', destination: '/main', changesetId: 5, hidden: true };
const none = new Set<string>();

describe('finishedTaskFor', () => {
  it('shows the merge made from this window while the workspace stays on the task', () => {
    expect(finishedTaskFor({ branch: '/main/task001', parent: undefined, merged, mergedInto: undefined, dismissed: none })).toBe(merged);
    expect(finishedTaskFor({ branch: '/main/task002', parent: '/main', merged, mergedInto: null, dismissed: none })).toBeNull();
  });

  it('shows a merge of the branch head the server knows of', () => {
    expect(finishedTaskFor({ branch: '/main/task002', parent: '/main', merged: undefined, mergedInto: 9, dismissed: none })).toEqual({
      branch: '/main/task002',
      destination: '/main',
      changesetId: 9,
      hidden: false,
    });
  });

  it('shows nothing while asking, when the head was not merged, or once dismissed', () => {
    const input = { branch: '/main/task002', parent: '/main', merged: undefined, dismissed: none };
    expect(finishedTaskFor({ ...input, mergedInto: undefined })).toBeNull();
    expect(finishedTaskFor({ ...input, mergedInto: null })).toBeNull();
    expect(finishedTaskFor({ branch: '/main/task001', parent: '/main', merged, mergedInto: 5, dismissed: new Set([finishedTaskKey(merged)]) })).toBeNull();
  });
});
