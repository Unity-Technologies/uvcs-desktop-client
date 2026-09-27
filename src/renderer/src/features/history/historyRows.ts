import type { ItemHistory, ItemPathChange, ItemRevision } from '@shared/domain/history';

/** A row of the history table: a revision, or a changeset that moved or removed the item. */
export type HistoryRow = { kind: 'revision'; revision: ItemRevision } | { kind: 'pathChange'; change: ItemPathChange };

/** Newest first; a move in the changeset of a revision comes right below it. */
export function historyRows({ revisions, pathChanges }: ItemHistory): HistoryRow[] {
  const rows: HistoryRow[] = [
    ...revisions.map((revision): HistoryRow => ({ kind: 'revision', revision })),
    ...pathChanges.map((change): HistoryRow => ({ kind: 'pathChange', change })),
  ];
  return rows.sort((a, b) => changesetOf(b) - changesetOf(a));
}

export function historyRowKey(row: HistoryRow): string {
  return row.kind === 'revision' ? String(row.revision.changesetId) : `${row.change.changesetId}-path`;
}

export function changesetOf(row: HistoryRow): number {
  return row.kind === 'revision' ? row.revision.changesetId : row.change.changesetId;
}
