import { Plus, RefreshCw, Tags } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AttributeType } from '@shared/domain/attribute';
import { useRenameCommand } from '../../app/commands/useRenameCommand';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { ListWithDetails } from '../../components/ListWithDetails';
import { ListWithDetailsSkeleton } from '../../components/ListWithDetailsSkeleton';
import { NoSelection } from '../../components/NoSelection';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { userFilterTexts } from '../../lib/userName';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { RelativeTime } from '../../ui/RelativeTime';
import { SearchField } from '../../ui/SearchField';
import { cellText } from '../../ui/table/cellText';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { ViewHeader } from '../../ui/ViewHeader';
import { editAttributeComment, renameAttributeType } from './attributeOperations';
import { AttributeTypeDetails } from './AttributeTypeDetails';
import { attributeTypeMenu } from './attributeTypeMenu';
import { openCreateAttributeDialog } from './CreateAttributeDialog';
import { useAttributeTypes } from './useAttributes';
import styles from './AttributesView.module.css';

const COLUMNS: Column<AttributeType>[] = [
  {
    id: 'name',
    header: 'Name',
    grow: 1,
    sortValue: (type) => type.name,
    render: (type) => <strong className={styles.name}>{cellText(<Highlight text={type.name} />)}</strong>,
  },
  { id: 'comment', header: 'Comment', grow: 3, secondary: true, render: (type) => <Highlight text={type.comment} /> },
  { id: 'owner', header: 'Created by', width: 180, hideBelow: 700, sortValue: (type) => type.owner, render: (type) => <UserLabel user={type.owner} /> },
  { id: 'date', header: 'Created', width: 130, secondary: true, sortValue: (type) => type.date, render: (type) => <RelativeTime date={type.date} /> },
];

export function AttributesView() {
  const workspacePath = useWorkspacePath();
  const { data: types, isLoading, isFetching, error } = useAttributeTypes();
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useViewSelection('attributes');

  const visible = useMemo(
    () => (search.trim() ? (types ?? []).filter((type) => matchesWordFilter([type.name, type.comment, ...userFilterTexts(type.owner)], search)) : (types ?? [])),
    [types, search],
  );
  const selected = visible.find((type) => typeKey(type) === selection.anchor);
  useRenameCommand('Attributes', 'attribute', selection.selected.size === 1 ? selected : undefined, (type) => void renameAttributeType(workspacePath, type));

  return (
    <>
      <ViewHeader
        title="Attributes"
        count={types?.length}
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
        <ListWithDetailsSkeleton widthKey="attributes" columns={COLUMNS} />
      ) : error ? (
        <EmptyState title="Couldn't load attributes" description={error.message} />
      ) : visible.length === 0 && search.trim() ? (
        <EmptyState icon={<Tags size={22} />} title="No matching attributes" description="Try a different filter." />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Tags size={22} />}
          title="No attributes"
          description="Create an attribute, then set its value from the details of any branch, changeset or label."
          action={<Button onClick={() => openCreateAttributeDialog(workspacePath)}>New attribute</Button>}
        />
      ) : (
        <ListWithDetails widthKey="attributes"
          list={
            <HighlightQuery query={search.trim()}>
              <DataTable
                rows={visible}
                columns={COLUMNS}
                rowKey={typeKey}
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

/** By id, so a renamed attribute stays selected. */
function typeKey(type: AttributeType): string {
  return String(type.id);
}
