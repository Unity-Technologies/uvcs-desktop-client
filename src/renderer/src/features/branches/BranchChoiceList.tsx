import { useMemo } from 'react';
import type { Branch } from '@shared/domain/branch';
import type { Place } from '@shared/domain/place';
import { BranchSearchList } from './BranchSearchList';
import { branchesRead, type BranchGroup } from './branchSearchRows';
import { useBranches } from './useBranches';

interface BranchChoiceListProps {
  place: Place;
  /** The list's groups, from every branch read; memoized by the caller. */
  groupsOf: (branches: Branch[]) => BranchGroup[];
  /** The branch marked as the one chosen now. */
  current: string | undefined;
  placeholder: string;
  onPick: (branch: Branch) => void;
}

/**
 * Every branch of a place to pick one from, in the groups the caller makes of them: a popover's content, mounted only
 * while it's open, so the branches are read only then (the read the branch switcher shares). A big repository holds
 * thousands, and showing the one chosen needs none.
 */
export function BranchChoiceList({ place, groupsOf, current, placeholder, onPick }: BranchChoiceListProps) {
  const branchesQuery = useBranches({}, place);
  const groups = useMemo(() => groupsOf(branchesQuery.data ?? []), [groupsOf, branchesQuery.data]);
  return <BranchSearchList groups={groups} currentBranch={current} read={branchesRead(branchesQuery)} mergeRequestsOf={place} placeholder={placeholder} onPick={onPick} />;
}
