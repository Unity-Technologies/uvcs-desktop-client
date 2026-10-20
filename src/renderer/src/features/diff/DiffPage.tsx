import type { PageProps } from '../../app/navigation/pages';
import { ShelveDiffActions } from '../shelves/ShelveDiffActions';
import { BranchDiff } from './BranchDiff';
import { TargetDiff } from './TargetDiff';

export function DiffPage({ page }: PageProps<'diff'>) {
  const { target, focusPath, branchHead, sideNames } = page;
  if (target.kind === 'branch') return <BranchDiff branch={target.branch} branchHead={branchHead} focusPath={focusPath} />;
  return <TargetDiff target={target} focusPath={focusPath} sideNames={sideNames} toolbar={target.kind === 'shelve' && <ShelveDiffActions shelveId={target.shelveId} />} />;
}
