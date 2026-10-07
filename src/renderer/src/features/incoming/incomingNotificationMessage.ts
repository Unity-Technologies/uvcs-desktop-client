import type { Changeset } from '@shared/domain/changeset';
import type { BranchIncoming } from '@shared/domain/incoming';
import { branchLabel } from '../../lib/branchLabels';
import { firstLine, formatCountAtLeast } from '../../lib/text';
import { displayName } from '../../lib/userName';

/** How many changesets came in between two checks; at least `count` once the later one stopped counting. */
export interface NewChangesets {
  count: number;
  countCapped: boolean;
}

/**
 * The changesets new since the `before` check. Counts stop at the check's limit: past it, only a lower bound is known,
 * and when both stopped, only that some came in (the head moved).
 */
export function newChangesetCount(before: BranchIncoming, after: BranchIncoming): NewChangesets {
  return { count: Math.max(1, after.changesetCount - before.changesetCount), countCapped: after.countCapped };
}

/** "Ana checked in 'Fix boost' on t1" (the branch by its own name), about the newest of the changesets that just came in. */
export function incomingNotificationMessage(newest: Pick<Changeset, 'owner' | 'comment'>, branch: string, { count, countCapped }: NewChangesets): string {
  const comment = firstLine(newest.comment);
  const what = comment ? ` '${comment}'` : '';
  return `${displayName(newest.owner)} checked in${what} on ${branchLabel(branch)}${othersThanNewest(count, countCapped)}`;
}

function othersThanNewest(count: number, countCapped: boolean): string {
  if (count > 1) return ` (and ${formatCountAtLeast(count - 1, countCapped)} more)`;
  return countCapped ? ' (and more)' : '';
}
