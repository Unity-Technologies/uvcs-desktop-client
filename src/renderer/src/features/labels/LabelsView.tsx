import { Plus, RefreshCw, Tag } from 'lucide-react';
import { useMemo } from 'react';
import type { Label } from '@shared/domain/label';
import { useRenameCommand } from '../../app/commands/useRenameCommand';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { ListWithDetails } from '../../components/ListWithDetails';
import { ListWithDetailsSkeleton } from '../../components/ListWithDetailsSkeleton';
import { NoSelection } from '../../components/NoSelection';
import { ObjectName } from '../../components/ObjectName';
import { PathLabel } from '../../components/PathLabel';
import { useWorkspaceUser } from '../../app/account/accounts';
import { PeopleFilter } from '../../components/people/PeopleFilter';
import { usePeopleSeen } from '../../components/people/usePeopleSeen';
import { SincePicker } from '../../components/SincePicker';
import { matchesPeople, PICKING_PAUSE_MS } from '../../lib/peopleFilter';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { isFiltering } from '../../lib/viewFilters';
import { FilterBar } from '../../ui/FilterBar';
import { FilterField } from '../../ui/FilterField';
import { NoMatches } from '../../ui/NoMatches';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { labelFilterTexts, labelsQuery } from './labelFilters';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { RelativeTime } from '../../ui/RelativeTime';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { ViewHeader } from '../../ui/ViewHeader';
import { openCreateLabelDialog } from './CreateLabelDialog';
import { LabelDetails } from './LabelDetails';
import { labelMenu } from './labelMenu';
import { renameLabel, showLabelChanges } from './labelOperations';
import { useLabelsViewStore } from './labelsViewStore';
import { useLabels } from './useLabels';
import { labelCopyTexts } from './labelMenu';
import { useCopyCommand } from '../../app/commands/useCopyCommand';

const COLUMNS: Column<Label>[] = [
  {
    id: 'name',
    header: 'Name',
    grow: 2,
    sortValue: (label) => label.name,
    render: (label) => <ObjectName icon={Tag} name={label.name} />,
  },
  { id: 'changeset', header: 'Changeset', width: 100, sortValue: (label) => label.changeset, render: (label) => <span className="mono">{label.changeset}</span> },
  { id: 'branch', header: 'Branch', grow: 1, secondary: true, sortValue: (label) => label.branch, render: (label) => <PathLabel path={label.branch} /> },
  { id: 'comment', header: 'Comment', grow: 2, secondary: true, hideBelow: 640, render: (label) => <Highlight text={label.comment} /> },
  { id: 'owner', header: 'Created by', width: 180, hideBelow: 760, sortValue: (label) => label.owner, render: (label) => <UserLabel user={label.owner} /> },
  { id: 'date', header: 'Created', width: 130, secondary: true, sortValue: (label) => label.date, render: (label) => <RelativeTime date={label.date} /> },
];

export function LabelsView() {
  const workspacePath = useWorkspacePath();
  const filters = useLabelsViewStore();
  const { text: search, people, since, update } = filters;
  const me = useWorkspaceUser();
  const queriedPeople = useDebouncedValue(people, PICKING_PAUSE_MS);
  const { data: labels, isLoading, isFetching, error } = useLabels(labelsQuery({ since, people: queriedPeople }));
  const offered = usePeopleSeen('labels', labels, ownerOf);
  const [selection, setSelection] = useViewSelection('labels');

  const visible = useMemo(
    () => (labels ?? []).filter((label) => matchesPeople(people, me, label.owner) && matchesWordFilter(labelFilterTexts(label), search)),
    [labels, people, me, search],
  );
  const selected = visible.find((label) => labelKey(label) === selection.anchor);
  useRenameCommand('Labels', 'label', selection.selected.size === 1 ? selected : undefined, (label) => void renameLabel(workspacePath, label));
  useCopyCommand('Labels', 'Label', selection.selected.size === 1 && selected ? labelCopyTexts(selected) : undefined);
  const filtering = isFiltering(filters);

  return (
    <>
      <ViewHeader
        title="Labels"
        count={labels && visible.length}
        total={labels?.length}
        actions={
          <>
            <IconButton icon={<RefreshCw size={14} className={isFetching ? 'spinning' : undefined} />} label="Refresh" onClick={() => void invalidateWorkspace(workspacePath)} />
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => openCreateLabelDialog(workspacePath)}>
              New label
            </Button>
          </>
        }
      >
        <FilterBar
          text={<FilterField value={search} onChange={(text) => update({ text })} placeholder="Filter labels" />}
          people={<PeopleFilter value={people} onChange={(value) => update({ people: value })} people={offered} mineTip="Labels you created" />}
          time={<SincePicker value={since} onChange={(value) => update({ since: value })} />}
        />
      </ViewHeader>
      {isLoading ? (
        <ListWithDetailsSkeleton widthKey="labels" columns={COLUMNS} />
      ) : error ? (
        <EmptyState title="Couldn't load labels" description={error.message} />
      ) : visible.length === 0 && filtering ? (
        <NoMatches icon={<Tag size={22} />} noun="labels" hint={since === 'anyTime' ? undefined : 'The filters look within the time range. Try a longer one.'} onClear={filters.clear} />
      ) : visible.length === 0 && since !== 'anyTime' ? (
        <EmptyState icon={<Tag size={22} />} title="No labels" description="Try a longer time range." />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Tag size={22} />}
          title="No labels"
          description="Labels mark important changesets, like releases."
          action={<Button onClick={() => openCreateLabelDialog(workspacePath)}>Label your workspace changeset</Button>}
        />
      ) : (
        <ListWithDetails widthKey="labels"
          list={
            <HighlightQuery query={search}>
              <DataTable
                rows={visible}
                columns={COLUMNS}
                rowKey={labelKey}
                selection={selection}
                onSelectionChange={setSelection}
                selectFirstRow
                onActivate={(label) => showLabelChanges(label)}
                contextMenu={(selectedLabels) => labelMenu(workspacePath, selectedLabels)}
              />
            </HighlightQuery>
          }
          details={
            selected ? <LabelDetails key={selected.name} workspacePath={workspacePath} label={selected} menu={labelMenu(workspacePath, [selected])} /> : <NoSelection noun="label" />
          }
        />
      )}
    </>
  );
}

const ownerOf = (label: Label): string => label.owner;

/** By id, so a renamed label stays selected. */
function labelKey(label: Label): string {
  return String(label.id);
}
