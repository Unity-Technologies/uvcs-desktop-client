import { GitCommitVertical } from 'lucide-react';
import { useMemo } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { ObjectListView } from '../../components/ObjectListView';
import { EmptyState } from '../../ui/EmptyState';
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
import { FilterBar } from '../../ui/FilterBar';
import { FilterField } from '../../ui/FilterField';
import { NoMatches } from '../../ui/NoMatches';
import { BranchScopeFilter } from './BranchScopeFilter';
import {
  ALL_BRANCHES,
  branchOf,
  branchScopeIn,
  changesetsCap,
  CURRENT_BRANCH,
  isFilteringChangesets,
  matchesSearch,
  noChangesetsHint,
  pickedBranchFilters,
  toQueryFilter,
} from './changesetFilters';
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
  const { text, people, since, update } = filters;
  const me = useWorkspaceUser();
  const [selection, setSelection] = useViewSelection('changesets');

  const currentBranch = workspace?.selector.kind === 'branch' ? workspace.selector.name : undefined;
  const branchScope = branchScopeIn(filters, workspacePath, currentBranch);
  const branch = branchOf(branchScope);
  // The text is matched locally; only the other filters trigger a new `cm find`.
  const queriedPeople = useDebouncedValue(people, PICKING_PAUSE_MS);
  const queryFilter = useMemo(() => toQueryFilter({ since, people: queriedPeople }, branch, new Date()), [since, queriedPeople, branch]);
  const { data: changesets, isPending, error } = useChangesets(queryFilter);

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
  const filtering = isFilteringChangesets(filters, branchScope);
  const header = (
    <ViewHeader title="Changesets" count={cap ? undefined : changesets && visible.length} total={changesets?.length} subtitle={cap}>
      <FilterBar
        text={<FilterField value={text} onChange={(value) => update({ text: value })} placeholder="Filter changesets" />}
        people={<PeopleFilter value={people} onChange={(value) => update({ people: value })} people={offered} mineTip="Changesets you checked in" />}
        time={<SincePicker value={since} onChange={(value) => update({ since: value })} />}
        kinds={
          <BranchScopeFilter
            workspacePath={workspacePath}
            scope={branchScope}
            currentBranch={currentBranch}
            onShowAll={() => update(ALL_BRANCHES)}
            onShowCurrent={() => update(CURRENT_BRANCH)}
            onPick={(name) => update(pickedBranchFilters(workspacePath, name))}
          />
        }
      />
    </ViewHeader>
  );

  return (
    <>
      {header}
      <ObjectListView
        widthKey="changesets"
        loading={isPending}
        error={error}
        errorTitle="Couldn't load changesets"
        filtering={filtering}
        noMatches={<NoMatches icon={<GitCommitVertical size={22} />} noun="changesets" hint={noChangesetsHint(since, true)} onClear={filters.clear} />}
        emptyState={<EmptyState icon={<GitCommitVertical size={22} />} title="No changesets" description={noChangesetsHint(since, false)} />}
        query={text}
        rows={visible}
        columns={columns}
        rowKey={changesetKey}
        selection={selection}
        onSelectionChange={setSelection}
        onActivate={openChangesetDiff}
        contextMenu={(rows) => changesetMenu(menuContext, rows)}
        noun="changeset"
        details={focused && <ChangesetDetails key={focused.id} changeset={focused} menu={changesetMenu(menuContext, [focused])} />}
      />
    </>
  );
}

function sortedPair(changesets: Changeset[]): [Changeset, Changeset] {
  return [...changesets].sort((a, b) => a.id - b.id) as [Changeset, Changeset];
}
