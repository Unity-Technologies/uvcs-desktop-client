import { Archive, RefreshCw, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Shelve } from '@shared/domain/shelve';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { ListWithDetails } from '../../components/ListWithDetails';
import { ListWithDetailsSkeleton } from '../../components/ListWithDetailsSkeleton';
import { NoSelection } from '../../components/NoSelection';
import { UserLabel } from '../../ui/Avatar';
import { EmptyState } from '../../ui/EmptyState';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { RelativeTime } from '../../ui/RelativeTime';
import { SearchField } from '../../ui/SearchField';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { ToggleChip } from '../../ui/ToggleChip';
import { ViewHeader } from '../../ui/ViewHeader';
import { ShelveDetails } from './ShelveDetails';
import { shelveMenu } from './shelveMenu';
import { showShelveChanges } from './shelveOperations';
import { useShelves } from './useShelves';
import { useShelvesViewStore } from './shelvesViewStore';
import styles from './ShelvesView.module.css';

const COLUMNS: Column<Shelve>[] = [
  {
    id: 'id',
    header: 'Shelve',
    width: 100,
    sortValue: (shelve) => shelve.id,
    render: (shelve) => (
      <span className={styles.id}>
        <Archive size={13} className={styles.icon} />
        <Highlight text={String(shelve.id)} />
      </span>
    ),
  },
  {
    id: 'comment',
    header: 'Comment',
    grow: 3,
    render: (shelve) => (shelve.comment ? <Highlight text={shelve.comment} /> : <span className={styles.noComment}>No comment</span>),
  },
  { id: 'parent', header: 'Based on', width: 100, align: 'end', secondary: true, hideBelow: 600, sortValue: (shelve) => shelve.parentChangeset, render: (shelve) => `cs:${shelve.parentChangeset}` },
  { id: 'owner', header: 'Created by', width: 180, hideBelow: 760, sortValue: (shelve) => shelve.owner, render: (shelve) => <UserLabel user={shelve.owner} /> },
  { id: 'date', header: 'Created', width: 130, secondary: true, sortValue: (shelve) => shelve.date, render: (shelve) => <RelativeTime date={shelve.date} /> },
];

export function ShelvesView() {
  const workspacePath = useWorkspacePath();
  const { onlyMine, setOnlyMine } = useShelvesViewStore();
  const { data: shelves, isLoading, isFetching, error } = useShelves({ owner: onlyMine ? 'me' : undefined });
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useViewSelection('shelves');

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (shelves ?? []).filter((shelve) => `${shelve.id} ${shelve.comment} ${shelve.owner}`.toLowerCase().includes(needle));
  }, [shelves, search]);
  const selected = visible.find((shelve) => shelveKey(shelve) === selection.anchor);

  return (
    <>
      <ViewHeader
        title="Shelves"
        subtitle={shelves && `${shelves.length}`}
        actions={<IconButton icon={<RefreshCw size={14} className={isFetching ? 'spinning' : undefined} />} label="Refresh" onClick={() => void invalidateWorkspace(workspacePath)} />}
      >
        <SearchField value={search} onChange={setSearch} placeholder="Filter shelves" />
        <ToggleChip pressed={onlyMine} onChange={setOnlyMine} icon={<User size={12} />}>
          Mine
        </ToggleChip>
      </ViewHeader>
      {isLoading ? (
        <ListWithDetailsSkeleton columns={COLUMNS} />
      ) : error ? (
        <EmptyState title="Couldn't load shelves" description={error.message} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Archive size={22} />}
          title="No shelves"
          description="Shelve pending changes from the Changes view to save them without checking in."
        />
      ) : (
        <ListWithDetails
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

function shelveKey(shelve: Shelve): string {
  return String(shelve.id);
}
