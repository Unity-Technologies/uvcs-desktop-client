import type { DiffFocusRequest } from './diffFocusRequest';
import type { BranchStart } from '@shared/domain/branch';
import type { Changeset } from '@shared/domain/changeset';
import type { ChangesetSpan } from '../../app/navigation/pages';
import type { SelectionState } from '../../lib/selection';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { pluralize } from '../../lib/text';
import { userFilterTexts } from '../../lib/userName';
import { newChangesetsOf, type ReviewedUpTo } from './branchChangesetRows';

/**
 * The changesets a branch diff's "Changeset by changeset" list shows for its filter: every word in the number, the
 * comment or the author, by the name shown and as stored (`userFilterTexts`, ARCHITECTURE.md "Filters"). A blank
 * filter shows them all.
 */
export function filterBranchChangesets(changesets: readonly Changeset[], query: string): readonly Changeset[] {
  if (!query.trim()) return changesets;
  return changesets.filter((changeset) => matchesWordFilter([String(changeset.id), changeset.comment, ...userFilterTexts(changeset.owner)], query));
}

/** The list's filters: the words typed, and New (only the changesets new since the user's review). */
export interface BranchChangesetFilter {
  query: string;
  onlyNew: boolean;
}

/**
 * The changesets the list shows: with New on, those new since the user's review (`newChangesetsOf`), then those the
 * words typed match (`filterBranchChangesets`). New shows only while some are new; when none is (before a review, or
 * after another), it keeps nothing out.
 */
export function shownBranchChangesets(changesets: readonly Changeset[], { query, onlyNew }: BranchChangesetFilter, reviewedUpTo: ReviewedUpTo | undefined): readonly Changeset[] {
  const newOnes = onlyNew ? newChangesetsOf(changesets, reviewedUpTo) : [];
  return filterBranchChangesets(newOnes.length > 0 ? newOnes : changesets, query);
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

/** The filter field's placeholder: "Filter 11 changesets"; "Filter changesets" while they're read (undefined). */
export function changesetFilterPlaceholder(count: number | undefined): string {
  return count === undefined ? 'Filter changesets' : `Filter ${pluralize(count, 'changeset')}`;
}

/**
 * Where `branch` starts, from its changesets read whole, newest first (no limit): the oldest one, and its parent. So
 * the list's menus offer the branch diff up to a changeset with no command, and not on the first changeset. None while
 * the list still shows another branch's changesets, kept while the branch's own are read.
 */
export function branchStartOfChangesets(branch: string, changesets: readonly Changeset[] | undefined): BranchStart | null {
  const first = changesets?.at(-1);
  return first && first.branch === branch ? { firstChangeset: first.id, base: first.parent } : null;
}

/** How a branch's diff shows its changes: all at once, or one changeset at a time. */
export type BranchDiffMode = 'wholeBranch' | 'byChangeset';

/** A changeset a branch's diff is asked to show, the how-many-th time (`DiffFocusRequest.seq`). */
export interface ChangesetToShow {
  changesetId: number;
  seq: number;
}

/**
 * What a branch's diff switches to when its place asks for a file in a mode (`DiffFocusRequest`): the whole branch, or
 * a changeset stepped to; nothing when the request leaves the mode as it is.
 */
export function branchDiffShownFor(request: Pick<DiffFocusRequest, 'changesetId' | 'seq'> | null): { mode: BranchDiffMode; changeset?: ChangesetToShow } | null {
  if (!request || request.changesetId === undefined) return null;
  if (request.changesetId === null) return { mode: 'wholeBranch' };
  return { mode: 'byChangeset', changeset: { changesetId: request.changesetId, seq: request.seq } };
}

/**
 * The list's selection for a span asked for (a review's changes opened on what's new, `focusChangesets`): every
 * changeset in it, the newest the anchor, so they show as one diff (`branchChangesetPane`). While the changesets are
 * read, its ends, which show the same diff.
 */
export function spanSelection(changesets: readonly Changeset[] | undefined, { oldest, newest }: ChangesetSpan): SelectionState {
  const inSpan = (changesets ?? []).filter((changeset) => changeset.id >= oldest && changeset.id <= newest).map((changeset) => String(changeset.id));
  return { selected: new Set([String(oldest), String(newest), ...inSpan]), anchor: String(newest) };
}
