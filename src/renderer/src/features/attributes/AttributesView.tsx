import { MessageSquareText, Pencil, Plus, RefreshCw, Tags, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AttributeType } from '@shared/domain/attribute';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { ListWithDetails } from '../../components/ListWithDetails';
import { SEPARATOR, tidyMenu, type MenuEntry } from '../../lib/actions';
import { formatDateTime } from '../../lib/formatDate';
import { EMPTY_SELECTION, type SelectionState } from '../../lib/selection';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { DetailsPanel, DetailsSection, DetailsText } from '../../ui/DetailsPanel';
import { PropertyList } from '../../ui/PropertyList';
import { EmptyState } from '../../ui/EmptyState';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { RelativeTime } from '../../ui/RelativeTime';
import { SearchField } from '../../ui/SearchField';
import { CenteredSpinner } from '../../ui/Spinner';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { ViewHeader } from '../../ui/ViewHeader';
import { deleteAttributeTypes, editAttributeComment, renameAttributeType } from './attributeOperations';
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
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);

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
        <CenteredSpinner />
      ) : error ? (
        <EmptyState title="Couldn't load attributes" description={error.message} />
      ) : (
        <ListWithDetails
          list={
            visible.length === 0 ? (
              <EmptyState
                icon={<Tags size={22} />}
                title="No attributes"
                description="Create an attribute, then set its value from the details of any branch, changeset or label."
                action={<Button onClick={() => openCreateAttributeDialog(workspacePath)}>New attribute</Button>}
              />
            ) : (
              <HighlightQuery query={search.trim()}>
                <DataTable
                  rows={visible}
                  columns={COLUMNS}
                  rowKey={(type) => type.name}
                  selection={selection}
                  onSelectionChange={setSelection}
                  onActivate={(type) => void editAttributeComment(workspacePath, type)}
                  contextMenu={(selectedTypes) => attributeTypeMenu(workspacePath, selectedTypes)}
                />
              </HighlightQuery>
            )
          }
          details={selected ? <AttributeTypeDetails workspacePath={workspacePath} type={selected} /> : <EmptyState title="Select an attribute" />}
        />
      )}
    </>
  );
}

function attributeTypeMenu(workspacePath: string, types: AttributeType[]): MenuEntry[] {
  const single = types.length === 1 ? types[0]! : null;
  return tidyMenu([
    single && { id: 'comment', label: 'Edit comment…', icon: MessageSquareText, run: () => void editAttributeComment(workspacePath, single) },
    single && { id: 'rename', label: 'Rename…', icon: Pencil, run: () => void renameAttributeType(workspacePath, single) },
    SEPARATOR,
    types.length > 0 && { id: 'delete', label: 'Delete…', icon: Trash2, danger: true, run: () => void deleteAttributeTypes(workspacePath, types) },
  ]);
}

function AttributeTypeDetails({ workspacePath, type }: { workspacePath: string; type: AttributeType }) {
  return (
    <DetailsPanel
      icon={<Tags />}
      kind="Attribute"
      title={type.name}
      author={{ user: type.owner, date: type.date }}
      actions={
        <>
          <Button icon={<MessageSquareText size={14} />} onClick={() => void editAttributeComment(workspacePath, type)}>
            Edit comment
          </Button>
          <Button icon={<Pencil size={14} />} onClick={() => void renameAttributeType(workspacePath, type)}>
            Rename
          </Button>
        </>
      }
    >
      <DetailsSection title="Comment">
        <DetailsText text={type.comment} placeholder="No comment" />
      </DetailsSection>
      <DetailsSection title="Properties">
        <PropertyList
          properties={[
            { label: 'Created', value: formatDateTime(type.date) },
          ]}
        />
      </DetailsSection>
    </DetailsPanel>
  );
}
