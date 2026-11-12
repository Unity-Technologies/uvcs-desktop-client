import { createContext } from 'react';
import type { ChangesetSpan } from '../../app/navigation/pages';

/**
 * What the place around a diff asks it to show, again each time it asks (`seq`), while the diff is already on screen:
 * a file (a review's Comments panel going to a thread), a mode, or both. `changesetId`, in a branch's diff, says in
 * which of its modes: that changeset's, stepped to ("Changeset by changeset"), or null for "Whole branch"; unset leaves
 * the mode as it is. `changesets` asks for a span of a branch's changesets, selected together as one diff. A link or a
 * page opens a diff on a file through its page (`focusPath`) instead.
 */
export interface DiffFocusRequest {
  /** A repository path, as `DiffEntry.path`, or where a moved file was; none when only a mode is asked for. */
  path?: string;
  changesetId?: number | null;
  changesets?: ChangesetSpan;
  seq: number;
}

export const DiffFocusRequestContext = createContext<DiffFocusRequest | null>(null);
