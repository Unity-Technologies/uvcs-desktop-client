import { displayName } from '../../lib/userName';
import type { HistoryRow } from './historyRows';

/** Whether a history row matches the filter: its changeset number, comment (or move), author or branch contains the text. */
export function matchesHistorySearch(row: HistoryRow, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  const fields =
    row.kind === 'revision'
      ? [String(row.revision.changesetId), row.revision.comment, row.revision.owner, displayName(row.revision.owner), row.revision.branch]
      : [String(row.change.changesetId), row.change.description, row.change.owner, displayName(row.change.owner)];
  return fields.some((field) => field.toLowerCase().includes(needle));
}
