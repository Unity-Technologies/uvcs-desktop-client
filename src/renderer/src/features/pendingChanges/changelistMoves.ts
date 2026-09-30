import type { PendingChange } from '@shared/domain/pendingChanges';
import { singleSelection, type SelectionState } from '../../lib/selection';
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
  return { changes: [row.change], select: singleSelection(row.key) };
}

/**
 * The changelist header each row is under, by row key: dropping changes on any row of a changelist, not only on its
 * header, moves them into it, as in the official client. Empty when the rows aren't grouped by changelist.
 */
export function changelistHeadersOf(rows: ChangeRow[]): Map<string, ChangeRow & { type: 'group' }> {
  const headers = new Map<string, ChangeRow & { type: 'group' }>();
  let header: (ChangeRow & { type: 'group' }) | undefined;
  for (const row of rows) {
    if (row.type === 'group') header = row;
    if (header) headers.set(row.key, header);
  }
  return headers;
}
