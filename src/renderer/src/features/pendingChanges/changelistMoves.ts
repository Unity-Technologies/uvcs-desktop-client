import type { PendingChange } from '@shared/domain/pendingChanges';
import type { SelectionState } from '../../lib/selection';
import { isControlled } from './changeCategories';
import type { ChangeRow } from './changeRows';

/** The changes that would actually move into `changelist` (null: the default one): controlled ones not already in it. */
export function changesToMove(changes: PendingChange[], changelist: string | null): PendingChange[] {
  return changes.filter((change) => isControlled(change) && (change.changelist ?? null) !== changelist);
}

/**
 * What dragging a file's row carries: the selection's changes under version control when the row is in it; otherwise
 * the row alone, which becomes the selection (`select`).
 */
export function dragFromRow(
  row: ChangeRow & { type: 'change' },
  selection: SelectionState,
  selectedChanges: () => PendingChange[],
): { changes: PendingChange[]; select?: SelectionState } {
  if (selection.selected.has(row.key)) return { changes: selectedChanges().filter(isControlled) };
  return { changes: [row.change], select: { selected: new Set([row.key]), anchor: row.key } };
}
