import type { ReactNode } from 'react';
import type { ChangesetSpan, PageProps } from '../../app/navigation/pages';
import type { ReviewedUpTo } from './branchChangesetRows';
import { ShelveDiffActions } from '../shelves/ShelveDiffActions';
import { BranchDiff } from './BranchDiff';
import { TargetDiff } from './TargetDiff';

interface DiffPageProps extends PageProps<'diff'> {
  /** A branch's diff opens changeset by changeset, on this changeset: a review's page going to a comment written there. */
  focusChangeset?: number;
  /** A branch's diff opens changeset by changeset, the changesets of this span selected: a review's new changesets. */
  focusChangesets?: ChangesetSpan;
  /** Where the user left off reviewing a branch (a code review's checkpoint): its changesets are marked new or reviewed. */
  reviewedUpTo?: ReviewedUpTo;
  /** Last in the diff's header: the toggle of the details panel of the page showing it (a review's comments). */
  detailsToggle?: ReactNode;
  /** The page around it applies a shelve already (a code review's): the shelve's own Apply isn't offered again. */
  pageAppliesShelve?: boolean;
}

export function DiffPage({ page, focusChangeset, focusChangesets, reviewedUpTo, detailsToggle, pageAppliesShelve }: DiffPageProps) {
  const { target, focusPath, focusLines, branchHead, sideNames } = page;
  if (target.kind === 'branch') {
    return (
      <BranchDiff
        branch={target.branch}
        branchHead={branchHead}
        focusPath={focusPath}
        focusLines={focusLines}
        focusChangeset={focusChangeset}
        focusChangesets={focusChangesets}
        reviewedUpTo={reviewedUpTo}
        detailsToggle={detailsToggle}
      />
    );
  }
  const toolbar = (target.kind === 'shelve' || detailsToggle) && (
    <>
      {target.kind === 'shelve' && <ShelveDiffActions shelveId={target.shelveId} pageApplies={pageAppliesShelve} />}
      {detailsToggle}
    </>
  );
  return <TargetDiff target={target} focusPath={focusPath} focusLines={focusLines} sideNames={sideNames} toolbar={toolbar} />;
}
