import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MergeRequest, MergeResult } from '@shared/domain/merge';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import { runMerge } from '../merge/runMerge';
import type { LeftChangesFinder } from '../workspace/leftChanges';
import { createMergeService } from './mergeService';
import type { SwitchContext } from './ServiceContext';
import { serviceContext } from './testing/serviceContext';

vi.mock('electron', () => ({ app: { getPath: () => tmpdir() } }));
vi.mock('../merge/runMerge', () => ({ runMerge: vi.fn() }));

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');
const MERGED = { kind: 'merged' } as unknown as MergeResult;

function merge() {
  const finishAppliedShelve = vi.fn(async () => undefined);
  const leftChanges = { finishAppliedShelve } as unknown as LeftChangesFinder;
  const service = createMergeService(serviceContext(fakeCmClient().cm), { leftChanges } as SwitchContext);
  const run = (request: Partial<MergeRequest>) => service.run(WORKSPACE, { kind: 'merge', sourceSpec: 'br:/main/task1', ...request } as MergeRequest, {} as never, 'op-1');
  return { run, finishAppliedShelve };
}

describe('running a merge', () => {
  beforeEach(() => {
    vi.mocked(runMerge).mockReset().mockResolvedValue(MERGED);
  });

  it('finishes a shelve applied to the workspace from the merge view, deleting it when asked', async () => {
    const { run, finishAppliedShelve } = merge();

    expect(await run({ sourceSpec: 'sh:12', deleteShelve: true })).toBe(MERGED);
    await run({ sourceSpec: 'sh:13' });

    expect(finishAppliedShelve.mock.calls).toEqual([
      [WORKSPACE, 12, true],
      [WORKSPACE, 13, false],
    ]);
  });

  it('leaves shelves alone for merges of anything else, or into a server branch', async () => {
    const { run, finishAppliedShelve } = merge();

    await run({ sourceSpec: 'br:/main/task1' });
    await run({ sourceSpec: 'sh:12', destinationBranch: '/main' });

    expect(finishAppliedShelve).not.toHaveBeenCalled();
  });

  it('leaves the shelve as it was when the merge fails', async () => {
    vi.mocked(runMerge).mockRejectedValueOnce(new Error('The merge failed.'));
    const { run, finishAppliedShelve } = merge();

    await expect(run({ sourceSpec: 'sh:12', deleteShelve: true })).rejects.toThrow('The merge failed.');
    expect(finishAppliedShelve).not.toHaveBeenCalled();
  });
});
