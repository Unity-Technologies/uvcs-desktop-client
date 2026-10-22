import type { PageProps } from '../../app/navigation/pages';
import { ShelveDiffActions } from '../shelves/ShelveDiffActions';
import { BranchDiff } from './BranchDiff';
import { TargetDiff } from './TargetDiff';

export function DiffPage({ page }: PageProps<'diff'>) {
  const { target, focusPath, focusLines, branchHead, sideNames } = page;
  if (target.kind === 'branch') return <BranchDiff branch={target.branch} branchHead={branchHead} focusPath={focusPath} focusLines={focusLines} />;
  return <TargetDiff target={target} focusPath={focusPath} focusLines={focusLines} sideNames={sideNames} toolbar={target.kind === 'shelve' && <ShelveDiffActions shelveId={target.shelveId} />} />;
}
