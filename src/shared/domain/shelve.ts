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
