import type { ReactNode } from 'react';
import type { PageProps } from '../../app/navigation/pages';
import { ShelveDiffActions } from '../shelves/ShelveDiffActions';
import { BranchDiff } from './BranchDiff';
import { TargetDiff } from './TargetDiff';

interface DiffPageProps extends PageProps<'diff'> {
  /** A branch's diff opens changeset by changeset, on this changeset: a review's page going to a comment written there. */
  focusChangeset?: number;
  /** Last in the diff's header: the toggle of the details panel of the page showing it (a review's comments). */
  detailsToggle?: ReactNode;
}

export function DiffPage({ page, focusChangeset, detailsToggle }: DiffPageProps) {
  const { target, focusPath, focusLines, branchHead, sideNames } = page;
  if (target.kind === 'branch') {
    return <BranchDiff branch={target.branch} branchHead={branchHead} focusPath={focusPath} focusLines={focusLines} focusChangeset={focusChangeset} detailsToggle={detailsToggle} />;
  }
  const toolbar = (target.kind === 'shelve' || detailsToggle) && (
    <>
      {target.kind === 'shelve' && <ShelveDiffActions shelveId={target.shelveId} />}
      {detailsToggle}
    </>
  );
  return <TargetDiff target={target} focusPath={focusPath} focusLines={focusLines} sideNames={sideNames} toolbar={toolbar} />;
}
