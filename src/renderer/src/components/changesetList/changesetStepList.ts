import type { Changeset } from '@shared/domain/changeset';
import type { ChangesetSpan } from '../../app/navigation/pages';
import { commentLineText } from '../../lib/comments/commentText';
import { formatDateTime } from '../../lib/formatDate';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import type { SelectionState } from '../../lib/selection';
import { pluralize } from '../../lib/text';
import { displayName, userFilterTexts } from '../../lib/userName';

/**
 * The list of changesets a branch diff and Incoming step through (`ChangesetStepList`): a first row standing for all
 * of them combined ("All changes on task", "All incoming changes"), then the changesets oldest on top, one selected
 * showing its own diff and several selected showing as one (`changesetListChoice`).
 */

/** The key of the row standing for every changeset combined, among the changesets' numbers. */
export const ALL_CHANGES_KEY = 'all';

/** A row of the list: everything combined, or one changeset. */
export type ChangesetListRow = { kind: 'all' } | { kind: 'changeset'; changeset: Changeset };

const ALL_ROW: ChangesetListRow = { kind: 'all' };

export function changesetListRowKey(row: ChangesetListRow): string {
  return row.kind === 'all' ? ALL_CHANGES_KEY : String(row.changeset.id);
}

/**
 * The rows for the changesets `shown` (oldest first): everything combined on top, then each changeset. While words are
 * typed in the filter only the changesets they match show, without the combined row, which no word matches; its diff
 * stays shown while selected, as a changeset the filter hides does.
 */
export function changesetListRows(shown: readonly Changeset[], query: string): ChangesetListRow[] {
  const rows = shown.map((changeset): ChangesetListRow => ({ kind: 'changeset', changeset }));
  return query.trim() ? rows : [ALL_ROW, ...rows];
}

/** The selection of the combined row alone: what the list opens on. */
export const ALL_CHANGES_SELECTION: SelectionState = { selected: new Set([ALL_CHANGES_KEY]), anchor: ALL_CHANGES_KEY };

/**
 * Changesets as the list shows them: oldest on top, as a branch was built and as a review's conversation reads (`cm
 * find` reads them newest first). As the official client lists them.
 */
export function oldestFirst(changesets: readonly Changeset[]): Changeset[] {
  return [...changesets].sort((a, b) => a.id - b.id);
}

/**
 * The changesets the filter shows: every word in the number, the comment or the author, by the name shown and as
 * stored (`userFilterTexts`, ARCHITECTURE.md "Filters"). A blank filter shows them all.
 */
export function filterChangesets(changesets: readonly Changeset[], query: string): readonly Changeset[] {
  if (!query.trim()) return changesets;
  return changesets.filter((changeset) => matchesWordFilter([String(changeset.id), changeset.comment, ...userFilterTexts(changeset.owner)], query));
}

/** The filter field's placeholder: "Filter 11 changesets"; "Filter changesets" while they're read (undefined). */
export function changesetFilterPlaceholder(count: number | undefined): string {
  return count === undefined ? 'Filter changesets' : `Filter ${pluralize(count, 'changeset')}`;
}

/** A row's tooltip: the comment's first line, then who, when (in full) and which changeset, which the row says shortly. */
export function changesetRowTip(changeset: Changeset): { text: string; sub: string } {
  return {
    text: commentLineText(changeset.comment) || 'No comment',
    sub: `${displayName(changeset.owner)} · ${formatDateTime(changeset.date)} · cs:${changeset.id}`,
  };
}

/**
 * A selection as the list keeps it, from the one the rows were given (`orderedKeys`, the rows' keys top to bottom):
 * several changesets show as one diff, every changeset between them in it, so every row between is selected too, the
 * selection one band; and the combined row joins no other, as it holds them all: with changesets, it is left out
 * (Shift-click from it to a changeset selects the branch up to that changeset).
 */
