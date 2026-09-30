import { useCallback, useMemo, useState } from 'react';
import { useWorkspaceUser } from '../../app/account/accounts';
import { EVERYONE, type PeoplePick } from '../../lib/peopleFilter';
import { useLabelsByChangeset } from '../labels/useLabelsByChangeset';
import { filteredHistoryRows } from './historyFilters';
import { ownerOf, type HistoryRow } from './historyRows';

/**
 * The history's filters, which last as long as its page: another file's history starts with everyone's revisions and
 * no search. `otherRepository`: the repository of a file under an xlink, whose changesets carry its own labels.
 */
export function useHistoryFilters(rows: readonly HistoryRow[], otherRepository: string | undefined) {
  const [search, setSearch] = useState('');
  const [people, setPeople] = useState<PeoplePick>(EVERYONE);
  const me = useWorkspaceUser();
  const labelsByChangeset = useLabelsByChangeset(otherRepository);
  const authors = useMemo(() => rows.map(ownerOf), [rows]);
  const visible = useMemo(() => filteredHistoryRows(rows, { search, people, me, labelsByChangeset }), [rows, search, people, me, labelsByChangeset]);
  const clear = useCallback(() => {
    setSearch('');
    setPeople(EVERYONE);
  }, []);
  return { search, setSearch, people, setPeople, authors, visible, clear };
}
