export interface Shelve {
  id: number;
  guid: string;
  comment: string;
  owner: string;
  date: string;
  /** The changeset the shelved changes were made on top of. */
  parentChangeset: number;
  repository: string;
}

/**
 * How the comment of a shelve left by switching with pending changes starts, the official client's (see
 * AutomaticShelveComment.cs in the Plastic sources), followed by where the changes were made: ` (from br:<branch id>)`.
 */
export const AUTOMATIC_SHELVE_COMMENT = 'Automatic shelve created during switch operation';

/** How applying a shelve to the workspace went. `cm` merges only into a workspace without pending changes. */
export type ShelveApplyResult = { kind: 'applied'; count: number } | { kind: 'conflicts' } | { kind: 'pendingChanges' };

/** Changes shelved and undone in the workspace: they are in the shelve only, until it is applied. */
export interface ShelvedAway {
  shelveId: number;
  count: number;
}
