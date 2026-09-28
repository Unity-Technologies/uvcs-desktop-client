import { EyeOff, GitBranch, GitBranchPlus, List, ListTree, RefreshCw } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { Branch } from '@shared/domain/branch';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { spec } from '@shared/domain/specs';
import { useRenameCommand } from '../../app/commands/useRenameCommand';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { ListWithDetails } from '../../components/ListWithDetails';
import { ListWithDetailsSkeleton } from '../../components/ListWithDetailsSkeleton';
import { NoSelection } from '../../components/NoSelection';
import { useWorkspaceUser } from '../../app/account/accounts';
import { PeopleFilter } from '../../components/people/PeopleFilter';
import { usePeopleSeen } from '../../components/people/usePeopleSeen';
import { SincePicker } from '../../components/SincePicker';
import { matchesPeople, pickedOwners, PICKING_PAUSE_MS } from '../../lib/peopleFilter';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { isFiltering } from '../../lib/viewFilters';
import { FilterBar } from '../../ui/FilterBar';
import { FilterField } from '../../ui/FilterField';
import { NoMatches } from '../../ui/NoMatches';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { userFilterTexts } from '../../lib/userName';
import { sinceDateFor } from '../../lib/sincePresets';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { RelativeTime } from '../../ui/RelativeTime';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { ToggleChip } from '../../ui/ToggleChip';
import { ViewHeader } from '../../ui/ViewHeader';
import { useReviewsByBranch } from '../codeReviews/useCodeReviews';
import { BranchDetails } from './BranchDetails';
import { BranchNameCell } from './BranchNameCell';
import { branchMenu } from './branchMenu';
import { diffBranch, renameBranch } from './branchOperations';
import { useBranchesViewStore, type BranchesLayout } from './branchesViewStore';
import { buildBranchTree, sortBranchesByName, type BranchTreeRow } from './branchTree';
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
  const { data: branches, isLoading, isFetching, error } = useBranches({
    sinceDate: sinceDateFor(since),
    owners: pickedOwners(queriedPeople),
    includeHidden: showHidden,
  });
  const offered = usePeopleSeen('branches', branches, ownerOf);

  const [selection, setSelection] = useViewSelection('branches');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const currentBranch = workspace?.selector.kind === 'branch' ? workspace.selector.name : undefined;
  // The tree lists siblings by name: sorted once per read, so typing a filter only filters.
  const listed = useMemo(() => (layout === 'tree' ? sortBranchesByName(branches ?? []) : (branches ?? [])), [layout, branches]);
  const matching = useMemo(() => filterBranches(listed, search, (owner) => matchesPeople(people, me, owner)), [listed, search, people, me]);
  const rows = useMemo(
    () => (layout === 'tree' ? buildBranchTree(matching, collapsed) : matching.map((branch) => ({ branch, depth: 0, hasChildren: false, collapsed: false }))),
    [layout, matching, collapsed],
  );
  const selected = matching.find((branch) => rowKey({ branch }) === selection.anchor);
  useRenameCommand('Branches', 'branch', selection.selected.size === 1 ? selected : undefined, (branch) => void renameBranch(workspacePath, branch));
  useCopyCommand('Branches', 'Branch', selection.selected.size === 1 && selected ? branchCopyTexts(selected) : undefined);
  // What collapsing reads, so the columns (and their sort) don't change with every selection.
  const latest = useRef({ selected, matching, setSelection });
  latest.current = { selected, matching, setSelection };

  const toggleCollapsed = useCallback((name: string): void => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    // Collapsing the branch a selected child hangs from selects it instead.
    const { selected: shown, matching: branches, setSelection: select } = latest.current;
    const collapsing = branches.find((branch) => branch.name === name);
    if (collapsing && shown?.name.startsWith(`${name}/`)) select({ selected: new Set([rowKey({ branch: collapsing })]), anchor: rowKey({ branch: collapsing }) });
  }, []);

  // From the selected branch's head, or else from what the workspace has loaded (nothing listed, a label loaded).
  const newBranch = (): void => {
    if (!selected) {
      if (workspace) void newBranchFromWorkspace(workspace);
      return;
    }
    openCreateBranchDialog(workspacePath, {
      parentBranch: selected.name,
      startingPoint: spec.changeset(selected.headChangeset),
      startingPointLabel: `the head of ${selected.name} (changeset ${selected.headChangeset})`,
    });
  };

  const { data: reviews } = useReviewsByBranch(branches !== undefined);
  const columns = useBranchColumns(layout, currentBranch, toggleCollapsed, reviews);

  return (
    <>
      <ViewHeader
        title="Branches"
        count={branches && matching.length}
        total={branches?.length}
        actions={
          <>
            <IconButton icon={<RefreshCw size={14} className={isFetching ? 'spinning' : undefined} />} label="Refresh" onClick={() => void invalidateWorkspace(workspacePath)} />
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
      {isLoading ? (
        <ListWithDetailsSkeleton widthKey="branches" columns={columns} />
      ) : error ? (
        <EmptyState title="Couldn't load branches" description={error.message} />
      ) : rows.length === 0 && isFiltering(filters) ? (
        <NoMatches icon={<GitBranch size={22} />} noun="branches" hint={since === 'anyTime' ? undefined : 'The filters look within the time range. Try a longer one.'} onClear={filters.clear} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<GitBranch size={22} />} title="No branches" description={since === 'anyTime' ? undefined : 'Try a longer time range.'} />
      ) : (
        <ListWithDetails widthKey="branches"
          list={
            <HighlightQuery query={search}>
              <DataTable
                rows={rows}
                columns={columns}
                rowKey={rowKey}
                selection={selection}
                onSelectionChange={setSelection}
                selectFirstRow
                onActivate={(row) => diffBranch(row.branch)}
                contextMenu={(selectedRows) => branchMenu(workspacePath, selectedRows.map((row) => row.branch), currentBranch)}
              />
            </HighlightQuery>
          }
          details={
            selected ? (
              <BranchDetails key={selected.name} branch={selected} menu={branchMenu(workspacePath, [selected], currentBranch)} />
            ) : (
              <NoSelection noun="branch" />
            )
          }
        />
      )}
    </>
  );
}

