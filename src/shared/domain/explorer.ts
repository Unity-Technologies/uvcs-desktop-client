import type { ItemType } from './pendingChanges';

/** One file or directory as listed by `cm ls`, in the workspace or in a repository tree. */
export interface TreeItem {
  /** Path relative to the root, with forward slashes and no leading slash, e.g. `src/app.ts`. */
  path: string;
  name: string;
  itemType: ItemType;
  size: number;
  date: string;
  /** Private items are not under version control, so they have no revision information. */
  isPrivate: boolean;
  isCheckedOut: boolean;
  changeset: number;
  branch: string;
  owner: string;
  revisionId: number;
  /** The revision before `revisionId`; -1 when this is the first one. */
  parentRevisionId: number;
  itemId: number;
}

/** Extra information about a workspace item, from `cm fileinfo`. */
export interface ItemDetails {
  serverPath: string;
  status: string;
  loadedChangeset: number;
  owner: string;
  hash: string;
  repository: string;
  changelist: string;
  xlinkTarget: string;
  underXlinkTarget: string;
}

export type RevisionType = 'bin' | 'txt';
