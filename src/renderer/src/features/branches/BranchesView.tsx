import { ChevronRight, EyeOff, GitBranch, GitBranchPlus, List, ListTree, RefreshCw, User } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { Branch } from '@shared/domain/branch';
import { spec } from '@shared/domain/specs';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { ListWithDetails } from '../../components/ListWithDetails';
import { SincePicker } from '../../components/SincePicker';
import { EMPTY_SELECTION, type SelectionState } from '../../lib/selection';
import { sinceDateFor } from '../../lib/sincePresets';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { RelativeTime } from '../../ui/RelativeTime';
import { SearchField } from '../../ui/SearchField';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { CenteredSpinner } from '../../ui/Spinner';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { ToggleChip } from '../../ui/ToggleChip';
import { ViewHeader } from '../../ui/ViewHeader';
import { BranchDetails } from './BranchDetails';
import { branchMenu } from './branchMenu';
import { switchToBranch } from './branchOperations';
import { useBranchesViewStore, type BranchesLayout } from './branchesViewStore';
import { buildBranchTree, type BranchTreeRow } from './branchTree';
import { openCreateBranchDialog } from './CreateBranchDialog';
import { useBranches } from './useBranches';
import styles from './BranchesView.module.css';

export function BranchesView() {
  const workspacePath = useWorkspacePath();
  const { data: workspace } = useWorkspaceInfo();
  const { layout, since, onlyMine, showHidden, update } = useBranchesViewStore();
  const { data: branches, isLoading, isFetching, error } = useBranches({
    sinceDate: sinceDateFor(since),
    owner: onlyMine ? 'me' : undefined,
    includeHidden: showHidden,
  });

  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const currentBranch = workspace?.selector.kind === 'branch' ? workspace.selector.name : undefined;
  const matching = useMemo(() => filterBranches(branches ?? [], search), [branches, search]);
  const rows = useMemo(
    () => (layout === 'tree' ? buildBranchTree(matching, collapsed) : matching.map((branch) => ({ branch, depth: 0, hasChildren: false, collapsed: false }))),
    [layout, matching, collapsed],
  );
  const selected = matching.find((branch) => branch.name === selection.anchor);

  const toggleCollapsed = useCallback(
    (name: string): void =>
      setCollapsed((current) => {
        const next = new Set(current);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return next;
      }),
    [],
  );

  const newBranch = (): void => {
    const parent = selected ?? matching.find((branch) => branch.name === currentBranch);
    if (!parent) return;
    openCreateBranchDialog(workspacePath, {
      parentBranch: parent.name,
      startingPoint: spec.changeset(parent.headChangeset),
      startingPointLabel: `the head of ${parent.name} (changeset ${parent.headChangeset})`,
    });
  };

  const columns = useBranchColumns(layout, currentBranch, toggleCollapsed);

  return (
    <>
      <ViewHeader
        title="Branches"
        subtitle={branches && `${branches.length}`}
        actions={
          <>
            <IconButton icon={<RefreshCw size={14} className={isFetching ? 'spinning' : undefined} />} label="Refresh" onClick={() => void invalidateWorkspace(workspacePath)} />
            <Button variant="primary" icon={<GitBranchPlus size={14} />} onClick={newBranch} disabled={!branches?.length}>
              New branch
            </Button>
          </>
        }
      >
        <SearchField value={search} onChange={setSearch} placeholder="Filter branches" />
        <SincePicker value={since} onChange={(value) => update({ since: value })} />
        <ToggleChip pressed={onlyMine} onChange={(value) => update({ onlyMine: value })} icon={<User size={12} />}>
          Mine
        </ToggleChip>
        <ToggleChip pressed={showHidden} onChange={(value) => update({ showHidden: value })} icon={<EyeOff size={12} />}>
          Hidden
        </ToggleChip>
        <SegmentedControl<BranchesLayout>
          value={layout}
          onChange={(value) => update({ layout: value })}
          segments={[
            { value: 'list', label: <List size={13} />, title: 'List' },
            { value: 'tree', label: <ListTree size={13} />, title: 'Tree' },
          ]}
        />
      </ViewHeader>
      {isLoading ? (
        <CenteredSpinner />
      ) : error ? (
        <EmptyState title="Couldn't load branches" description={error.message} />
      ) : (
        <ListWithDetails
          list={
            rows.length === 0 ? (
              <EmptyState icon={<GitBranch size={22} />} title="No branches found" description="Try a different filter or date range." />
            ) : (
              <HighlightQuery query={search}>
                <DataTable
                  rows={rows}
                  columns={columns}
                  rowKey={rowKey}
                  selection={selection}
                  onSelectionChange={setSelection}
                  onActivate={(row) => row.branch.name !== currentBranch && void switchToBranch(workspacePath, row.branch.name)}
                  contextMenu={(selectedRows) => branchMenu(workspacePath, selectedRows.map((row) => row.branch), currentBranch)}
                />
              </HighlightQuery>
            )
          }
          details={
            selected ? (
              <BranchDetails workspacePath={workspacePath} branch={selected} isCurrent={selected.name === currentBranch} />
            ) : (
              <EmptyState title="Select a branch" description="Double-click a branch to switch to it." />
            )
          }
        />
      )}
    </>
  );
}

function rowKey(row: BranchTreeRow): string {
  return row.branch.name;
}

function filterBranches(branches: Branch[], search: string): Branch[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return branches;
  return branches.filter((branch) => `${branch.name} ${branch.comment} ${branch.owner}`.toLowerCase().includes(needle));
}

function useBranchColumns(layout: BranchesLayout, currentBranch: string | undefined, onToggleCollapsed: (name: string) => void): Column<BranchTreeRow>[] {
  return useMemo(() => {
    const sortable = layout === 'list';
    return [
      {
        id: 'name',
        header: 'Name',
        grow: 2,
        sortValue: sortable ? (row) => row.branch.name : undefined,
        render: (row) => <BranchNameCell row={row} isCurrent={row.branch.name === currentBranch} onToggleCollapsed={onToggleCollapsed} />,
      },
      { id: 'comment', header: 'Comment', grow: 2, secondary: true, render: (row) => <Highlight text={row.branch.comment} /> },
      {
        id: 'owner',
        header: 'Created by',
        width: 180,
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
  }, [layout, currentBranch, onToggleCollapsed]);
}

function BranchNameCell({ row, isCurrent, onToggleCollapsed }: { row: BranchTreeRow; isCurrent: boolean; onToggleCollapsed: (name: string) => void }) {
  return (
    <span className={styles.name} style={{ paddingLeft: row.depth * 16 }}>
      {row.hasChildren ? (
        <button
          className={styles.chevron}
          data-collapsed={row.collapsed}
          aria-label={row.collapsed ? 'Expand' : 'Collapse'}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => onToggleCollapsed(row.branch.name)}
        >
          <ChevronRight size={13} />
        </button>
      ) : (
        <GitBranch size={13} className={styles.branchIcon} />
      )}
      <span className={styles.label} data-hidden={row.branch.isHidden}>
        <Highlight text={row.depth > 0 ? row.branch.name.slice(row.branch.name.lastIndexOf('/')) : row.branch.name} />
      </span>
      {isCurrent && <span className={styles.current}>Current</span>}
      {row.branch.isHidden && <EyeOff size={12} className={styles.hiddenIcon} />}
    </span>
  );
}
