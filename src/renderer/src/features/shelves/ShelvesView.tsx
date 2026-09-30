import { Archive, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import type { Shelve } from '@shared/domain/shelve';
import { spec } from '@shared/domain/specs';
import { useWorkspaceUser } from '../../app/account/accounts';
import { useCopyCommand } from '../../app/commands/useCopyCommand';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { authorColumn, avatarColumn, commentColumn, dateColumn, numberColumn, secondaryColumn } from '../../components/historyColumns';
import { ListWithDetails } from '../../components/ListWithDetails';
import { ListWithDetailsSkeleton } from '../../components/ListWithDetailsSkeleton';
import { NoSelection } from '../../components/NoSelection';
import { PeopleFilter } from '../../components/people/PeopleFilter';
import { usePeopleSeen } from '../../components/people/usePeopleSeen';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { isOnlyMine, matchesPeople, pickedOwners, PICKING_PAUSE_MS } from '../../lib/peopleFilter';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { userFilterTexts } from '../../lib/userName';
import { isFiltering } from '../../lib/viewFilters';
import { EmptyState } from '../../ui/EmptyState';
import { FilterBar } from '../../ui/FilterBar';
import { FilterField } from '../../ui/FilterField';
import { HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { NoMatches } from '../../ui/NoMatches';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { ViewHeader } from '../../ui/ViewHeader';
import { ShelveDetails } from './ShelveDetails';
import { shelveCopyTexts, shelveMenu } from './shelveMenu';
import { showShelveChanges } from './shelveOperations';
import { useShelvesViewStore } from './shelvesViewStore';
import { useShelves } from './useShelves';

/** Read like the changesets list; where a changeset shows its branch, a shelve shows the changeset it was made on. */
const COLUMNS: Column<Shelve>[] = [
  avatarColumn(),
  numberColumn('Shelve'),
  commentColumn(),
  secondaryColumn('parent', 'Based on', {
    text: (shelve) => spec.changeset(shelve.parentChangeset),
    tip: (shelve) => `Changeset ${shelve.parentChangeset}`,
    sortValue: (shelve) => shelve.parentChangeset,
  }),
  authorColumn(),
  dateColumn(),
];

export function ShelvesView() {
  const workspacePath = useWorkspacePath();
  const filters = useShelvesViewStore();
  const { text: search, people, update } = filters;
  const me = useWorkspaceUser();
  const queriedPeople = useDebouncedValue(people, PICKING_PAUSE_MS);
  const { data: shelves, isLoading, isFetching, error } = useShelves({ owners: pickedOwners(queriedPeople) });
  const offered = usePeopleSeen('shelves', shelves, ownerOf);
  const [selection, setSelection] = useViewSelection('shelves');

  const visible = useMemo(
    () => (shelves ?? []).filter((shelve) => matchesPeople(people, me, shelve.owner) && matchesWordFilter(shelveFilterTexts(shelve), search)),
    [shelves, people, me, search],
  );
  const selected = visible.find((shelve) => shelveKey(shelve) === selection.anchor);
  useCopyCommand('Shelves', 'Shelve', selection.selected.size === 1 && selected ? shelveCopyTexts(selected) : undefined);

  return (
    <>
      <ViewHeader
        title="Shelves"
        count={shelves && visible.length}
        total={shelves?.length}
        actions={<IconButton icon={<RefreshCw size={14} className={isFetching ? 'spinning' : undefined} />} label="Refresh" onClick={() => void invalidateWorkspace(workspacePath)} />}
      >
        <FilterBar
          text={<FilterField value={search} onChange={(text) => update({ text })} placeholder="Filter shelves" />}
          people={<PeopleFilter value={people} onChange={(value) => update({ people: value })} people={offered} mineTip="Shelves you created" />}
        />
      </ViewHeader>
      {isLoading ? (
        <ListWithDetailsSkeleton widthKey="shelves" columns={COLUMNS} />
      ) : error ? (
        <EmptyState title="Couldn't load shelves" description={error.message} />
      ) : visible.length === 0 && isFiltering(filters) ? (
        <NoMatches icon={<Archive size={22} />} noun="shelves" hint={isOnlyMine(people) && !search.trim() ? 'You have no shelves.' : undefined} onClear={filters.clear} />
      ) : visible.length === 0 ? (
        <EmptyState icon={<Archive size={22} />} title="No shelves" description="Shelve pending changes from the Changes view to save them without checking in." />
      ) : (
        <ListWithDetails
          widthKey="shelves"
          list={
            <HighlightQuery query={search.trim()}>
              <DataTable
                rows={visible}
                columns={COLUMNS}
                rowKey={shelveKey}
                selection={selection}
                onSelectionChange={setSelection}
                selectFirstRow
                onActivate={showShelveChanges}
                contextMenu={(selectedShelves) => shelveMenu(workspacePath, selectedShelves)}
                initialSort={{ columnId: 'id', descending: true }}
              />
            </HighlightQuery>
          }
          details={
            selected ? <ShelveDetails key={selected.id} shelve={selected} menu={shelveMenu(workspacePath, [selected])} /> : <NoSelection noun="shelve" />
          }
        />
      )}
    </>
  );
}

const ownerOf = (shelve: Shelve): string => shelve.owner;

/** What the row shows: its number, comment, the changeset it's based on and its author. */
function shelveFilterTexts(shelve: Shelve): string[] {
  return [String(shelve.id), shelve.comment, spec.changeset(shelve.parentChangeset), ...userFilterTexts(shelve.owner)];
}

function shelveKey(shelve: Shelve): string {
  return String(shelve.id);
}
