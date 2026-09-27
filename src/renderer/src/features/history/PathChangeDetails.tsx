import { FileDiff } from 'lucide-react';
import type { ItemPathChange } from '@shared/domain/history';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { openChangesetDiff } from '../changesets/changesetOperations';

/** A move or removal in the history: it has no revision to compare, so its changeset is offered instead. */
export function PathChangeDetails({ change }: { change: ItemPathChange }) {
  return (
    <EmptyState
      title={change.description}
      description={`Changeset ${change.changesetId}. Moves and removals have no content to compare.`}
      action={
        <Button icon={<FileDiff size={14} />} onClick={() => openChangesetDiff({ id: change.changesetId })}>
          Diff changeset
        </Button>
      }
    />
  );
}
