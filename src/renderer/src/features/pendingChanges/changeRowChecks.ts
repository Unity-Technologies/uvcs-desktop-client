import type { PendingChange } from '@shared/domain/pendingChanges';
import type { CheckState } from '../../ui/Checkbox';
import { countIn, wholeList, type ItemRange } from '../../lib/itemRange';
import { isCheckinCandidate } from './changeCategories';
import type { ChangeRow } from './changeRows';

/** What a row holds, and how many of those changes can go into a check-in (`candidatesUnderRow`). */
export interface RowCandidates {
  held: ItemRange<PendingChange>;
  count: number;
}

/**
 * What a row holds that can go into a check-in: counted once per layout, as a folder can hold a million, and counted
 * where the changes are, never copied.
 */
export function candidatesUnderRow(row: ChangeRow): RowCandidates {
  const held = row.type === 'file' ? wholeList([row.item]) : row.held;
  return { held, count: countIn(held, isCheckinCandidate) };
}

/**
 * A file's check, or a folder's or changelist's over what it holds that can go into a check-in (`candidates`:
 * `candidatesUnderRow`), null when nothing can (ignored files). `isChosen` tells whether each is checked, null when
 * every one is (`CheckinSelection.everyCandidateIncluded`), which a folder of a million then tells at once. `shown`:
 * how many changes shown can go in, and how many are checked; a row holding as many holds them all (the folders above
 * everything), and takes its check from them without asking.
 */
export function checkStateOver(candidates: RowCandidates, isChosen: ((change: PendingChange) => boolean) | null, shown?: ShownCount): CheckState | null {
  if (candidates.count === 0) return null;
  if (isChosen === null) return true;
  const checked = shown && candidates.count === shown.candidates ? shown.checked : countIn(candidates.held, (change) => isChosen(change) && isCheckinCandidate(change));
  if (checked === 0) return false;
  return checked === candidates.count ? true : 'mixed';
}

/** How many changes shown can go into a check-in, and how many of them are checked (`shownChecksOf`). */
export interface ShownCount {
  candidates: number;
  checked: number;
}

/** What Space checks or unchecks, and which way. */
export interface SpaceToggle {
  rows: ChangeRow[];
  include: boolean;
}

/**
 * Space on the list: the selected files, checked unless every one already is. With no file selected, the folder or
 * changelist the keyboard is on, over what it holds, unless nothing in it can be checked in.
 */
export function spaceToggle(selectedRows: ChangeRow[], focusedRow: ChangeRow | undefined, checkStateOf: (row: ChangeRow) => CheckState | null): SpaceToggle {
  if (selectedRows.length === 0 && focusedRow && focusedRow.type !== 'file') {
    const focusedState = checkStateOf(focusedRow);
    if (focusedState !== null) return { rows: [focusedRow], include: focusedState !== true };
  }
  return { rows: selectedRows, include: selectedRows.some((row) => checkStateOf(row) !== true) };
}