export function changesetListSelection(next: SelectionState, orderedKeys: readonly string[]): SelectionState {
  if (next.selected.size < 2) return next;
  const places = orderedKeys.flatMap((key, index) => (key !== ALL_CHANGES_KEY && next.selected.has(key) ? [index] : []));
  if (places.length === 0) return next;
  const band = orderedKeys.slice(Math.min(...places), Math.max(...places) + 1);
  const anchor = next.anchor !== null && band.includes(next.anchor) ? next.anchor : band.at(-1)!;
  return { selected: new Set(band), anchor };
}

/**
 * The changesets the selection shows (`changesetListChoice`), by number: those selected, or the one last clicked when
 * a Cmd/Ctrl-click took the last one out, so the pane never goes blank. None for the combined row.
 */
export function selectedChangesetIds(selection: SelectionState): number[] {
  const keys = selection.selected.size > 0 ? [...selection.selected] : selection.anchor === null ? [] : [selection.anchor];
  return keys.filter((key) => key !== ALL_CHANGES_KEY).map(Number);
}

/**
 * The changeset one `step` away from the one selected among the `shown` ones (1: the next row down, newer; -1: up,
 * older), or null at either end. From the combined row (`selectedId` null) a step down goes to the oldest shown.
 * `listed` is every changeset in the list's order (`oldestFirst`): a selected changeset the filter hides keeps its
 * place in it, so the step goes to the nearest shown one on that side.
 */
export function changesetStep(listed: readonly Changeset[], shown: readonly Changeset[], selectedId: number | null, step: 1 | -1): number | null {
  if (selectedId === null) return step === 1 ? (shown[0]?.id ?? null) : null;
  const shownIds = new Set(shown.map((changeset) => changeset.id));
  const start = listed.findIndex((changeset) => changeset.id === selectedId);
  if (start === -1) return null;
  for (let index = start + step; index >= 0 && index < listed.length; index += step) {
    const candidate = listed[index]!;
    if (shownIds.has(candidate.id)) return candidate.id;
  }
  return null;
}

/** What the place around the list asks it to select: everything combined, one changeset, or a span of them. */
export type ChangesetListFocus = { kind: 'all' } | { kind: 'changeset'; changesetId: number } | { kind: 'span'; span: ChangesetSpan };

/**
 * The selection a focus asks for: the combined row, a changeset, or every changeset of the span (the newest the
 * anchor), so they show as one diff. While the changesets are read, a span's ends, which show the same diff.
 */
export function focusSelection(focus: ChangesetListFocus, changesets: readonly Changeset[] | undefined): SelectionState {
  if (focus.kind === 'all') return ALL_CHANGES_SELECTION;
  if (focus.kind === 'changeset') return { selected: new Set([String(focus.changesetId)]), anchor: String(focus.changesetId) };
  const { oldest, newest } = focus.span;
  const inSpan = (changesets ?? []).filter((changeset) => changeset.id >= oldest && changeset.id <= newest).map((changeset) => String(changeset.id));
  return { selected: new Set([String(oldest), String(newest), ...inSpan]), anchor: String(newest) };
}

/** The row a focus brings into view: the newest of a span, at its bottom. */
export function focusRevealKey(focus: ChangesetListFocus): string {
  if (focus.kind === 'all') return ALL_CHANGES_KEY;
  return String(focus.kind === 'changeset' ? focus.changesetId : focus.span.newest);
}

/** A row's height: one line, as a commit picker lists them. */
export const CHANGESET_ROW_HEIGHT = 28;

/** The room the list's rows keep above and below them, as every list without column titles (`DataTable`'s inset). */
const ROWS_INSET = 8;

/**
 * How tall the list's rows are drawn: every place (the rows, and a line between two of them) up to `fewest` and
 * `most`, those past it scrolling inside, so the files under the list keep their room. While the changesets are read
 * (`places` undefined), its tallest, which the rows then rarely leave.
 */
export function changesetRowsHeight(places: number | undefined, { fewest = 1, most }: { fewest?: number; most: number }): number {
  const shown = places === undefined ? most : Math.min(Math.max(places, fewest), most);
  return shown * CHANGESET_ROW_HEIGHT + ROWS_INSET;
}
