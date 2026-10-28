import { fakeApi } from '../../../testing/fakeWindow';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DecidedMerge, DirectoryConflict, DirectoryDecision, MergePlan, MergeRequest } from '@shared/domain/merge';
import { shownToasts } from '../../../testing/operationOutcome';
import { useToastStore } from '../../../ui/toast/toastStore';
import { applyDirectoryDecision } from './applyDirectoryDecision';

const request: MergeRequest = { kind: 'merge', sourceSpec: 'br:/main/feature' };
const conflictAt = (path: string, itemId: number): DirectoryConflict => ({
  type: 'divergentMove',
  title: 'Moved to different places',
  explanation: '',
  itemId,
  isDirectory: true,
  source: { operation: 'moved', path: `${path}-incoming`, oldPath: path, description: '' },
  destination: { operation: 'moved', path, oldPath: path, description: '' },
});
const game = conflictAt('/game', 16);
const assets = conflictAt('/assets', 17);
const plan = { status: 'ready', changes: [], fileConflicts: [], directoryConflicts: [], warnings: [] } as MergePlan;
const keepIncoming = (conflict: DirectoryConflict): DirectoryDecision => ({ conflict, resolution: { choice: 'source' } });

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
});

describe('applyDirectoryDecision', () => {
  it("sends the page's decisions with the new one after them, and takes the merge cm calculated on them", async () => {
    const decided: DecidedMerge = { plan, decisions: [keepIncoming(game), keepIncoming(assets)] };
    fakeApi.answer('merge.decideDirectoryConflicts', () => decided);

    expect(await applyDirectoryDecision('/wk', request, 'page-1', [keepIncoming(game)], assets, { choice: 'source' })).toBe(decided);

    expect(fakeApi.calls()).toEqual([{ method: 'merge.decideDirectoryConflicts', args: ['/wk', request, 'page-1', [keepIncoming(game), keepIncoming(assets)]] }]);
    expect(shownToasts()).toEqual([]);
  });

  it('tells which decisions the merge no longer takes', async () => {
    fakeApi.answer('merge.decideDirectoryConflicts', () => ({ plan, decisions: [{ conflict: game, resolution: { choice: 'destination' } }] }));

    await applyDirectoryDecision('/wk', request, 'page-1', [keepIncoming(game), keepIncoming(assets)], game, { choice: 'destination' });

    expect(shownToasts()).toEqual([{ kind: 'info', title: 'Your decision on assets no longer applies', detail: 'Another decision changed what the merge does there.' }]);
  });

  it('says why it failed, and leaves the page as it was', async () => {
    fakeApi.answer('merge.decideDirectoryConflicts', () => {
      throw new Error('The name is taken.');
    });

    expect(await applyDirectoryDecision('/wk', request, 'page-1', [], game, { choice: 'source' })).toBeNull();
    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't apply your decision on game", detail: 'The name is taken.' }]);
  });
});
