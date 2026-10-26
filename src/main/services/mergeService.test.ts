import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MergeRequest, MergeResolutions, MergeResult } from '@shared/domain/merge';
import { changedStatus, mergePreviewOutput } from '../cm/testing/cmOutput';
import { fakeCmClient, optionValue } from '../cm/testing/fakeCmClient';
import { runMerge } from '../merge/runMerge';
import type { LeftChangesFinder } from '../workspace/leftChanges';
import { createMergeService } from './mergeService';
import type { SwitchContext } from './ServiceContext';
import { serviceContext } from './testing/serviceContext';

vi.mock('electron', () => ({ app: { getPath: () => tmpdir() } }));
vi.mock('../merge/runMerge', () => ({ runMerge: vi.fn() }));

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');
const MERGED = { kind: 'merged' } as unknown as MergeResult;

function merge(cm = fakeCmClient().cm) {
  const finishAppliedShelve = vi.fn(async () => undefined);
  const leftChanges = { finishAppliedShelve } as unknown as LeftChangesFinder;
  const service = createMergeService(serviceContext(cm), { leftChanges } as SwitchContext);
  const run = (request: Partial<MergeRequest>, resolutions: Partial<MergeResolutions> = {}) =>
    service.run(WORKSPACE, { kind: 'merge', sourceSpec: 'br:/main/task1', ...request } as MergeRequest, { files: {}, ...resolutions }, 'op-1');
  return { service, run, finishAppliedShelve };
}

const ADDED_TWICE = ['DIR_CONFLICT', 'EVIL', 'Evil twin conflict', 'Two items, one name.', 'Added /shared', 'Added /shared', '30', 'True', 'ADD', '/shared', 'ADD', '/shared'];

/** A `cm` whose merge has a folder added on both sides until it's decided, kept in the state files as `cm` does. */
function decidingCm() {
  return fakeCmClient({
    status: changedStatus(),
    'merge br:/main/task1': async ({ args }) => {
      if (!args.includes('--resolveconflict')) return mergePreviewOutput(ADDED_TWICE);
      await writeFile(optionValue(args, '--mergeresultfile=')!, 'merge result');
      await writeFile(optionValue(args, '--solvedconflictsfile=')!, 'EVIL src');
      return mergePreviewOutput();
    },
  }).cm;
}

describe("a merge page's directory decisions", () => {
  beforeEach(() => {
    vi.mocked(runMerge).mockReset().mockResolvedValue(MERGED);
  });

  it('are what the merge runs on, once applied', async () => {
    const { service, run } = merge(decidingCm());
    const [conflict] = (await service.preview(WORKSPACE, { kind: 'merge', sourceSpec: 'br:/main/task1' })).directoryConflicts;

    const decided = await service.decideDirectoryConflicts(WORKSPACE, { kind: 'merge', sourceSpec: 'br:/main/task1' }, 'page-1', [{ conflict: conflict!, resolution: { choice: 'source' } }]);
    await run({}, { directoryDecisionsId: 'page-1' });

    expect(decided.plan.directoryConflicts).toEqual([]);
    const state = vi.mocked(runMerge).mock.calls[0]![5]!;
    expect(await readFile(state.solved, 'utf8')).toBe('EVIL src');
  });

  it('are gone once the page closes: the merge then runs on none', async () => {
    const { service, run } = merge(decidingCm());
    const [conflict] = (await service.preview(WORKSPACE, { kind: 'merge', sourceSpec: 'br:/main/task1' })).directoryConflicts;
    await service.decideDirectoryConflicts(WORKSPACE, { kind: 'merge', sourceSpec: 'br:/main/task1' }, 'page-1', [{ conflict: conflict!, resolution: { choice: 'source' } }]);

    await service.discardDirectoryDecisions('page-1');
    await run({}, { directoryDecisionsId: 'page-1' });

    expect(vi.mocked(runMerge).mock.calls[0]![5]).toBeUndefined();
  });
});

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
