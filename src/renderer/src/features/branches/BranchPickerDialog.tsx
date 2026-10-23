import { useMemo } from 'react';
import type { Branch } from '@shared/domain/branch';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { BranchSearchList } from './BranchSearchList';
import { branchesRead } from './branchSearchRows';
import { useBranches } from './useBranches';

interface PickBranchOptions {
  title: string;
  description?: string;
  /** A branch that can't be picked, e.g. the one the workspace is on. */
  exclude?: string;
  /** Another repository's branches than the workspace's (`name@server`), e.g. an xlinked one's. */
  repository?: string;
}

/** Asks the user to choose a branch. Resolves to it as the branch list read it (its head too), or undefined if dismissed. */
export function pickBranch(options: PickBranchOptions): Promise<Branch | undefined> {
  return askDialog<Branch>((finish) => <BranchPickerDialog {...options} finish={finish} />);
}

function BranchPickerDialog({ title, description, exclude, repository, finish }: PickBranchOptions & { finish: (branch: Branch | undefined) => void }) {
  const branchesQuery = useBranches({}, repository);
  const branches = useMemo(() => (branchesQuery.data ?? []).filter((branch) => branch.name !== exclude), [branchesQuery.data, exclude]);

  return (
    <Dialog title={title} description={description} width={520} onClose={() => finish(undefined)}>
      <BranchSearchList groups={[{ title: 'Branches', branches }]} onPick={finish} read={branchesRead(branchesQuery)} />
    </Dialog>
  );
}
