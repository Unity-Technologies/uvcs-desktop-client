import { FileDiff } from 'lucide-react';
import type { ItemPathChange } from '@shared/domain/history';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { openChangesetDiff } from '../changesets/changesetOperations';

interface PathChangeDetailsProps {
  change: ItemPathChange;
  /** The repository of an item under an xlink, whose changesets no diff of the workspace's has. */
  otherRepository?: string;
}

/**
 * A move or removal in the history (its header says which): it has no revision to compare, so its changeset is offered
 * instead, when it is one of the workspace's repository.
 */
export function PathChangeDetails({ change, otherRepository }: PathChangeDetailsProps) {
  return (
    <EmptyState
      title="No content to compare"
      description="Moves and removals change where the item is, not what it holds."
      action={
        !otherRepository && (
          <Button icon={<FileDiff size={14} />} onClick={() => openChangesetDiff({ id: change.changesetId })}>
            Diff changeset
          </Button>
        )
      }
    />
  );
}
