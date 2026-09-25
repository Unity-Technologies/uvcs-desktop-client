import type { PageProps } from '../../app/navigation/pages';
import { BranchDiff } from './BranchDiff';
import { TargetDiff } from './TargetDiff';

export function DiffPage({ page }: PageProps<'diff'>) {
  const { target, focusPath, branchHead } = page;
  return target.kind === 'branch' ? (
    <BranchDiff branch={target.branch} branchHead={branchHead} focusPath={focusPath} />
  ) : (
    <TargetDiff target={target} focusPath={focusPath} />
  );
}
