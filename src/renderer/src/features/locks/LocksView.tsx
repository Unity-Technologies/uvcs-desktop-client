import { Copy, Lock as LockIcon, LockOpen, RefreshCw, Trash2, User } from 'lucide-react';
import { useState } from 'react';
import type { Lock } from '@shared/domain/lock';
import { PathLabel } from '../../components/PathLabel';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { tidyMenu, SEPARATOR, type MenuEntry } from '../../lib/actions';
import { EMPTY_SELECTION, type SelectionState } from '../../lib/selection';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { RelativeTime } from '../../ui/RelativeTime';
import { SearchField } from '../../ui/SearchField';
import { ToggleChip } from '../../ui/ToggleChip';
import { CenteredSpinner } from '../../ui/Spinner';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { ViewHeader } from '../../ui/ViewHeader';
import { copyPaths } from '../pendingChanges/pendingChangeOperations';
import { releaseLocks, removeLocks } from './lockOperations';
import { useLocks } from './useLocks';
import styles from './LocksView.module.css';

type Scope = 'all' | 'mine';

const COLUMNS: Column<Lock>[] = [
  { id: 'path', header: 'Item', grow: 3, render: (lock) => <PathLabel path={lock.path.replace(/^\//, '')} />, sortValue: (lock) => lock.path },
  {
    id: 'status',
    header: 'Status',
    width: 110,
    render: (lock) => (
      <span className={styles.status} data-status={lock.status}>
        {lock.status === 'Locked' ? <LockIcon size={12} /> : <LockOpen size={12} />}
        {lock.status}
      </span>
    ),
    sortValue: (lock) => lock.status,
  },
  { id: 'owner', header: 'Owner', grow: 1, render: (lock) => <UserLabel user={lock.owner} />, sortValue: (lock) => lock.owner },
  { id: 'holder', header: 'Held on', grow: 1, secondary: true, render: (lock) => lock.holderBranch, sortValue: (lock) => lock.holderBranch },
  { id: 'destination', header: 'Released on', width: 120, secondary: true, render: (lock) => lock.destinationBranch },
  { id: 'workspace', header: 'Workspace', grow: 1, secondary: true, render: (lock) => lock.workspace },
  { id: 'date', header: 'Locked', width: 120, secondary: true, render: (lock) => <RelativeTime date={lock.date} />, sortValue: (lock) => lock.date },
];

/** Exclusive checkouts on the repository: who holds what, and releasing them. */
export function LocksView() {
  const workspacePath = useWorkspacePath();
  const [scope, setScope] = useState<Scope>('all');
  const [filter, setFilter] = useState('');
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const { data: locks, isLoading, error, isFetching } = useLocks(scope === 'mine');

  const visible = (locks ?? []).filter((lock) => `${lock.path} ${lock.owner}`.toLowerCase().includes(filter.toLowerCase()));
  const selected = visible.filter((lock) => selection.selected.has(lockKey(lock)));
  const releasable = selected.filter(isReleasable);

  const header = (
    <ViewHeader
      title="Locks"
      subtitle={locks && `${locks.length} ${locks.length === 1 ? 'lock' : 'locks'}`}
      actions={
        <>
          <IconButton
            icon={<RefreshCw size={14} className={isFetching ? styles.spinning : undefined} />}
            label="Refresh"
            onClick={() => void invalidateWorkspace(workspacePath)}
          />
          <Button icon={<LockOpen size={14} />} disabled={releasable.length === 0} onClick={() => void releaseLocks(workspacePath, releasable)}>
            Release
          </Button>
        </>
      }
    >
      <SearchField value={filter} onChange={setFilter} placeholder="Filter locks" />
      <ToggleChip pressed={scope === 'mine'} icon={<User size={13} />} onChange={(mine) => setScope(mine ? 'mine' : 'all')}>
        Mine
      </ToggleChip>
    </ViewHeader>
  );

  if (isLoading) return <>{header}<CenteredSpinner /></>;
  if (error) return <>{header}<EmptyState title="Couldn't read the locks" description={error.message} /></>;
  if (visible.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={<LockIcon size={22} />}
          title={filter ? 'No matching locks' : 'Nothing is locked'}
          description="Files matching the server's lock rules are locked when someone checks them out, so nobody else edits them at the same time."
        />
      </>
    );
  }

  return (
    <>
      {header}
      <HighlightQuery query={filter}>
        <DataTable
          rows={visible}
          columns={COLUMNS}
          rowKey={lockKey}
          selection={selection}
          onSelectionChange={setSelection}
          contextMenu={(rows) => lockMenu(workspacePath, rows)}
          initialSort={{ columnId: 'date', descending: true }}
        />
      </HighlightQuery>
    </>
  );
}

/** Retained locks are already released; they go away when the change reaches the destination branch. */
function isReleasable(lock: Lock): boolean {
  return lock.status === 'Locked';
}

function lockMenu(workspacePath: string, locks: Lock[]): MenuEntry[] {
  const releasable = locks.filter(isReleasable);
  return tidyMenu([
    releasable.length > 0 && { id: 'release', label: 'Release lock', icon: LockOpen, run: () => void releaseLocks(workspacePath, releasable) },
    { id: 'remove', label: 'Remove lock', icon: Trash2, danger: true, run: () => void removeLocks(workspacePath, locks) },
    SEPARATOR,
    { id: 'copy', label: 'Copy path', icon: Copy, run: () => copyPaths(locks.map((lock) => lock.path)) },
  ]);
}

function lockKey(lock: Lock): string {
  return `${lock.repository}:${lock.itemId}`;
}
