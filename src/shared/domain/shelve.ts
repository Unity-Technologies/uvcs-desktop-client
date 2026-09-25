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

export interface ShelveApplyPreview {
  /** Server paths the shelve changes, e.g. `/src/app.ts`. */
  changedPaths: string[];
  /** Server paths also changed since the shelve was created; applying them needs a merge. */
  conflictedPaths: string[];
}
