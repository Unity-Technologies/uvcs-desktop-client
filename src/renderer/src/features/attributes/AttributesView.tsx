import { Plus, Tags } from 'lucide-react';
import { useMemo } from 'react';
import type { AttributeType } from '@shared/domain/attribute';
import { useRenameCommand } from '../../app/commands/useRenameCommand';
import { ViewRefreshButton } from '../../components/ViewRefreshButton';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { ObjectListView } from '../../components/ObjectListView';
import { ObjectName } from '../../components/ObjectName';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { userFilterTexts } from '../../lib/userName';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Highlight } from '../../ui/Highlight';
import { RelativeTime } from '../../ui/RelativeTime';
import { useWorkspaceUser } from '../../app/account/accounts';
import { PeopleFilter } from '../../components/people/PeopleFilter';
import { matchesPeople } from '../../lib/peopleFilter';
import { isFiltering } from '../../lib/viewFilters';
import { FilterBar } from '../../ui/FilterBar';
import { FilterField } from '../../ui/FilterField';
import { NoMatches } from '../../ui/NoMatches';
import { useAttributesViewStore } from './attributesViewStore';
import type { Column } from '../../ui/table/DataTable';
import { ViewHeader } from '../../ui/ViewHeader';
import { editAttributeComment, renameAttributeType } from './attributeOperations';
import { AttributeTypeDetails } from './AttributeTypeDetails';
import { attributeTypeMenu } from './attributeTypeMenu';
import { openCreateAttributeDialog } from './CreateAttributeDialog';
import { useAttributeTypes } from './useAttributes';

const COLUMNS: Column<AttributeType>[] = [
  {
    id: 'name',
    header: 'Name',
    grow: 2,
    sortValue: (type) => type.name,
    render: (type) => <ObjectName icon={Tags} name={type.name} />,
  },
  { id: 'comment', header: 'Comment', grow: 3, secondary: true, render: (type) => <Highlight text={type.comment} /> },
  { id: 'owner', header: 'Created by', width: 180, hideBelow: 700, sortValue: (type) => type.owner, render: (type) => <UserLabel user={type.owner} /> },
  { id: 'date', header: 'Created', width: 130, secondary: true, sortValue: (type) => type.date, render: (type) => <RelativeTime date={type.date} /> },
];

export function AttributesView() {
  const workspacePath = useWorkspacePath();
  const { data: types, isLoading, isFetching, error } = useAttributeTypes();
  const filters = useAttributesViewStore();
  const { text: search, people, update } = filters;
  const me = useWorkspaceUser();
  const [selection, setSelection] = useViewSelection('attributes');

  // Every attribute type is read: people are matched among them.
  const authors = useMemo(() => (types ?? []).map((type) => type.owner), [types]);
  const visible = useMemo(
    () => (types ?? []).filter((type) => matchesPeople(people, me, type.owner) && matchesWordFilter([type.name, type.comment, ...userFilterTexts(type.owner)], search)),
    [types, people, me, search],
  );
  const selected = visible.find((type) => typeKey(type) === selection.anchor);
  useRenameCommand('Attributes', 'attribute', selection.selected.size === 1 ? selected : undefined, (type) => void renameAttributeType(workspacePath, type));

  return (
    <>
      <ViewHeader
        title="Attributes"
        count={types && visible.length}
        total={types?.length}
        actions={
          <>
            <ViewRefreshButton workspacePath={workspacePath} fetching={isFetching} />
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => openCreateAttributeDialog(workspacePath)}>
              New attribute
            </Button>
          </>
        }
      >
        <FilterBar
          text={<FilterField value={search} onChange={(text) => update({ text })} placeholder="Filter attributes" />}
          people={<PeopleFilter value={people} onChange={(value) => update({ people: value })} people={authors} mineTip="Attributes you created" />}
        />
      </ViewHeader>
      <ObjectListView
        widthKey="attributes"
        loading={isLoading}
        error={error}
        errorTitle="Couldn't load attributes"
        empty={
          isFiltering(filters) ? (
            <NoMatches icon={<Tags size={22} />} noun="attributes" onClear={filters.clear} />
          ) : (
            <EmptyState
              icon={<Tags size={22} />}
              title="No attributes"
              description="Create an attribute, then set its value from the details of any branch, changeset or label."
              action={<Button onClick={() => openCreateAttributeDialog(workspacePath)}>New attribute</Button>}
            />
          )
        }
        query={search.trim()}
        rows={visible}
        columns={COLUMNS}
        rowKey={typeKey}
        selection={selection}
        onSelectionChange={setSelection}
        onActivate={(type) => void editAttributeComment(workspacePath, type)}
        contextMenu={(selectedTypes) => attributeTypeMenu(workspacePath, selectedTypes)}
        noun="attribute"
        details={selected && <AttributeTypeDetails key={selected.name} workspacePath={workspacePath} type={selected} menu={attributeTypeMenu(workspacePath, [selected])} />}
      />
    </>
  );
}

/** By id, so a renamed attribute stays selected. */
function typeKey(type: AttributeType): string {
  return String(type.id);
}
