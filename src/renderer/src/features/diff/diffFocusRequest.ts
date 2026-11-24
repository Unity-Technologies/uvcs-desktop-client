import { createContext } from 'react';
import type { ChangesetSpan } from '../../app/navigation/pages';

/**
 * What the place around a diff asks it to show, again each time it asks (`seq`), while the diff is already on screen:
 * a file (a review's Comments panel going to a thread), what of a branch's diff to show, or both. `changesetId`, in a
 * branch's diff, selects that changeset in its list of changesets, or null all the branch's changes ("All changes on
 * …"); unset leaves the selection as it is. `changesets` asks for a span of a branch's changesets, selected together
 * as one diff (`branchDiffFocusFor`). A link or a page opens a diff on a file through its page (`focusPath`) instead.
 */
export interface DiffFocusRequest {
  /** A repository path, as `DiffEntry.path`, or where a moved file was; none when only changesets are asked for. */
  path?: string;
  changesetId?: number | null;
  changesets?: ChangesetSpan;
  seq: number;
}

export const DiffFocusRequestContext = createContext<DiffFocusRequest | null>(null);
