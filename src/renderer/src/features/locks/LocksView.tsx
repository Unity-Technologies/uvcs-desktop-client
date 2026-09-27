import { Lock as LockIcon, LockOpen, RefreshCw, User } from 'lucide-react';
import { useState } from 'react';
import type { Lock } from '@shared/domain/lock';
import { ListWithDetails } from '../../components/ListWithDetails';
import { ListWithDetailsSkeleton } from '../../components/ListWithDetailsSkeleton';
import { NoSelection } from '../../components/NoSelection';
import { PathLabel } from '../../components/PathLabel';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { userFilterTexts } from '../../lib/userName';
import { IconButton } from '../../ui/IconButton';
import { RelativeTime } from '../../ui/RelativeTime';
import { SearchField } from '../../ui/SearchField';
import { ToggleChip } from '../../ui/ToggleChip';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { ViewHeader } from '../../ui/ViewHeader';
import { LockDetails } from './LockDetails';
import { lockMenu } from './lockMenu';
import { isReleasable, releaseLocks } from './lockOperations';
import { locksEmptyState } from './locksEmptyState';
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
  { id: 'holder', header: 'Held on', grow: 1, secondary: true, render: (lock) => <PathLabel path={lock.holderBranch} />, sortValue: (lock) => lock.holderBranch },
  { id: 'destination', header: 'Released on', width: 120, secondary: true, hideBelow: 900, render: (lock) => <Highlight text={lock.destinationBranch} /> },
  { id: 'workspace', header: 'Workspace', grow: 1, secondary: true, hideBelow: 1000, render: (lock) => <Highlight text={lock.workspace} /> },
  { id: 'date', header: 'Locked', width: 120, secondary: true, render: (lock) => <RelativeTime date={lock.date} />, sortValue: (lock) => lock.date },
];

/** What the row shows: the item, its owner, the branches it's held on and released on, and the workspace. */
function lockFilterTexts(lock: Lock): string[] {
  return [lock.path, ...userFilterTexts(lock.owner), lock.holderBranch, lock.destinationBranch, lock.workspace];
}

/** Exclusive checkouts on the repository: who holds what, and releasing them. */
export function LocksView() {
  const workspacePath = useWorkspacePath();
  const [scope, setScope] = useState<Scope>('all');
  const [filter, setFilter] = useState('');
  const [selection, setSelection] = useViewSelection('locks');
  const { data: locks, isLoading, error, isFetching } = useLocks(scope === 'mine');

  const visible = (locks ?? []).filter((lock) => matchesWordFilter(lockFilterTexts(lock), filter));
  const selected = visible.filter((lock) => selection.selected.has(lockKey(lock)));
  const releasable = selected.filter(isReleasable);
  const focused = visible.find((lock) => lockKey(lock) === selection.anchor);

  const header = (
    <ViewHeader
      title="Locks"
      count={locks?.length}
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

  if (isLoading) return <>{header}<ListWithDetailsSkeleton widthKey="locks" columns={COLUMNS} /></>;
  if (error) return <>{header}<EmptyState title="Couldn't read the locks" description={error.message} /></>;
  if (visible.length === 0) {
    const empty = locksEmptyState({ searching: filter.trim() !== '', onlyMine: scope === 'mine' });
    return (
      <>
        {header}
        <EmptyState
          icon={<LockIcon size={22} />}
          title={empty.title}
          description={empty.description}
          action={empty.offerEveryone && <Button onClick={() => setScope('all')}>Show everyone's locks</Button>}
        />
      </>
    );
  }

  return (
    <>
      {header}
      <ListWithDetails widthKey="locks"
        list={
          <HighlightQuery query={filter}>
            <DataTable
              rows={visible}
              columns={COLUMNS}
              rowKey={lockKey}
              selection={selection}
              onSelectionChange={setSelection}
              selectFirstRow
              contextMenu={(rows) => lockMenu(workspacePath, rows)}
              initialSort={{ columnId: 'date', descending: true }}
            />
          </HighlightQuery>
        }
        details={
          focused ? <LockDetails key={lockKey(focused)} workspacePath={workspacePath} lock={focused} menu={lockMenu(workspacePath, [focused])} /> : <NoSelection noun="lock" />
        }
      />
    </>
  );
}

function lockKey(lock: Lock): string {
  return `${lock.repository}:${lock.itemId}`;
}
