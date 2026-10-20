import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ExplorerApi } from '@shared/api/explorer';
import type { DeletedItemRestore, ItemMove, RevisionType } from '@shared/domain/explorer';
import { repositorySpec } from '@shared/domain/specs';
import { parseItemDetails } from '../cm/itemDetailsXml';
import { onLinksThemselves } from '../cm/symlinkArgs';
import { parseTreeItems, TREE_ITEM_FORMAT, withoutHash } from '../cm/treeItems';
import { listWorkspacePaths } from '../files/listWorkspacePaths';
import { revisionFilesOf } from '../files/WorkspaceCopies';
import { moveArgs, moveItems } from '../files/moveItems';
import { renamePrivate } from '../files/renamePrivate';
import { restoreDeletedItems } from '../files/restoreDeletedItems';
import { toAbsolutePath, toAbsolutePaths } from '../files/workspacePaths';
import type { ServiceContext } from './ServiceContext';

export function createExplorerService({ cm, operations, workspaceCopies, headers }: ServiceContext): ExplorerApi {
  const inWorkspace = (workspacePath: string) => ({ cwd: workspacePath });

  /**
   * A folder's items, their revisions remembered: a diff of one the disk holds reads it there (`WorkspaceCopies`). The
   * hashes stay here.
   */
  function rememberedItems(workspacePath: string, output: string) {
    const items = parseTreeItems(output);
    workspaceCopies.remember(workspacePath, revisionFilesOf(items));
    return items.map(withoutHash);
  }

  async function listDirectory(workspacePath: string, directory: string) {
    const listedAt = workspaceCopies.generationOf(workspacePath);
    const output = await cm.query(onLinksThemselves('ls', toAbsolutePath(workspacePath, directory), TREE_ITEM_FORMAT), inWorkspace(workspacePath));
    // The workspace's own listing of the folder: what it holds there, so it isn't asked again to find a copy.
    const items = parseTreeItems(output);
    workspaceCopies.rememberFolder(workspacePath, directory, revisionFilesOf(items), listedAt);
    return items.map(withoutHash);
  }

  async function listRepositoryDirectory(workspacePath: string, changesetId: number, directory: string) {
    const output = await cm.query(['ls', `/${directory}`, `--tree=cs:${changesetId}`, TREE_ITEM_FORMAT], inWorkspace(workspacePath));
    return rememberedItems(workspacePath, output);
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

  return {
    listDirectory,
    listRepositoryDirectory,
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
