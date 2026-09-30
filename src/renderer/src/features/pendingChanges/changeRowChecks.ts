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
