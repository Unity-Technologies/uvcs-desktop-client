import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, GitBranch } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Branch } from '@shared/domain/branch';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { PathLabel } from '../../components/PathLabel';
import { RepositoryPicker } from '../../components/RepositoryPicker';
import { EMPTY_SELECTION } from '../../lib/selection';
import { Button } from '../../ui/Button';
import { prompt } from '../../ui/dialog/prompt';
import { EmptyState } from '../../ui/EmptyState';
import { HighlightQuery } from '../../ui/Highlight';
import { RelativeTime } from '../../ui/RelativeTime';
import { FilterField } from '../../ui/FilterField';
import { CenteredSpinner } from '../../ui/Spinner';
import { UserLabel } from '../../ui/Avatar';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { userFilterTexts } from '../../lib/userName';
import type { Column } from '../../ui/table/column';
import { DataTable } from '../../ui/table/DataTable';
import { useBranches } from '../branches/useBranches';
import { syncBranchMenu, type BranchSync } from './syncBranchMenu';
import { pullBranch, pushBranch } from './syncOperations';
import { useSyncTargetStore } from './syncTargetStore';
import styles from './SyncView.module.css';

/** Push and pull branches between the workspace repository and another one. */
export function RepositorySyncPanel({ localRepository }: { localRepository: string }) {
  const workspacePath = useWorkspacePath();
  const remote = useSyncTargetStore((state) => state.remoteByRepository[localRepository] ?? null);
  const setRemote = useSyncTargetStore((state) => state.setRemote);
  const [filter, setFilter] = useState('');
  const [selection, setSelection] = useState(EMPTY_SELECTION);
  const { data: branches, isLoading } = useBranches();

  // Arrowing through a repository's 20,000 branches renders the panel on every step: the rows, their columns and their
  // filter stay the same objects, so the table neither sorts nor filters them again.
  const sync = useMemo<BranchSync>(
    () => ({
      push: (branch) => {
        if (remote) void pushBranch(workspacePath, { branch, from: localRepository, to: remote });
      },
      pull: (branch) => {
        if (remote) void pullBranch(workspacePath, { branch, from: remote, to: localRepository });
      },
    }),
    [workspacePath, localRepository, remote],
  );
  const columns = useMemo(() => [...BRANCH_COLUMNS, syncActionsColumn(remote, sync)], [remote, sync]);
  const shown = useMemo(
    () => (branches ?? []).filter((branch) => matchesWordFilter([branch.name, ...userFilterTexts(branch.owner)], filter)),
    [branches, filter],
  );

  const pullRemoteBranch = async (): Promise<void> => {
    const branch = await prompt({
      title: 'Pull a branch',
      description: `Brings a branch that only exists in ${remote} into ${localRepository}.`,
      label: 'Branch name',
      initialValue: '/main/',
      confirmLabel: 'Pull',
    });
    if (branch) sync.pull(branch.startsWith('/') ? branch : `/${branch}`);
  };

  return (
    <div className={styles.panel}>
      <section className={styles.target}>
        <div className={styles.endpoint}>
          <span className={styles.endpointLabel}>This repository</span>
          <span className={styles.endpointName}>{localRepository}</span>
        </div>
        <ArrowLeftRight size={18} className={styles.direction} />
        <div className={styles.picker}>
          <RepositoryPicker
            label="Remote repository"
            value={remote}
            exclude={localRepository}
            onChange={(repository) => setRemote(localRepository, repository.spec)}
          />
        </div>
      </section>

      <div className={styles.toolbar}>
        <FilterField value={filter} onChange={setFilter} placeholder="Filter branches" />
        <span className={styles.hint}>
          <b>Push</b> sends a branch to the remote. <b>Pull</b> brings the remote's version here.
        </span>
        <Button icon={<GitBranch size={14} />} disabled={!remote} onClick={() => void pullRemoteBranch()}>
          Pull remote branch…
        </Button>
      </div>

      {isLoading ? (
        <CenteredSpinner />
      ) : shown.length === 0 ? (
        <EmptyState title="No branches" />
      ) : (
        <HighlightQuery query={filter}>
          <DataTable
            rows={shown}
            columns={columns}
            rowKey={branchName}
            selection={selection}
            onSelectionChange={setSelection}
            initialSort={{ columnId: 'name', descending: false }}
            contextMenu={(selected) => syncBranchMenu(selected, remote, sync)}
          />
        </HighlightQuery>
      )}
    </div>
  );
}

const branchName = (branch: Branch): string => branch.name;

const BRANCH_COLUMNS: Column<Branch>[] = [
  { id: 'name', header: 'Branch', grow: 2, render: (branch) => <PathLabel path={branch.name} />, sortValue: branchName },
  { id: 'owner', header: 'Created by', grow: 1, render: (branch) => <UserLabel user={branch.owner} /> },
  { id: 'date', header: 'Created', width: 130, secondary: true, render: (branch) => <RelativeTime date={branch.date} />, sortValue: (branch) => branch.date },
];

/** Each row's Push and Pull buttons, enabled once there is a remote to sync with. */
function syncActionsColumn(remote: string | null, sync: BranchSync): Column<Branch> {
  return {
    id: 'actions',
    header: '',
    width: 180,
    align: 'end',
    render: (branch) => (
      <span className={styles.rowActions}>
        <Button size="small" icon={<ArrowUpFromLine size={13} />} disabled={!remote} onClick={() => sync.push(branch.name)}>
          Push
        </Button>
        <Button size="small" icon={<ArrowDownToLine size={13} />} disabled={!remote} onClick={() => sync.pull(branch.name)}>
          Pull
        </Button>
      </span>
    ),
  };
}
