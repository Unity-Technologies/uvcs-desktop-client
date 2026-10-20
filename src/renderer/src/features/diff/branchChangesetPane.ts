import type { Changeset } from '@shared/domain/changeset';

/**
 * What a branch diff's "Changeset by changeset" mode shows beside its list: nothing while the changesets are read,
 * that the branch has none, or the diff of one changeset.
 */
export type BranchChangesetPane = { kind: 'reading' } | { kind: 'noChangesets' } | { kind: 'changeset'; changesetId: number };

/** `changesets`: the branch's, newest first, undefined while read; `selectedId`: the changeset selected in the list. */
export function branchChangesetPane(changesets: readonly Changeset[] | undefined, selectedId: number | null): BranchChangesetPane {
  if (!changesets) return { kind: 'reading' };
  if (selectedId === null) return { kind: 'noChangesets' };
  return { kind: 'changeset', changesetId: selectedId };
}
