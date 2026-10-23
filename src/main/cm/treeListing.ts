// A folder of the repository's tree at a changeset or a branch's head, listed with every item below it in one
// `cm ls <folder> --tree=<point> -R --format=…`: what the Materials look finds a model's textures and materials in at
// the version's point (docs/features/model-diff.md, "Materials"). The listing walks through xlinks, so each item names
// the repository holding its revision (`{repspec}`), and its path is the workspace's (`{wkpath}`).

import type { RevisionRef } from '@shared/domain/revision';
import { recordFormat, type ReadRecord } from './formatRecords';

/** An item of the tree, as listed. */
export interface ListedItem {
  /** Workspace-relative, `/`-separated: the root is `''`. */
  path: string;
  /** A folder, or an xlink, which the listing walks into as one. */
  isFolder: boolean;
  size: number;
  revision: RevisionRef;
  /** MD5 of the content, base64, as `cm` keeps it. */
  hash: string;
  /** The changeset that made this revision. */
  changeset: number;
  /** The revision before it; -1 for one that added the item. */
  parentRevisionId: number;
}

const FIELDS = ['wkpath', 'type', 'size', 'revid', 'hash', 'repspec', 'changeset', 'parentrevid'];

/**
 * `cm ls` of a workspace-relative folder (`''` for the root) at `point` (`cs:12`, `br:/main`): with everything below
 * it when `recursive`, else its children.
 */
export function treeListingArgs(folder: string, point: string, recursive: boolean): string[] {
  return ['ls', `/${folder}`, `--tree=${point}`, ...(recursive ? ['-R'] : []), `--format=${recordFormat(FIELDS)}`];
}

/** One item listed, the folder itself included, read as it arrives (`queryRecords`); none without a revision. */
export const readListedItem: ReadRecord<ListedItem> = ([wkPath = '', type = '', size, revisionId, hash = '', repository = '', changeset, parentRevisionId]) => {
  const revision = Number(revisionId);
  if (!Number.isInteger(revision) || revision < 0) return undefined;
  return {
    path: wkPath.replaceAll('\\', '/').replace(/^\/+/, ''),
    isFolder: type === 'dir' || type === 'xlink',
    size: Number(size) || 0,
    revision: { revisionId: revision, repository: repository.replace(/^rep:/, '') },
    hash,
    changeset: Number(changeset),
    parentRevisionId: Number(parentRevisionId),
  };
};
