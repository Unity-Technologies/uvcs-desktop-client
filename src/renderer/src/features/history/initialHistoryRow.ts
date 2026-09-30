import type { ItemHistory } from '@shared/domain/history';
import type { PageOf } from '../../app/navigation/pages';
import { historyRowKey, revisionIdRowKey, revisionRowKey, type HistoryRow } from './historyRows';

/**
 * The row a history opens on: the revision asked for; else, to annotate, the workspace's; else the newest revision,
 * rather than a move or a removal on another branch. Null while there is no revision to open on.
 */
export function initialHistoryRow(rows: readonly HistoryRow[], { workspaceRevisionId }: ItemHistory, page: PageOf<'history'>): string | null {
  const asked = page.select && ('changesetId' in page.select ? revisionRowKey(rows, page.select.changesetId) : revisionIdRowKey(rows, page.select.revisionId));
  const workspace = page.view === 'annotate' ? revisionIdRowKey(rows, workspaceRevisionId) : null;
  const newest = rows.find((row) => row.kind === 'revision');
  return asked || workspace || (newest ? historyRowKey(newest) : null);
}
