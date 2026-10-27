import type { Changeset } from '@shared/domain/changeset';
import { matchesWordFilter } from '../../lib/matchesAllWords';

/**
 * The changesets a branch diff's "Changeset by changeset" list shows for its filter: every word in the number, the
 * comment or the author, as the rows show them. A blank filter shows them all.
 */
export function filterBranchChangesets(changesets: readonly Changeset[], query: string): readonly Changeset[] {
  if (!query.trim()) return changesets;
  return changesets.filter((changeset) => matchesWordFilter([String(changeset.id), changeset.comment, changeset.owner], query));
}

/**
 * The changeset one `step` away from `selectedId` among the `shown` ones (1: the next row down, older; -1: up,
 * newer), or null at either end. `changesets` is the whole branch, newest first: a selected changeset the filter hides
 * keeps its place in it, so the step goes to the nearest shown one on that side.
 */
export function changesetStep(changesets: readonly Changeset[], shown: readonly Changeset[], selectedId: number | null, step: 1 | -1): number | null {
  if (selectedId === null) return shown[0]?.id ?? null;
  const shownIds = new Set(shown.map((changeset) => changeset.id));
  const start = changesets.findIndex((changeset) => changeset.id === selectedId);
  if (start === -1) return null;
  for (let index = start + step; index >= 0 && index < changesets.length; index += step) {
    const candidate = changesets[index]!;
    if (shownIds.has(candidate.id)) return candidate.id;
  }
  return null;
}

/**
 * Whether the list of changesets shows above the files: while they're read, and when there are several. A branch with
 * one changeset has nothing to pick; the header already names it.
 */
export function showsChangesetList(changesets: readonly Changeset[] | undefined): boolean {
  return changesets === undefined || changesets.length > 1;
}