/** By id, so a renamed branch stays selected. */
function rowKey(row: Pick<BranchTreeRow, 'branch'>): string {
  return String(row.branch.id);
}

const ownerOf = (branch: Branch): string => branch.owner;

/** The branches by the people picked (`isPicked`) whose name, comment or creator has every word typed. */
function filterBranches(branches: Branch[], search: string, isPicked: (owner: string) => boolean): Branch[] {
  return branches.filter((branch) => isPicked(branch.owner) && matchesWordFilter([branch.name, branch.comment, ...userFilterTexts(branch.owner)], search));
}

function useBranchColumns(
  layout: BranchesLayout,
  currentBranch: string | undefined,
  onToggleCollapsed: (name: string) => void,
  reviews: ReadonlyMap<number, CodeReviewSummary> | undefined,
): Column<BranchTreeRow>[] {
  return useMemo(() => {
    const sortable = layout === 'list';
    return [
      {
        id: 'name',
        header: 'Name',
        grow: 2,
        sortValue: sortable ? (row) => row.branch.name : undefined,
        render: (row) => (
          <BranchNameCell row={row} isCurrent={row.branch.name === currentBranch} review={reviews?.get(row.branch.id)} onToggleCollapsed={onToggleCollapsed} />
        ),
      },
      // Gives its room to the name in a narrow list: the details panel shows the comment anyway.
      { id: 'comment', header: 'Comment', grow: 2, secondary: true, hideBelow: 560, render: (row) => <Highlight text={row.branch.comment} /> },
      {
        id: 'owner',
        header: 'Created by',
        width: 180,
        hideBelow: 700,
        sortValue: sortable ? (row) => row.branch.owner : undefined,
        render: (row) => <UserLabel user={row.branch.owner} />,
      },
      {
        id: 'date',
        header: 'Created',
        width: 130,
        secondary: true,
        sortValue: sortable ? (row) => row.branch.date : undefined,
        render: (row) => <RelativeTime date={row.branch.date} />,
      },
    ];
  }, [layout, currentBranch, onToggleCollapsed, reviews]);
}
