import { Lock as LockIcon, LockOpen, RefreshCw } from 'lucide-react';
import type { Lock } from '@shared/domain/lock';
import { ItemPathRow } from '../../components/ItemPathRow';
import { ObjectListView } from '../../components/ObjectListView';
import { PathLabel } from '../../components/PathLabel';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Highlight } from '../../ui/Highlight';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { lockFilterTexts, readsOnlyMyLocks } from './lockFilters';
import { IconButton } from '../../ui/IconButton';
import { useWorkspaceUser } from '../../app/account/accounts';
import { PeopleFilter } from '../../components/people/PeopleFilter';
import { usePeopleSeen } from '../../components/people/usePeopleSeen';
import { isOnlyMine, matchesPeople } from '../../lib/peopleFilter';
import { isFiltering } from '../../lib/viewFilters';
import { FilterBar } from '../../ui/FilterBar';
import { FilterField } from '../../ui/FilterField';
import { NoMatches } from '../../ui/NoMatches';
import { useLocksViewStore } from './locksViewStore';
import { RelativeTime } from '../../ui/RelativeTime';
import type { Column } from '../../ui/table/DataTable';
import { ViewHeader } from '../../ui/ViewHeader';
import { LockDetails } from './LockDetails';
import { lockKey } from './lockKey';
import { lockMenu } from './lockMenu';
import { isReleasable, releaseLocks } from './lockOperations';
import { useLocks } from './useLocks';
import styles from './LocksView.module.css';

const RULES = "Files matching the server's lock rules are locked when someone checks them out, so nobody else edits them at the same time.";

const COLUMNS: Column<Lock>[] = [
  // Only files are locked, and a lock names no item type: the icon goes by the name.
  { id: 'path', header: 'Item', grow: 3, render: (lock) => <ItemPathRow path={lock.path.replace(/^\//, '')} itemType="file" />, sortValue: (lock) => lock.path },
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

const ownerOf = (lock: Lock): string => lock.owner;

/** Exclusive checkouts on the repository: who holds what, and releasing them. */
export function LocksView() {
  const workspacePath = useWorkspacePath();
  const filters = useLocksViewStore();
  const { text: filter, people, update } = filters;
  const me = useWorkspaceUser();
  const [selection, setSelection] = useViewSelection('locks');
  const { data: locks, isLoading, error, isFetching } = useLocks(readsOnlyMyLocks(people));
  const offered = usePeopleSeen('locks', locks, ownerOf);

  const visible = (locks ?? []).filter((lock) => matchesPeople(people, me, lock.owner) && matchesWordFilter(lockFilterTexts(lock), filter));
  const selected = visible.filter((lock) => selection.selected.has(lockKey(lock)));
  const releasable = selected.filter(isReleasable);
  const focused = visible.find((lock) => lockKey(lock) === selection.anchor);

  const header = (
    <ViewHeader
      title="Locks"
      count={locks && visible.length}
      total={locks?.length}
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
      <FilterBar
        text={<FilterField value={filter} onChange={(text) => update({ text })} placeholder="Filter locks" />}
        people={<PeopleFilter value={people} onChange={(value) => update({ people: value })} people={offered} mineTip="Locks you hold" />}
      />
    </ViewHeader>
  );

  return (
    <>
      {header}
      <ObjectListView
        widthKey="locks"
        loading={isLoading}
        error={error}
        errorTitle="Couldn't read the locks"
        empty={
          isFiltering(filters) ? (
            <NoMatches icon={<LockIcon size={22} />} noun="locks" hint={isOnlyMine(people) && !filter.trim() ? 'You hold no locks.' : undefined} onClear={filters.clear} />
          ) : (
            <EmptyState icon={<LockIcon size={22} />} title="Nothing is locked" description={RULES} />
          )
        }
        query={filter}
        rows={visible}
        columns={COLUMNS}
        rowKey={lockKey}
        selection={selection}
        onSelectionChange={setSelection}
        contextMenu={(rows) => lockMenu(workspacePath, rows)}
        initialSort={{ columnId: 'date', descending: true }}
        noun="lock"
        details={focused && <LockDetails key={lockKey(focused)} workspacePath={workspacePath} lock={focused} menu={lockMenu(workspacePath, [focused])} />}
      />
    </>
  );
}
