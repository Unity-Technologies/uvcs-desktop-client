import type { Changeset } from '@shared/domain/changeset';
import type { ChangesetSpan } from '../../../app/navigation/pages';
import { newChangesetsOf } from '../../diff/branchChangesetRows';
import type { ReviewCheckpoint } from './reviewRounds';

/**
 * The changesets checked in since the user's checkpoint, as the span their review's changes open on, selected
 * together as one diff (`PageOf<'codeReview'>.focusChangesets`): "See the changes". `changesets` newest first, as the
 * page reads them. None without a checkpoint, while they're read, or when nothing came since.
 */
export function newChangesetsSpan(changesets: readonly Changeset[] | undefined, checkpoint: ReviewCheckpoint | undefined): ChangesetSpan | undefined {
  const newOnes = newChangesetsOf(changesets ?? [], checkpoint);
  const newest = newOnes[0];
  const oldest = newOnes.at(-1);
  return newest && oldest ? { oldest: oldest.id, newest: newest.id } : undefined;
}
