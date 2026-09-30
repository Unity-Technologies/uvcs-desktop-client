import type { LeftChanges } from '@shared/domain/switchWithChanges';
import { formatRelativeDate } from '../../lib/formatDate';
import { pluralize } from '../../lib/text';

/** The "Welcome back" banner's title: what waits here, and where it was left. */
export function leftChangesTitle(left: LeftChanges): string {
  if (left.reason === 'update') return `${pluralize(left.count, 'change')} put aside to update`;
  return left.mode === 'bring'
    ? `Your changes from ${left.sourceName} are waiting to be brought here`
    : `Welcome back — you left ${pluralize(left.count, 'change')} on ${left.sourceName}`;
}

/** The line under the title: when and why they were shelved, and whether another workspace or app left them. */
export function leftChangesDetail(left: LeftChanges, now = Date.now()): string {
  const shelved = `Shelved ${formatRelativeDate(left.createdAt, now)} (shelve ${left.shelveId})`;
  if (left.foreign) return `${shelved}, left from another workspace or app.`;
  if (left.reason === 'update') return `${shelved}: ${left.sourceName} deleted or moved ${left.count === 1 ? 'the file' : 'the files'}. Restoring merges your changes back.`;
  if (left.mode === 'bring') return `${shelved} when you switched here. Some files need your decision.`;
  return left.targetName ? `${shelved} when you switched to ${left.targetName}.` : `${shelved}.`;
}

const WHERE_TO_RESTORE = 'restore them in Changes';

/**
 * What the dot on Changes in the sidebar says: what waits and where it was left, in the banner's words; undefined when
 * nothing waits.
 */
export function leftChangesSummary(left: readonly LeftChanges[]): string | undefined {
  const [newest] = left;
  if (!newest) return undefined;
  const branches = new Set(left.map((each) => each.sourceName)).size;
  if (branches > 1) return `Changes left on ${pluralize(branches, 'branch', 'branches')} · ${WHERE_TO_RESTORE}`;
  if (left.every((each) => each.reason === 'update')) return `Changes put aside to update · ${WHERE_TO_RESTORE}`;
  return `Changes left on ${newest.sourceName} · ${WHERE_TO_RESTORE}`;
}
