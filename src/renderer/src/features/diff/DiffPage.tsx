import type { PageProps } from '../../app/navigation/pages';
import { BranchDiff } from './BranchDiff';
import { TargetDiff } from './TargetDiff';

export function DiffPage({ page }: PageProps<'diff'>) {
  const { target, focusPath } = page;
  return target.kind === 'branch' ? <BranchDiff branch={target.branch} /> : <TargetDiff target={target} focusPath={focusPath} />;
}
