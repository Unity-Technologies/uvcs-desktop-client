import { Plus, RefreshCw, Tags } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AttributeType } from '@shared/domain/attribute';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { ListWithDetails } from '../../components/ListWithDetails';
import { ListWithDetailsSkeleton } from '../../components/ListWithDetailsSkeleton';
import { NoSelection } from '../../components/NoSelection';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { RelativeTime } from '../../ui/RelativeTime';
import { SearchField } from '../../ui/SearchField';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { ViewHeader } from '../../ui/ViewHeader';
import { editAttributeComment } from './attributeOperations';
import { AttributeTypeDetails } from './AttributeTypeDetails';
import { attributeTypeMenu } from './attributeTypeMenu';
import { openCreateAttributeDialog } from './CreateAttributeDialog';
import { useAttributeTypes } from './useAttributes';

const COLUMNS: Column<AttributeType>[] = [
  {
    id: 'name',
    header: 'Name',
    grow: 1,
    sortValue: (type) => type.name,
    render: (type) => (
      <strong>
        <Highlight text={type.name} />
      </strong>
    ),
  },
  { id: 'comment', header: 'Comment', grow: 3, secondary: true, render: (type) => <Highlight text={type.comment} /> },
  { id: 'owner', header: 'Created by', width: 180, sortValue: (type) => type.owner, render: (type) => <UserLabel user={type.owner} /> },
  { id: 'date', header: 'Created', width: 130, secondary: true, sortValue: (type) => type.date, render: (type) => <RelativeTime date={type.date} /> },
];

export function AttributesView() {
  const workspacePath = useWorkspacePath();
  const { data: types, isLoading, isFetching, error } = useAttributeTypes();
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useViewSelection('attributes');

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (types ?? []).filter((type) => `${type.name} ${type.comment}`.toLowerCase().includes(needle));
  }, [types, search]);
  const selected = visible.find((type) => type.name === selection.anchor);

  return (
    <>
      <ViewHeader
        title="Attributes"
        subtitle={types && `${types.length}`}
        actions={
          <>
            <IconButton icon={<RefreshCw size={14} className={isFetching ? 'spinning' : undefined} />} label="Refresh" onClick={() => void invalidateWorkspace(workspacePath)} />
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => openCreateAttributeDialog(workspacePath)}>
              New attribute
            </Button>
          </>
        }
      >
        <SearchField value={search} onChange={setSearch} placeholder="Filter attributes" />
      </ViewHeader>
      {isLoading ? (
        <ListWithDetailsSkeleton columns={COLUMNS} />
      ) : error ? (
        <EmptyState title="Couldn't load attributes" description={error.message} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Tags size={22} />}
          title="No attributes"
          description="Create an attribute, then set its value from the details of any branch, changeset or label."
          action={<Button onClick={() => openCreateAttributeDialog(workspacePath)}>New attribute</Button>}
        />
      ) : (
        <ListWithDetails
          list={
            <HighlightQuery query={search.trim()}>
              <DataTable
                rows={visible}
                columns={COLUMNS}
                rowKey={(type) => type.name}
                selection={selection}
                onSelectionChange={setSelection}
                selectFirstRow
                onActivate={(type) => void editAttributeComment(workspacePath, type)}
                contextMenu={(selectedTypes) => attributeTypeMenu(workspacePath, selectedTypes)}
              />
            </HighlightQuery>
          }
          details={
            selected ? (
              <AttributeTypeDetails key={selected.name} workspacePath={workspacePath} type={selected} menu={attributeTypeMenu(workspacePath, [selected])} />
            ) : (
              <NoSelection noun="attribute" />
            )
          }
        />
      )}
    </>
  );
}
