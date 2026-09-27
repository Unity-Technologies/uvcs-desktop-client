import type { PageProps } from '../../app/navigation/pages';
import { ShelveDiffActions } from '../shelves/ShelveDiffActions';
import { BranchDiff } from './BranchDiff';
import { TargetDiff } from './TargetDiff';

export function DiffPage({ page }: PageProps<'diff'>) {
  const { target, focusPath, branchHead } = page;
  if (target.kind === 'branch') return <BranchDiff branch={target.branch} branchHead={branchHead} focusPath={focusPath} />;
  return <TargetDiff target={target} focusPath={focusPath} toolbar={target.kind === 'shelve' && <ShelveDiffActions shelveId={target.shelveId} />} />;
}
