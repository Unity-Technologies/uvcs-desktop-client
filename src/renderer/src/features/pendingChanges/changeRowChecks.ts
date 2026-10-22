import type { PendingChange } from '@shared/domain/pendingChanges';
import type { CheckState } from '../../ui/Checkbox';
import { isCheckinCandidate } from './changeCategories';
import { changesUnderRow, type ChangeRow } from './changeRows';

/** A file's check, or a folder's or changelist's over what it holds that can go into a check-in; null when none can (ignored files). */
export function rowCheckState(row: ChangeRow, isChecked: (change: PendingChange) => boolean): CheckState | null {
  return checkStateOver(candidatesUnderRow(row), isChecked);
}

/** What a row holds that can go into a check-in: found once per layout, as a folder can hold a million. */
export function candidatesUnderRow(row: ChangeRow): PendingChange[] {
  return changesUnderRow(row).filter(isCheckinCandidate);
}

/**
 * The check of a row holding `candidates` (`candidatesUnderRow`): `isChosen` tells whether each is checked, null when
 * every one is (`CheckinSelection.isChosen`), which a folder of a million then tells at once.
 */
export function checkStateOver(candidates: PendingChange[], isChosen: ((change: PendingChange) => boolean) | null): CheckState | null {
  if (candidates.length === 0) return null;
  if (isChosen === null) return true;
  let checked = 0;
  for (const change of candidates) if (isChosen(change)) checked++;
  if (checked === 0) return false;
  return checked === candidates.length ? true : 'mixed';
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
