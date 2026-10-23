import type { RevisionRef } from '@shared/domain/revision';
import { parseTreeItems, TREE_ITEM_FORMAT } from './treeItems';

/** A file deleted from disk as the workspace still has it loaded: its revision, and `cm`'s kind and size of it. */
export interface DeletedFile {
  revision: RevisionRef;
  /** `cm`'s own revision type (`bin`), as its rules for file types (`filetypes.conf`) and content set it. */
  isBinary: boolean;
  size: number;
}

/**
 * `cm ls` of files deleted from disk, by their workspace paths: `cm` lists the revision each one has loaded, in the
 * repository that holds it (an xlinked one under an xlink), with no content read.
 */
export function deletedFilesArgs(absolutePaths: readonly string[]): string[] {
  return ['ls', ...absolutePaths, TREE_ITEM_FORMAT];
}

/**
 * Each listed file by its workspace path (forward slashes), composed (NFC): macOS's `cm` prints names decomposed,
 * while the paths asked for may be either. A folder, or an item with no loaded revision, is left out.
 */
export function parseDeletedFiles(output: string): Map<string, DeletedFile> {
  const files = new Map<string, DeletedFile>();
  for (const item of parseTreeItems(output)) {
    if (item.itemType === 'directory' || item.revisionId <= 0 || !item.repository) continue;
    const revision = { revisionId: item.revisionId, repository: item.repository };
    files.set(item.path.normalize('NFC'), { revision, isBinary: item.itemType === 'binaryFile', size: item.size });
  }
  return files;
}

/**
 * The paths a failed `cm ls` couldn't find (`Item <path> not found.`, one line each, the others listed all the same),
 * as it printed them; empty when it failed otherwise. A deleted item under a folder the move detection paired is
 * listed by `cm status` at the folder's new path, where nothing is loaded.
 */
export function notFoundPaths(output: string): string[] {
  return [...output.matchAll(/^Item (.+) not found\.\r?$/gm)].map((found) => found[1]!);
}
