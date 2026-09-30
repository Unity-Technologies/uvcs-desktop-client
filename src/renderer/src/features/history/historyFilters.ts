import type { Label } from '@shared/domain/label';
import { matchesPeople, type PeoplePick } from '../../lib/peopleFilter';
import { ownerOf, type HistoryRow } from './historyRows';
import { matchesHistorySearch } from './historySearch';

export interface HistoryFilters {
  search: string;
  people: PeoplePick;
  /** The workspace's user, whom "Mine" picks. */
  me: string | undefined;
  /** The labels on each changeset, which the search finds a revision by. */
  labelsByChangeset: ReadonlyMap<number, readonly Label[]>;
}

/** The rows the history list shows: made by the people picked, and matching every word of the search. */
export function filteredHistoryRows(rows: readonly HistoryRow[], { search, people, me, labelsByChangeset }: HistoryFilters): HistoryRow[] {
  return rows.filter(
    (row) =>
      matchesPeople(people, me, ownerOf(row)) &&
      matchesHistorySearch(row, search, row.kind === 'revision' ? labelsByChangeset.get(row.revision.changesetId) : undefined),
  );
}
