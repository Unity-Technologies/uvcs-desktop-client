import { Archive, RefreshCw, User } from 'lucide-react';
import { useMemo } from 'react';
import type { Shelve } from '@shared/domain/shelve';
import { spec } from '@shared/domain/specs';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { authorColumn, avatarColumn, commentColumn, dateColumn, numberColumn, secondaryColumn } from '../../components/historyColumns';
import { ListWithDetails } from '../../components/ListWithDetails';
import { ListWithDetailsSkeleton } from '../../components/ListWithDetailsSkeleton';
import { NoSelection } from '../../components/NoSelection';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { SearchField } from '../../ui/SearchField';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { ToggleChip } from '../../ui/ToggleChip';
import { ViewHeader } from '../../ui/ViewHeader';
import { ShelveDetails } from './ShelveDetails';
import { shelveMenu } from './shelveMenu';
import { showShelveChanges } from './shelveOperations';
import { useShelves } from './useShelves';
import { shelvesEmptyState } from './shelvesEmptyState';
import { useShelvesViewStore } from './shelvesViewStore';
import { shelveCopyTexts } from './shelveMenu';
import { useCopyCommand } from '../../app/commands/useCopyCommand';

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
  const { onlyMine, setOnlyMine, search, setSearch } = useShelvesViewStore();
  const { data: shelves, isLoading, isFetching, error } = useShelves({ owner: onlyMine ? 'me' : undefined });
  const [selection, setSelection] = useViewSelection('shelves');

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (shelves ?? []).filter((shelve) => `${shelve.id} ${shelve.comment} ${shelve.owner}`.toLowerCase().includes(needle));
  }, [shelves, search]);
  const selected = visible.find((shelve) => shelveKey(shelve) === selection.anchor);
  useCopyCommand('Shelves', 'Shelve', selection.selected.size === 1 && selected ? shelveCopyTexts(selected) : undefined);

  return (
    <>
      <ViewHeader
        title="Shelves"
        count={shelves?.length}
        actions={<IconButton icon={<RefreshCw size={14} className={isFetching ? 'spinning' : undefined} />} label="Refresh" onClick={() => void invalidateWorkspace(workspacePath)} />}
      >
        <SearchField value={search} onChange={setSearch} placeholder="Filter shelves" />
        <ToggleChip pressed={onlyMine} onChange={setOnlyMine} icon={<User size={12} />}>
          Mine
        </ToggleChip>
      </ViewHeader>
      {isLoading ? (
        <ListWithDetailsSkeleton widthKey="shelves" columns={COLUMNS} />
      ) : error ? (
        <EmptyState title="Couldn't load shelves" description={error.message} />
      ) : visible.length === 0 ? (
        <ShelvesEmpty searching={search.trim() !== ''} onlyMine={onlyMine} onShowEveryone={() => setOnlyMine(false)} />
      ) : (
        <ListWithDetails widthKey="shelves"
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

function ShelvesEmpty({ searching, onlyMine, onShowEveryone }: { searching: boolean; onlyMine: boolean; onShowEveryone: () => void }) {
  const { title, description, offerEveryone } = shelvesEmptyState({ searching, onlyMine });
  return (
    <EmptyState
      icon={<Archive size={22} />}
      title={title}
      description={description}
      action={offerEveryone && <Button onClick={onShowEveryone}>Show everyone's shelves</Button>}
    />
  );
}

function shelveKey(shelve: Shelve): string {
  return String(shelve.id);
}
