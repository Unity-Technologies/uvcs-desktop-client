import { AUTOMATIC_SHELVE_COMMENT, type Shelve } from '@shared/domain/shelve';

interface ShelveCommentOptions {
  /** `false` for someone else's shelve, whose comment is theirs. */
  mine?: boolean;
  /** Changes a switch or an update left (this app's records know). */
  left?: boolean;
}

/**
 * Whether a shelve's comment is offered for editing, in its menu and its details. Never for changes a switch or an
 * update left: the automatic comment is what marks them as left changes for every client (`AUTOMATIC_SHELVE_CONDITION`,
 * the official client too), so editing it would turn them into an ordinary shelve, applied instead of restored; and
 * for those this app recorded, the title shown comes from the record, so an edit wouldn't even show.
 */
export function editsShelveComment(shelve: Pick<Shelve, 'comment'>, { mine = true, left = false }: ShelveCommentOptions = {}): boolean {
  return mine && !left && !shelve.comment.startsWith(AUTOMATIC_SHELVE_COMMENT);
}
