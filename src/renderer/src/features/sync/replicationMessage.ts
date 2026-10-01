import type { ReplicationRequest, ReplicationSummary } from '@shared/domain/replication';
import { branchLabel } from '../../lib/branchLabels';
import { pluralize } from '../../lib/text';

/** "Pushed 3 changesets of main to project@cloud" (the branch by its own name), or that the other side already had them all. */
export function replicationMessage(direction: 'push' | 'pull', request: ReplicationRequest, { changesets }: ReplicationSummary): string {
  const { from, to } = request;
  const branch = branchLabel(request.branch);
  if (direction === 'push') return changesets === 0 ? `${branch} is already up to date in ${to}` : `Pushed ${pluralize(changesets, 'changeset')} of ${branch} to ${to}`;
  return changesets === 0 ? `${branch} is already up to date with ${from}` : `Pulled ${pluralize(changesets, 'changeset')} of ${branch} from ${from}`;
}
