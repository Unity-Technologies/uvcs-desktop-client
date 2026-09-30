import type { PendingChange } from '@shared/domain/pendingChanges';
import type { CheckState } from '../../ui/Checkbox';
import { isCheckinCandidate } from './changeCategories';
import type { ChangeRow } from './changeRows';

/** A file's check, or a folder's or changelist's over what it holds that can go into a check-in; null when none can (ignored files). */
export function rowCheckState(row: ChangeRow, isChecked: (change: PendingChange) => boolean): CheckState | null {
  if (row.type === 'change') return isCheckinCandidate(row.change) ? isChecked(row.change) : null;
  return combinedCheckState(row.changes, isChecked);
}

function combinedCheckState(changes: PendingChange[], isChecked: (change: PendingChange) => boolean): CheckState | null {
  let candidates = 0;
  let checked = 0;
  for (const change of changes) {
    if (!isCheckinCandidate(change)) continue;
    candidates++;
    if (isChecked(change)) checked++;
  }
  if (candidates === 0) return null;
  if (checked === 0) return false;
  return checked === candidates ? true : 'mixed';
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
  if (selectedRows.length === 0 && focusedRow && focusedRow.type !== 'change') {
    const focusedState = checkStateOf(focusedRow);
    if (focusedState !== null) return { rows: [focusedRow], include: focusedState !== true };
  }
  return { rows: selectedRows, include: selectedRows.some((row) => checkStateOf(row) !== true) };
}
