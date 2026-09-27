import type { Label } from '@shared/domain/label';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { userFilterTexts } from '../../lib/userName';
import type { HistoryRow } from './historyRows';

/** Whether each word of the filter is in the row's changeset number, comment (or move), labels, branch or author. */
export function matchesHistorySearch(row: HistoryRow, search: string, labels: readonly Label[] = []): boolean {
  const texts =
    row.kind === 'revision'
      ? [String(row.revision.changesetId), row.revision.comment, ...labels.map((label) => label.name), row.revision.branch, ...userFilterTexts(row.revision.owner)]
      : [String(row.change.changesetId), row.change.description, ...userFilterTexts(row.change.owner)];
  return matchesWordFilter(texts, search);
}
