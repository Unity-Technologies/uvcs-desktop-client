import { createContext } from 'react';

/**
 * A file the place around a diff asks it to show, again each time it asks (`seq`), while the diff is already on
 * screen: a review's Comments panel going to a thread. `changesetId`, in a branch's diff, says in which of its modes:
 * that changeset's, stepped to ("Changeset by changeset"), or null for "Whole branch"; unset leaves the mode as it is.
 * A link or a page opens a diff on a file through its page (`focusPath`) instead.
 */
export interface DiffFocusRequest {
  /** A repository path, as `DiffEntry.path`, or where a moved file was. */
  path: string;
  changesetId?: number | null;
  seq: number;
}

export const DiffFocusRequestContext = createContext<DiffFocusRequest | null>(null);
