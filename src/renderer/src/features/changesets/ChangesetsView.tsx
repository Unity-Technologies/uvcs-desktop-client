import { GitCommitVertical } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { DEFAULT_CHANGESET_FILTER, matchesSearch, toQueryFilter, type ChangesetFilterState } from './changesetFilters';
import { ChangesetFiltersBar } from './ChangesetFiltersBar';
import { changesetMenu } from './changesetMenu';
import { openChangesetDiff, openRangeDiff } from './changesetOperations';
import { useChangesets } from './useChangesets';
import { hotkey } from '../../lib/shortcutRegistry';

const changesetKey = (changeset: Changeset): string => String(changeset.id);

export function ChangesetsView() {
  const workspacePath = useWorkspacePath();
  const { data: workspace } = useWorkspaceInfo();
  const [filter, setFilter] = useState<ChangesetFilterState>(DEFAULT_CHANGESET_FILTER);
  const [selection, setSelection] = useViewSelection('changesets');

  const currentBranch = workspace?.selector.kind === 'branch' ? workspace.selector.name : undefined;
  // The search is applied locally; only the other filters trigger a new `cm find`.
  const { datePreset, onlyMine, onlyCurrentBranch } = filter;
  const queryFilter = useMemo(
    () => toQueryFilter({ datePreset, onlyMine, onlyCurrentBranch }, currentBranch, new Date()),
    [datePreset, onlyMine, onlyCurrentBranch, currentBranch],
  );
  const { data: changesets, isLoading, error } = useChangesets(queryFilter);

  const visible = useMemo(() => (changesets ?? []).filter((changeset) => matchesSearch(changeset, filter.search)), [changesets, filter.search]);
  const selected = visible.filter((changeset) => selection.selected.has(changesetKey(changeset)));
  const focused = visible.find((changeset) => changesetKey(changeset) === selection.anchor);
  const labelsByChangeset = useLabelsByChangeset();
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

  const header = (
    <ViewHeader title="Changesets" count={changesets && visible.length}>
      <ChangesetFiltersBar filter={filter} onChange={setFilter} />
    </ViewHeader>
  );

  if (error) return <>{header}<EmptyState title="Couldn't load changesets" description={error.message} /></>;
  if (isLoading) return <>{header}<ListWithDetailsSkeleton columns={columns} /></>;

  return (
    <>
      {header}
      {visible.length === 0 ? (
        <EmptyState icon={<GitCommitVertical size={22} />} title="No changesets" description="Nothing matches these filters. Try a longer time range." />
      ) : (
        <ListWithDetails
          list={
            <HighlightQuery query={filter.search}>
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
