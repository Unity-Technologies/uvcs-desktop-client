import type { XlinkTarget } from './explorer';
import type { ItemType } from './pendingChanges';

export type DiffStatus = 'added' | 'changed' | 'deleted' | 'moved';

/** One item that differs between two points in history. */
export interface DiffEntry {
  status: DiffStatus;
  /** Repository path without the leading slash, e.g. `src/app.ts`. */
  path: string;
  oldPath?: string;
  itemType: ItemType;
  /** Revision on the left side; -1 when the item did not exist. */
  baseRevisionId: number;
  /** Revision on the right side; -1 when the item was deleted. */
  revisionId: number;
  /**
   * The repository both revisions belong to (`name@server`): the diffed one, or for an item under an xlink the xlinked
   * one, whose ids mean other revisions in the diffed repository.
   */
  repository: string;
}

/** Two points in history to compare. */
export type DiffTarget =
  | { kind: 'changeset'; changesetId: number }
  | { kind: 'range'; fromSpec: string; toSpec: string }
  | { kind: 'branch'; branch: string }
  | { kind: 'shelve'; shelveId: number };

/**
 * Where a changed xlink of a diff points on each side (`DiffApi.xlinkSides`): null on a side it isn't on (added,
 * deleted), on one whose tree `cm ls` can't read (a shelve, a label), and where its folder isn't in that tree. `cm ls`
 * reaches through xlinks, so one under another is read as any other.
 */
export interface XlinkSides {
  before: XlinkTarget | null;
  after: XlinkTarget | null;
}
