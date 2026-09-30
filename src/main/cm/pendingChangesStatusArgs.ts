import type { PendingChangesFilter } from '@shared/domain/pendingChanges';

/** `cm status` of what Changes lists: checkouts told apart from unchanged ones, changelists, and each kind of change the filter shows. */
export function pendingChangesStatusArgs(filter: PendingChangesFilter): string[] {
  return [
    'status',
    '--xml',
    '--iscochanged',
    '--changelists',
    '--controlledchanged',
    '--changed',
    '--localdeleted',
    ...(filter.detectLocalMoves ? ['--localmoved', `--percentofsimilarity=${filter.moveSimilarityPercent}`] : []),
    ...(filter.showPrivate ? ['--private'] : []),
    ...(filter.showIgnored ? ['--ignored'] : []),
    ...(filter.showCloaked ? ['--cloaked'] : []),
    ...(filter.showHiddenChanged ? ['--hiddenchanged'] : []),
  ];
}
