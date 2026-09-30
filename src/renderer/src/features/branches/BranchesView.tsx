import { EyeOff, GitBranch, GitBranchPlus, List, ListTree } from 'lucide-react';
import { useMemo } from 'react';
import type { Branch } from '@shared/domain/branch';
import { useRenameCommand } from '../../app/commands/useRenameCommand';
import { ViewRefreshButton } from '../../components/ViewRefreshButton';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { ObjectListView } from '../../components/ObjectListView';
import { useWorkspaceUser } from '../../app/account/accounts';
import { PeopleFilter } from '../../components/people/PeopleFilter';
import { usePeopleSeen } from '../../components/people/usePeopleSeen';
import { SincePicker } from '../../components/SincePicker';
import { matchesPeople, PICKING_PAUSE_MS } from '../../lib/peopleFilter';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { longerRangeHint } from '../../lib/longerRangeHint';
import { isFiltering } from '../../lib/viewFilters';
import { FilterBar } from '../../ui/FilterBar';
import { FilterField } from '../../ui/FilterField';
import { NoMatches } from '../../ui/NoMatches';
import { branchesQuery, filterBranches } from './branchFilters';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { ToggleChip } from '../../ui/ToggleChip';
import { ViewHeader } from '../../ui/ViewHeader';
import { useReviewsByBranch } from '../codeReviews/useCodeReviews';
import { BranchDetails } from './BranchDetails';
import { branchHeadOrigin } from './branchHeadOrigin';
import { branchColumns } from './branchColumns';
import { branchMenu } from './branchMenu';
import { diffBranch, renameBranch } from './branchOperations';
import { useBranchesViewStore, type BranchesLayout } from './branchesViewStore';
import { buildBranchTree, sortBranchesByName, type BranchTreeRow } from './branchTree';
import { useCollapsedBranches } from './useCollapsedBranches';
import { openCreateBranchDialog } from './CreateBranchDialog';
import { newBranchFromWorkspace } from './newBranchFromWorkspace';
import { useBranches } from './useBranches';
import { branchCopyTexts } from './branchMenu';
import { useCopyCommand } from '../../app/commands/useCopyCommand';

export function BranchesView() {
  const workspacePath = useWorkspacePath();
  const { data: workspace } = useWorkspaceInfo();
  const filters = useBranchesViewStore();
  const { text: search, people, layout, since, showHidden, update } = filters;
  const me = useWorkspaceUser();
  const queriedPeople = useDebouncedValue(people, PICKING_PAUSE_MS);
  const { data: branches, isLoading, isFetching, error } = useBranches(branchesQuery({ since, people: queriedPeople, showHidden }));
  const offered = usePeopleSeen('branches', branches, ownerOf);

  const [selection, setSelection] = useViewSelection('branches');

  const currentBranch = workspace?.selector.kind === 'branch' ? workspace.selector.name : undefined;
  // The tree lists siblings by name: sorted once per read, so typing a filter only filters.
  const listed = useMemo(() => (layout === 'tree' ? sortBranchesByName(branches ?? []) : (branches ?? [])), [layout, branches]);
  const matching = useMemo(() => filterBranches(listed, search, (owner) => matchesPeople(people, me, owner)), [listed, search, people, me]);
  const selected = matching.find((branch) => branchKey(branch) === selection.anchor);
  const { collapsed, toggle: toggleCollapsed } = useCollapsedBranches(matching, selected, setSelection, branchKey);
  const rows = useMemo(
    () => (layout === 'tree' ? buildBranchTree(matching, collapsed) : matching.map((branch) => ({ branch, depth: 0, hasChildren: false, collapsed: false }))),
    [layout, matching, collapsed],
  );
  useRenameCommand('Branches', 'branch', selection.selected.size === 1 ? selected : undefined, (branch) => void renameBranch(workspacePath, branch));
  useCopyCommand('Branches', 'Branch', selection.selected.size === 1 && selected ? branchCopyTexts(selected) : undefined);

  // From the selected branch's head, or else from what the workspace has loaded (nothing listed, a label loaded).
  const newBranch = (): void => {
    if (selected) void openCreateBranchDialog(workspacePath, branchHeadOrigin(selected));
    else if (workspace) void newBranchFromWorkspace(workspace);
  };

  const { data: reviews } = useReviewsByBranch(branches !== undefined);
  const columns = useMemo(() => branchColumns(layout, currentBranch, toggleCollapsed, reviews), [layout, currentBranch, toggleCollapsed, reviews]);

  return (
    <>
      <ViewHeader
        title="Branches"
        count={branches && matching.length}
        total={branches?.length}
        actions={
          <>
            <ViewRefreshButton workspacePath={workspacePath} fetching={isFetching} />
            <Button variant="primary" icon={<GitBranchPlus size={14} />} onClick={newBranch} disabled={!workspace}>
              New branch
            </Button>
          </>
        }
      >
        <FilterBar
          text={<FilterField value={search} onChange={(text) => update({ text })} placeholder="Filter branches" />}
          people={<PeopleFilter value={people} onChange={(value) => update({ people: value })} people={offered} mineTip="Branches you created" />}
          time={<SincePicker value={since} onChange={(value) => update({ since: value })} />}
          kinds={
            <ToggleChip pressed={showHidden} onChange={(value) => update({ showHidden: value })} icon={<EyeOff size={13} />}>
              Hidden
            </ToggleChip>
          }
          view={
            <SegmentedControl<BranchesLayout>
              value={layout}
              onChange={(value) => update({ layout: value })}
              segments={[
                { value: 'list', label: <List size={13} />, title: 'List' },
                { value: 'tree', label: <ListTree size={13} />, title: 'Tree' },
              ]}
            />
          }
        />
      </ViewHeader>
      <ObjectListView
        widthKey="branches"
        loading={isLoading}
        error={error}
        errorTitle="Couldn't load branches"
        empty={
          isFiltering(filters) ? (
            <NoMatches icon={<GitBranch size={22} />} noun="branches" hint={longerRangeHint(since, true)} onClear={filters.clear} />
          ) : (
            <EmptyState icon={<GitBranch size={22} />} title="No branches" description={longerRangeHint(since, false)} />
          )
        }
        query={search}
        rows={rows}
        columns={columns}
        rowKey={rowKey}
        selection={selection}
        onSelectionChange={setSelection}
        onActivate={(row) => diffBranch(row.branch)}
        contextMenu={(selectedRows) => branchMenu(workspacePath, selectedRows.map((row) => row.branch), currentBranch)}
        noun="branch"
        details={selected && <BranchDetails key={selected.name} branch={selected} menu={branchMenu(workspacePath, [selected], currentBranch)} />}
      />
    </>
  );
}

/** By id, so a renamed branch stays selected. */
function branchKey(branch: Branch): string {
  return String(branch.id);
}

const rowKey = (row: BranchTreeRow): string => branchKey(row.branch);

const ownerOf = (branch: Branch): string => branch.owner;

