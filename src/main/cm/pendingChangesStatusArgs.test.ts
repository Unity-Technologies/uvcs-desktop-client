import { describe, expect, it } from 'vitest';
import type { PendingChangesFilter } from '@shared/domain/pendingChanges';
import { pendingChangesStatusArgs } from './pendingChangesStatusArgs';

const NO_FILTER: PendingChangesFilter = {
  detectLocalMoves: false,
  moveSimilarityPercent: 90,
  showPrivate: false,
  showIgnored: false,
  showCloaked: false,
  showHiddenChanged: false,
};

describe('pendingChangesStatusArgs', () => {
  it('asks for checkouts, changes and deletions, with changelists, when the filter shows nothing more', () => {
    expect(pendingChangesStatusArgs(NO_FILTER).join(' ')).toBe('status --xml --iscochanged --changelists --controlledchanged --changed --localdeleted');
  });

  it('asks for each kind of change the filter shows', () => {
    const everything = { detectLocalMoves: true, moveSimilarityPercent: 80, showPrivate: true, showIgnored: true, showCloaked: true, showHiddenChanged: true };

    expect(pendingChangesStatusArgs(everything).slice(7)).toEqual(['--localmoved', '--percentofsimilarity=80', '--private', '--ignored', '--cloaked', '--hiddenchanged']);
  });
});
