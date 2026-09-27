import { FileDiff } from 'lucide-react';
import type { ItemPathChange } from '@shared/domain/history';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { openChangesetDiff } from '../changesets/changesetOperations';

/** A move or removal in the history (its header says which): it has no revision to compare, so its changeset is offered instead. */
export function PathChangeDetails({ change }: { change: ItemPathChange }) {
  return (
    <EmptyState
      title="No content to compare"
      description="Moves and removals change where the item is, not what it holds."
      action={
        <Button icon={<FileDiff size={14} />} onClick={() => openChangesetDiff({ id: change.changesetId })}>
          Diff changeset
        </Button>
      }
    />
  );
}
