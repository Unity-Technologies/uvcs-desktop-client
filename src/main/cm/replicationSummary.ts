import type { ReplicationSummary } from '@shared/domain/replication';

/** Reads the totals `cm push`/`cm pull` print at the end, e.g. `Changesets 3`. */
export function parseReplicationSummary(output: string): ReplicationSummary {
  const count = (label: string): number => {
    const match = new RegExp(`^${label} (\\d+)\\s*$`, 'm').exec(output);
    return match ? Number(match[1]) : 0;
  };
  return { changesets: count('Changesets'), labels: count('Labels'), items: count('Items') };
}
