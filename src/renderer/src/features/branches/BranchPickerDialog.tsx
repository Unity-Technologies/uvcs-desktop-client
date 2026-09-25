import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { CenteredSpinner } from '../../ui/Spinner';
import { BranchSearchList } from './BranchSearchList';
import { useBranches } from './useBranches';

interface PickBranchOptions {
  title: string;
  description?: string;
  /** A branch that can't be picked, e.g. the one the workspace is on. */
  exclude?: string;
}

/** Asks the user to choose a branch. Resolves to its full name, or undefined if dismissed. */
export function pickBranch(options: PickBranchOptions): Promise<string | undefined> {
  return askDialog<string>((finish) => <BranchPickerDialog {...options} finish={finish} />);
}

function BranchPickerDialog({ title, description, exclude, finish }: PickBranchOptions & { finish: (branch: string | undefined) => void }) {
  const { data } = useBranches();
  const branches = data?.filter((branch) => branch.name !== exclude);

  return (
    <Dialog title={title} description={description} width={520} onClose={() => finish(undefined)}>
      {branches ? (
        <BranchSearchList groups={[{ title: 'Branches', branches }]} onPick={(branch) => finish(branch.name)} />
      ) : (
        <CenteredSpinner />
      )}
    </Dialog>
  );
}
