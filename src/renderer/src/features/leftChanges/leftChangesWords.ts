import type { LeftChanges } from '@shared/domain/switchWithChanges';
import { branchLabel } from '../../lib/branchLabels';
import { formatRelativeDate } from '../../lib/formatDate';
import { pluralize } from '../../lib/text';

/** The "Welcome back" banner's title: what waits here, and where it was left (the branch by its own name, `branchLabel`). */
export function leftChangesTitle(left: LeftChanges): string {
  if (left.reason !== 'switch') return `${pluralize(left.count, 'change')} put aside ${PUT_ASIDE_FOR[left.reason]}`;
  return left.mode === 'bring'
    ? `Your changes from ${branchLabel(left.sourceName)} are waiting to be brought here`
    : `Welcome back — you left ${pluralize(left.count, 'change')} on ${branchLabel(left.sourceName)}`;
}

/** The line under the title: when and why they were shelved, and whether another workspace or app left them. */
export function leftChangesDetail(left: LeftChanges, now = Date.now()): string {
  const shelved = `Shelved ${formatRelativeDate(left.createdAt, now)} (shelve ${left.shelveId})`;
  if (left.foreign) return `${shelved}, left from another workspace or app.`;
  if (left.reason === 'update') return `${shelved}: ${branchLabel(left.sourceName)} deleted or moved ${left.count === 1 ? 'the file' : 'the files'}. Restoring merges your changes back.`;
  if (left.reason === 'xlink') return `${shelved} to load a new xlink’s files. Restoring merges your changes back.`;
  if (left.mode === 'bring') return `${shelved} when you switched here. Some files need your decision.`;
  return left.targetName ? `${shelved} when you switched to ${branchLabel(left.targetName)}.` : `${shelved}.`;
}

const WHERE_TO_RESTORE = 'restore them in Changes';

/** What changes the app put aside, not left by a switch, were put aside for. */
export const PUT_ASIDE_FOR: Record<Exclude<LeftChanges['reason'], 'switch'>, string> = { update: 'to update', xlink: 'to load an xlink' };

/**
 * What the dot on Changes in the sidebar says: what waits and where it was left, in the banner's words; undefined when
 * nothing waits.
 */
export function leftChangesSummary(left: readonly LeftChanges[]): string | undefined {
  const [newest] = left;
  if (!newest) return undefined;
  const branches = new Set(left.map((each) => each.sourceName)).size;
  if (branches > 1) return `Changes left on ${pluralize(branches, 'branch', 'branches')} · ${WHERE_TO_RESTORE}`;
  const reasons = new Set(left.map((each) => each.reason));
  if (reasons.size === 1 && newest.reason !== 'switch') return `Changes put aside ${PUT_ASIDE_FOR[newest.reason]} · ${WHERE_TO_RESTORE}`;
  return `Changes left on ${branchLabel(newest.sourceName)} · ${WHERE_TO_RESTORE}`;
}
