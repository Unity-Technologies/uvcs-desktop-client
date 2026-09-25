import type { IncomingSummary } from '@shared/domain/incoming';
import { pluralize } from '../../lib/text';
import { displayName } from '../../lib/userName';

const NAMED_AUTHORS = 2;

/** What the loaded branch has that the workspace doesn't: checking in updates first. */
export interface BehindBranch {
  count: number;
  authors: string[];
}

/** How far the workspace is behind the branch it checks in to, as the incoming check last saw; null when it isn't. */
export function behindBranch(summary: IncomingSummary | undefined, branch: string | undefined): BehindBranch | null {
  if (!summary || !branch || summary.branch !== branch || summary.changesetCount === 0) return null;
  return { count: summary.changesetCount, authors: summary.authors };
}

/** "1 new changeset from Ana on this branch", "4 new changesets from Ana, Bob and 1 more on this branch". */
export function behindDescription({ count, authors }: BehindBranch): string {
  const names = authors.map(displayName);
  const named = names.slice(0, NAMED_AUTHORS).join(', ');
  const others = names.length - NAMED_AUTHORS;
  const from = names.length === 0 ? '' : ` from ${others > 0 ? `${named} and ${others} more` : named}`;
  return `${pluralize(count, 'new changeset')}${from} on this branch`;
}
