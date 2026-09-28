import { GitBranch, GitCommitVertical } from 'lucide-react';
import { useMemo } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { ListWithDetails } from '../../components/ListWithDetails';
import { ListWithDetailsSkeleton } from '../../components/ListWithDetailsSkeleton';
import { NoSelection } from '../../components/NoSelection';
import { EmptyState } from '../../ui/EmptyState';
import { HighlightQuery } from '../../ui/Highlight';
import { DataTable } from '../../ui/table/DataTable';
import { ViewHeader } from '../../ui/ViewHeader';
import { useLabelsByChangeset } from '../labels/useLabelsByChangeset';
import { changesetColumns } from './changesetColumns';
import { ChangesetDetails } from './ChangesetDetails';
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
import { ToggleChip } from '../../ui/ToggleChip';
import { changesetsCap, CLEARED_CHANGESET_FILTERS, matchesSearch, noChangesetsHint, toQueryFilter } from './changesetFilters';
import { useChangesetFilters } from './changesetsViewStore';
import { changesetMenu } from './changesetMenu';
import { openChangesetDiff, openRangeDiff } from './changesetOperations';
import { useChangesets } from './useChangesets';
import { hotkey } from '../../lib/shortcutRegistry';
import { changesetCopyTexts } from './changesetMenu';
import { useCopyCommand } from '../../app/commands/useCopyCommand';

const changesetKey = (changeset: Changeset): string => String(changeset.id);
const ownerOf = (changeset: Changeset): string => changeset.owner;

export function ChangesetsView() {
  const workspacePath = useWorkspacePath();
  const { data: workspace } = useWorkspaceInfo();
  const filters = useChangesetFilters();
  const { text, people, since, onlyCurrentBranch, update } = filters;
  const me = useWorkspaceUser();
  const [selection, setSelection] = useViewSelection('changesets');

  const currentBranch = workspace?.selector.kind === 'branch' ? workspace.selector.name : undefined;
  // The text is matched locally; only the other filters trigger a new `cm find`.
  const queriedPeople = useDebouncedValue(people, PICKING_PAUSE_MS);
  const queryFilter = useMemo(
    () => toQueryFilter({ since, people: queriedPeople, onlyCurrentBranch }, currentBranch, new Date()),
    [since, queriedPeople, onlyCurrentBranch, currentBranch],
  );
  const { data: changesets, isLoading, error } = useChangesets(queryFilter);

  const labelsByChangeset = useLabelsByChangeset();
  const offered = usePeopleSeen('changesets', changesets, ownerOf);
  // The people too, so a new pick narrows the rows shown at once, while their own are read.
  const visible = useMemo(
    () => (changesets ?? []).filter((changeset) => matchesPeople(people, me, changeset.owner) && matchesSearch(changeset, text, labelsByChangeset.get(changeset.id))),
    [changesets, people, me, text, labelsByChangeset],
  );
  const selected = visible.filter((changeset) => selection.selected.has(changesetKey(changeset)));
  const focused = visible.find((changeset) => changesetKey(changeset) === selection.anchor);
  useCopyCommand('Changesets', 'Changeset', selected.length === 1 ? changesetCopyTexts(workspacePath, selected[0]!) : undefined);
  const columns = useMemo(() => changesetColumns(workspace?.loadedChangeset, labelsByChangeset), [workspace?.loadedChangeset, labelsByChangeset]);
  const menuContext = { workspacePath, loadedChangeset: workspace?.loadedChangeset, loadedBranch: currentBranch };

  useCommands(
    useMemo<Command[]>(
      () => [
        {
          id: 'changesets.diff',
          group: 'Changesets',
          label: selected.length === 2 ? 'Diff selected changesets' : 'Diff selected changeset',
          shortcut: hotkey('listDiff'),
          disabled: selected.length === 0 || selected.length > 2,
          run: () => (selected.length === 2 ? openRangeDiff(...sortedPair(selected)) : openChangesetDiff(selected[0]!)),
        },
      ],
      [selected],
    ),
  );

  const cap = changesets && changesetsCap(visible.length, changesets.length, since);
  const filtering = isFiltering(filters, CLEARED_CHANGESET_FILTERS);
  const header = (
    <ViewHeader title="Changesets" count={cap ? undefined : changesets && visible.length} total={changesets?.length} subtitle={cap}>
      <FilterBar
        text={<FilterField value={text} onChange={(value) => update({ text: value })} placeholder="Filter changesets" />}
        people={<PeopleFilter value={people} onChange={(value) => update({ people: value })} people={offered} mineTip="Changesets you checked in" />}
        time={<SincePicker value={since} onChange={(value) => update({ since: value })} />}
        kinds={
          // Only while the workspace is on a branch.
          currentBranch && (
            <ToggleChip pressed={onlyCurrentBranch} icon={<GitBranch size={13} />} onChange={(value) => update({ onlyCurrentBranch: value })}>
              This branch
            </ToggleChip>
          )
        }
      />
    </ViewHeader>
  );

  if (error) return <>{header}<EmptyState title="Couldn't load changesets" description={error.message} /></>;
  if (isLoading) return <>{header}<ListWithDetailsSkeleton widthKey="changesets" columns={columns} /></>;

  return (
    <>
      {header}
      {visible.length === 0 && filtering ? (
        <NoMatches icon={<GitCommitVertical size={22} />} noun="changesets" hint={noChangesetsHint(since, true)} onClear={filters.clear} />
      ) : visible.length === 0 ? (
        <EmptyState icon={<GitCommitVertical size={22} />} title="No changesets" description={noChangesetsHint(since, false)} />
      ) : (
        <ListWithDetails widthKey="changesets"
          list={
            <HighlightQuery query={text}>
              <DataTable
                rows={visible}
                columns={columns}
                rowKey={changesetKey}
                selection={selection}
                onSelectionChange={setSelection}
                selectFirstRow
                onActivate={openChangesetDiff}
                contextMenu={(rows) => changesetMenu(menuContext, rows)}
              />
            </HighlightQuery>
          }
          details={
            focused ? <ChangesetDetails key={focused.id} changeset={focused} menu={changesetMenu(menuContext, [focused])} /> : <NoSelection noun="changeset" />
          }
        />
      )}
    </>
  );
}

function sortedPair(changesets: Changeset[]): [Changeset, Changeset] {
  return [...changesets].sort((a, b) => a.id - b.id) as [Changeset, Changeset];
}
