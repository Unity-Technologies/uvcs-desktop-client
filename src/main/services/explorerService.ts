import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ExplorerApi } from '@shared/api/explorer';
import type { DeletedItemRestore, ItemMove, RevisionType } from '@shared/domain/explorer';
import type { Place, RepositoryPlace } from '@shared/domain/place';
import { repositorySpec } from '@shared/domain/specs';
import { cmPlace } from '../cm/cmPlace';
import { parseItemDetails } from '../cm/itemDetailsXml';
import { onLinksThemselves } from '../cm/symlinkArgs';
import { readTreeItem, TREE_ITEM_FORMAT, withoutHash, type ListedTreeItem } from '../cm/treeItems';
import { listWorkspacePaths } from '../files/listWorkspacePaths';
import { revisionFilesOf } from '../files/WorkspaceCopies';
import { moveArgs, moveItems } from '../files/moveItems';
import { renamePrivate } from '../files/renamePrivate';
import { restoreDeletedItems } from '../files/restoreDeletedItems';
import { toAbsolutePath, toAbsolutePaths } from '../files/workspacePaths';
import { sendEventsToCaller } from '../ipc/sendEvent';
import type { ServiceContext } from './ServiceContext';

/** How many of a repository's paths a search keeps, the best first: as many as the workspace's Go to file shows. */
export const FOUND_PATHS_LIMIT = 60;

export function createExplorerService({ cm, operations, workspaceCopies, headers, repositoryPaths }: ServiceContext): ExplorerApi {
  const inWorkspace = (workspacePath: string) => ({ cwd: workspacePath });

  /**
   * A folder's items, their revisions remembered in a workspace: a diff of one the disk holds reads it there
   * (`WorkspaceCopies`). The hashes stay here.
   */
  function rememberedItems(place: Place, items: ListedTreeItem[]) {
    if (place.kind === 'workspace') workspaceCopies.remember(place.workspacePath, revisionFilesOf(items));
    return items.map(withoutHash);
  }

  async function listDirectory(workspacePath: string, directory: string) {
    const listedAt = workspaceCopies.generationOf(workspacePath);
    const args = onLinksThemselves('ls', toAbsolutePath(workspacePath, directory), TREE_ITEM_FORMAT);
    // The workspace's own listing of the folder: what it holds there, so it isn't asked again to find a copy.
    const items = await cm.queryRecords(args, readTreeItem, inWorkspace(workspacePath));
    workspaceCopies.rememberFolder(workspacePath, directory, revisionFilesOf(items), listedAt);
    return items.map(withoutHash);
  }

  async function listRepositoryDirectory(place: Place, changesetId: number, directory: string) {
    const at = cmPlace(place);
    const items = await cm.queryRecords(['ls', `/${directory}`, `--tree=${at.spec(`cs:${changesetId}`)}`, TREE_ITEM_FORMAT], readTreeItem, at.options);
    return rememberedItems(place, items);
  }

  async function details(workspacePath: string, path: string) {
    const xml = await cm.query(onLinksThemselves('fileinfo', toAbsolutePath(workspacePath, path), '--xml'), inWorkspace(workspacePath));
    return parseItemDetails(xml);
  }

  async function addRecursive(workspacePath: string, paths: string[]) {
    await cm.query(['add', '-R', '--coparent', ...toAbsolutePaths(workspacePath, paths)], inWorkspace(workspacePath));
  }

  async function move(workspacePath: string, fromPath: string, toPath: string) {
    await cm.query(moveArgs(workspacePath, { from: fromPath, to: toPath }), inWorkspace(workspacePath));
  }

  function moveItemsInto(workspacePath: string, moves: ItemMove[], operationId: string) {
    const mover = { cm: (args: string[]) => cm.query(args, inWorkspace(workspacePath)), renamePrivate };
    return operations.run(operationId, (context) => moveItems(workspacePath, moves, mover, context));
  }

  function restoreDeleted(workspacePath: string, restores: DeletedItemRestore[], operationId: string) {
    const restorer = { cm: (args: string[]) => cm.query(args, inWorkspace(workspacePath)) };
    return operations.run(operationId, async (context) => {
      // The workspace's repository, from the header its window's info reads too (a local read, shared while fresh).
      const { repositoryName, server } = await headers.status(workspacePath);
      return restoreDeletedItems(workspacePath, repositorySpec(repositoryName, server), restores, restorer, context);
    });
  }

  async function renameItemOnDisk(workspacePath: string, fromPath: string, toPath: string) {
    await renamePrivate(toAbsolutePath(workspacePath, fromPath), toAbsolutePath(workspacePath, toPath));
  }

  async function create(workspacePath: string, path: string, kind: 'file' | 'directory') {
    const absolutePath = toAbsolutePath(workspacePath, path);
    // Folders typed along with the name (`docs/intro.md`) are created too; `cm add` adds them with the item.
    await mkdir(dirname(absolutePath), { recursive: true });
    if (kind === 'directory') await mkdir(absolutePath);
    else await writeFile(absolutePath, '', { flag: 'wx' });
    await cm.query(['add', '--coparent', absolutePath], inWorkspace(workspacePath));
  }

  async function changeRevisionType(workspacePath: string, paths: string[], type: RevisionType) {
    await cm.query(['changerevisiontype', ...toAbsolutePaths(workspacePath, paths), `--type=${type}`], inWorkspace(workspacePath));
  }

  /** The searches of a repository's paths running, by id: a newer query or a closed dialog stops one (`stopFindingRepositoryPaths`). */
  const pathSearches = new Map<string, AbortController>();

  async function findRepositoryPaths(place: RepositoryPlace, changesetId: number, query: string, searchId: string) {
    const stop = new AbortController();
    // The window is named now: the listing's records may arrive in the async context of another window's search.
    const sendToCaller = sendEventsToCaller();
    pathSearches.set(searchId, stop);
    try {
      return await repositoryPaths.search(place, changesetId, query, {
        limit: FOUND_PATHS_LIMIT,
        signal: stop.signal,
        onUpdate: (paths, source) => sendToCaller('repositoryPathsFound', { searchId, paths, source }),
      });
    } finally {
      pathSearches.delete(searchId);
    }
  }

  return {
    listDirectory,
    listRepositoryDirectory,
    findRepositoryPaths,
    prepareRepositoryPaths: async (place, changesetId) => repositoryPaths.prepare(place, changesetId),
    stopFindingRepositoryPaths: async (searchId) => pathSearches.get(searchId)?.abort(),
    listAllPaths: listWorkspacePaths,
    details,
    addRecursive,
    move,
    renamePrivate: renameItemOnDisk,
    moveItems: moveItemsInto,
    restoreDeleted,
    create,
    changeRevisionType,
  };
}
