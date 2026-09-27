import type { ReplicationRequest, ReplicationSummary } from '@shared/domain/replication';
import { pluralize } from '../../lib/text';

/** "Pushed 3 changesets of /main to project@cloud", or that the other side already had them all. */
export function replicationMessage(direction: 'push' | 'pull', { branch, from, to }: ReplicationRequest, { changesets }: ReplicationSummary): string {
  if (direction === 'push') return changesets === 0 ? `${branch} is already up to date in ${to}` : `Pushed ${pluralize(changesets, 'changeset')} of ${branch} to ${to}`;
  return changesets === 0 ? `${branch} is already up to date with ${from}` : `Pulled ${pluralize(changesets, 'changeset')} of ${branch} from ${from}`;
}
