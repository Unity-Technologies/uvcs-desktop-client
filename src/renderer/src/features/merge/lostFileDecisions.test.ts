import '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';
import type { FileConflict, MergePlan } from '@shared/domain/merge';
import { shownToasts } from '../../testing/operationOutcome';
import { useToastStore } from '../../ui/toast/toastStore';
import { fileConflictKey } from './conflictedFiles';
import { forgetLostFileDecisions } from './lostFileDecisions';
import type { FileConflictState } from './resolve/useFileConflicts';

const conflictAt = (path: string, itemId: number): FileConflict => ({
  path,
  destinationPath: path,
  itemId,
  baseChangeset: 1,
  sourceChangeset: 3,
  destinationChangeset: 4,
  repository: 'game@local',
  destinationRevisionId: 40,
  destinationIsBinary: false,
});
const forest = conflictAt('/stages/Forest.cs', 35);
const desert = conflictAt('/stages/Desert.cs', 36);
const player = conflictAt('/src/Player.cs', 37);
const planWith = (...fileConflicts: FileConflict[]): MergePlan => ({ status: 'ready', changes: [], fileConflicts, directoryConflicts: [], warnings: [] });
const stateOf = (conflict: FileConflict, decidedByUser: boolean): FileConflictState =>
  ({ file: { key: fileConflictKey(conflict), path: conflict.path.slice(1) }, decidedByUser, resolution: decidedByUser ? { choice: 'source' } : null }) as FileConflictState;

describe('forgetLostFileDecisions', () => {
  it('starts over the files the user decided that a directory decision took out of the merge, and names them', () => {
    useToastStore.setState({ toasts: [] });
    const reset = vi.fn();

    forgetLostFileDecisions(planWith(forest, desert, player), planWith(player), [stateOf(forest, true), stateOf(desert, false), stateOf(player, true)], reset);

    expect(reset.mock.calls).toEqual([[fileConflictKey(forest)]]);
    expect(shownToasts()).toEqual([{ kind: 'info', title: 'Your decision on Forest.cs no longer applies', detail: 'A directory decision took the file out of the merge.' }]);
  });

  it('counts several, and says nothing when a decided file only moved', () => {
    useToastStore.setState({ toasts: [] });
    const reset = vi.fn();

    forgetLostFileDecisions(planWith(forest, desert), planWith({ ...forest, path: '/maps/Forest.cs' }), [stateOf(forest, true), stateOf(desert, true)], reset);
    expect(shownToasts()).toEqual([{ kind: 'info', title: 'Your decision on Desert.cs no longer applies', detail: 'A directory decision took the file out of the merge.' }]);

    useToastStore.setState({ toasts: [] });
    forgetLostFileDecisions(planWith(forest, desert, player), planWith(), [stateOf(forest, true), stateOf(desert, true)], reset);
    expect(shownToasts()).toEqual([{ kind: 'info', title: 'Your decisions on 2 files no longer apply', detail: 'A directory decision took them out of the merge.' }]);

    useToastStore.setState({ toasts: [] });
    forgetLostFileDecisions(planWith(forest), planWith({ ...forest, path: '/maps/Forest.cs' }), [stateOf(forest, true)], reset);
    expect(shownToasts()).toEqual([]);
  });
});
